const fs = require('fs');
const path = require('path');

const srcFile = path.resolve(__dirname, '..', '..', 'migrations_old', '001_init_full_schema.sql');
const reseedFile = path.resolve(__dirname, '..', '..', 'migrations_old', '006_reseed_multi_academic_year_dummy_data.sql');
const dstFile = path.resolve('001_initial_dummy_dump.sql');

console.log(`Reading from ${srcFile}...`);
const content = fs.readFileSync(srcFile, 'utf8');
const lines = content.split(/\r?\n/);

const skipTables = [
  'blood_groups', 'casts', 'departments', 'designations', 
  'mother_tongues', 'religions', 'user_roles'
];

const columnBlacklist = {
    'classes': ['no_of_students'],
    'sections': ['no_of_students'],
    'exams': ['class_id', 'total_marks', 'passing_marks', 'start_date', 'end_date'],
    'students': ['sibiling_1', 'sibiling_2', 'sibiling_1_class', 'sibiling_2_class', 'parent_id'],
    'parents': ['father_user_id', 'mother_user_id']
};

let inCopy = false;
let currentTable = null;
let currentColumns = [];
let columnIndicesToSkip = [];

let result = [
  '-- Golden Seeder extracted from legacy data',
  '-- Cleaned to match current schema',
  'SET session_replication_role = \'replica\';',
  ''
];

for (let line of lines) {
  if (line.startsWith('COPY ')) {
    const match = line.match(/COPY public\.([a-z_]+) \((.*)\) FROM stdin;/);
    if (match) {
      currentTable = match[1];
      if (skipTables.includes(currentTable)) {
        inCopy = true; 
        continue;
      }
      
      inCopy = true;
      const cols = match[2].split(',').map(c => c.trim());
      currentColumns = cols;
      
      const blacklist = columnBlacklist[currentTable] || [];
      columnIndicesToSkip = [];
      const cleanCols = [];
      
      for (let i = 0; i < cols.length; i++) {
          if (blacklist.includes(cols[i])) {
              columnIndicesToSkip.push(i);
          } else {
              cleanCols.push(cols[i]);
          }
      }
      
      result.push(`COPY public.${currentTable} (${cleanCols.join(', ')}) FROM stdin;`);
    }
  } else if (line.trim() === '\\.') {
    if (inCopy && !skipTables.includes(currentTable)) {
      result.push(line);
      result.push('');
    }
    inCopy = false;
    currentTable = null;
    currentColumns = [];
    columnIndicesToSkip = [];
  } else if (inCopy) {
    if (!skipTables.includes(currentTable)) {
      if (line.trim() === '') {
          result.push('');
          continue;
      }
      const parts = line.split('\t');
      if (parts.length > 1) {
          const cleanParts = parts.filter((_, index) => !columnIndicesToSkip.includes(index));
          result.push(cleanParts.join('\t'));
      } else {
          result.push(line);
      }
    }
  }
}

const syncSequences = (label) => {
  const sequences = [
    'academic_years', 'addresses', 'attendance', 'blocked_users', 'blood_groups',
    'calendar_events', 'calls', 'casts', 'chat_settings', 'chats', 'class_rooms',
    'class_schedules', 'class_syllabus', 'classes', 'departments', 'designations',
    'document_types', 'documents', 'drivers', 'emails', 'events', 'exam_results',
    'exams', 'fee_collections', 'fee_structures', 'files', 'guardians', 'holidays',
    'hostel_rooms', 'hostels', 'houses', 'languages', 'leave_applications',
    'leave_types', 'library_book_issues', 'library_books', 'library_categories',
    'medical_conditions', 'mother_tongues', 'notes', 'notice_board', 'parents',
    'pickup_points', 'religions', 'reports', 'sections', 'staff', 'student_medical_conditions',
    'student_promotions', 'students', 'subjects', 'teacher_routines', 'teachers',
    'time_slots', 'todos', 'user_roles', 'users'
  ];
  
  let sql = `\n-- Sync Sequences ${label}\n`;
  for (const table of sequences) {
    sql += `SELECT setval('${table}_id_seq', COALESCE((SELECT MAX(id) FROM ${table}), 1));\n`;
  }
  return sql;
};

result.push(syncSequences('BEFORE Reseed'));

console.log(`Reading reseed logic from ${reseedFile}...`);
let reseed = fs.readFileSync(reseedFile, 'utf8');

// Delimiter fix
reseed = reseed.replace(/DO \$\$/g, 'DO $reseed$');
reseed = reseed.replace(/END \$\$;/g, 'END $reseed$;');

// Manual fixes for reseed logic (006)
// 1. Remove no_of_students from classes/sections
reseed = reseed.replace(/,\s*no_of_students/g, '');
reseed = reseed.replace(/no_of_students\s*,/g, '');
reseed = reseed.replace(/,\s*0\s*(?=\n\s*FROM)/g, '');

// 2. Remove siblings from students INSERT
reseed = reseed.replace(/sibiling_1, sibiling_2,\s*sibiling_1_class, sibiling_2_class,/g, '');
reseed = reseed.replace(/'Not Applicable',\s*'Not Applicable',\s*'N\/A',\s*'N\/A',/g, '');

// 3. Remove father/mother user IDs from parents INSERT
reseed = reseed.replace(/,\s*father_user_id,\s*mother_user_id/g, '');
reseed = reseed.replace(/,\s*fu\.id,\s*fu\.id,\s*mu\.id/g, ',\n    fu.id');
reseed = reseed.replace(/user_id,\s*\)/g, 'user_id\n    )');

// 4. SKIP students parent_id update
reseed = reseed.replace(/UPDATE students s\s*SET parent_id = p\.id[\s\S]*?AND \(s\.parent_id IS NULL OR s\.parent_id <> p\.id\);/g, '-- Skipped parent_id update (schema change)');

// 5. Remove the final update block (Section 13)
const section13Idx = reseed.indexOf('-- 13) Update class/section counts');
if (section13Idx !== -1) {
    const endBlockIdx = reseed.indexOf('END $reseed$;', section13Idx);
    if (endBlockIdx !== -1) {
        reseed = reseed.substring(0, section13Idx) + '  -- Counts skipped (schema change)\n  ' + reseed.substring(endBlockIdx);
    }
}

result.push('-- Dynamic Reseed Logic (Cleaned)');
result.push(reseed);
result.push('');
result.push(syncSequences('AFTER Reseed'));
result.push("SET session_replication_role = 'origin';");

fs.writeFileSync(dstFile, result.join('\n'));
console.log(`Wrote ${result.length} lines to ${dstFile}`);
