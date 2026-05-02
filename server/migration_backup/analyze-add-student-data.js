/**
 * Analyze DB connectivity and fetch all data needed for Add Student form
 * Used to verify 2024-25 academic year, classes, sections, etc.
 */
const { query } = require('./src/config/database');

async function analyze() {
  try {
    console.log('=== DB Connectivity & Add Student Data Analysis ===\n');

    // 1. Academic years - find 2024-25
    const ay = await query(`
      SELECT id, year_name, is_current 
      FROM academic_years 
      ORDER BY id
    `);
    console.log('Academic Years:');
    ay.rows.forEach(r => console.log(`  id=${r.id} year_name="${r.year_name}" is_current=${r.is_current}`));
    const ay2024 = ay.rows.find(r => (r.year_name || '').includes('2024') || (r.year_name || '').includes('2024-25'));
    console.log('\n2024-25 Academic Year ID:', ay2024 ? ay2024.id : 'NOT FOUND - will use first available\n');

    // 2. Classes
    const classes = await query('SELECT id, class_name FROM classes ORDER BY id LIMIT 10');
    console.log('Classes (first 10):');
    classes.rows.forEach(r => console.log(`  id=${r.id} class_name="${r.class_name}"`));

    // 3. Sections
    const sections = await query('SELECT id, section_name FROM sections ORDER BY id LIMIT 10');
    console.log('\nSections (first 10):');
    sections.rows.forEach(r => console.log(`  id=${r.id} section_name="${r.section_name}"`));

    // 4. Blood groups
    const bg = await query('SELECT id, blood_group FROM blood_groups ORDER BY id LIMIT 5');
    console.log('\nBlood Groups:');
    bg.rows.forEach(r => console.log(`  id=${r.id} blood_group="${r.blood_group}"`));

    // 5. Religions
    const rel = await query('SELECT id, religion_name FROM religions ORDER BY id LIMIT 5');
    console.log('\nReligions:');
    rel.rows.forEach(r => console.log(`  id=${r.id} religion_name="${r.religion_name}"`));

    // 6. Casts
    const casts = await query('SELECT id, cast_name FROM casts ORDER BY id LIMIT 5');
    console.log('\nCasts:');
    casts.rows.forEach(r => console.log(`  id=${r.id} cast_name="${r.cast_name}"`));

    // 7. Houses
    const houses = await query('SELECT id, house_name FROM houses ORDER BY id LIMIT 5');
    console.log('\nHouses:');
    houses.rows.forEach(r => console.log(`  id=${r.id} house_name="${r.house_name}"`));

    // 8. Mother tongues
    const mt = await query('SELECT id, language_name FROM mother_tongues ORDER BY id LIMIT 5');
    console.log('\nMother Tongues:');
    mt.rows.forEach(r => console.log(`  id=${r.id} language_name="${r.language_name}"`));

    // 9. Subjects (form doesn't require but user asked)
    const subjects = await query('SELECT id, subject_name FROM subjects ORDER BY id LIMIT 10');
    console.log('\nSubjects:');
    subjects.rows.forEach(r => console.log(`  id=${r.id} subject_name="${r.subject_name}"`));

    // 10. Parents table structure
    const parentCols = await query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'parents' ORDER BY ordinal_position
    `);
    console.log('\nParents table columns:', parentCols.rows.map(r => r.column_name).join(', '));

    // 11. Guardians table structure
    const guardianCols = await query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'guardians' ORDER BY ordinal_position
    `);
    console.log('\nGuardians table columns:', guardianCols.rows.map(r => r.column_name).join(', '));

    // 12. Next admission number (suggest)
    const maxAdm = await query(`
      SELECT MAX(admission_number::int) as max_num FROM students 
      WHERE admission_number ~ '^[0-9]+$'
    `);
    const nextAdm = (maxAdm.rows[0]?.max_num || 0) + 1;
    console.log('\nSuggested Admission Number:', String(nextAdm));

    console.log('\n=== DB connectivity OK ===');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

analyze();
