const { query } = require('./src/config/database');

async function analyzeTables() {
  try {
    console.log('🔍 Analyzing Classes and Sections tables...\n');

    // Analyze classes table
    console.log('📚 CLASSES TABLE STRUCTURE:');
    const classesStructure = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'classes' 
      ORDER BY ordinal_position
    `);
    
    classesStructure.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'} ${col.column_default ? `default: ${col.column_default}` : ''}`);
    });

    console.log('\n📊 CLASSES TABLE SAMPLE DATA:');
    const classesData = await query('SELECT * FROM classes LIMIT 3');
    console.log(classesData.rows);

    console.log('\n📈 CLASSES TABLE ROW COUNT:');
    const classesCount = await query('SELECT COUNT(*) as count FROM classes');
    console.log(`  Total rows: ${classesCount.rows[0].count}`);

    // Analyze sections table
    console.log('\n\n📚 SECTIONS TABLE STRUCTURE:');
    const sectionsStructure = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'sections' 
      ORDER BY ordinal_position
    `);
    
    sectionsStructure.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'} ${col.column_default ? `default: ${col.column_default}` : ''}`);
    });

    console.log('\n📊 SECTIONS TABLE SAMPLE DATA:');
    const sectionsData = await query('SELECT * FROM sections LIMIT 3');
    console.log(sectionsData.rows);

    console.log('\n📈 SECTIONS TABLE ROW COUNT:');
    const sectionsCount = await query('SELECT COUNT(*) as count FROM sections');
    console.log(`  Total rows: ${sectionsCount.rows[0].count}`);

    // Check for any foreign key relationships
    console.log('\n🔗 FOREIGN KEY RELATIONSHIPS:');
    const foreignKeys = await query(`
      SELECT 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND (tc.table_name = 'classes' OR tc.table_name = 'sections')
    `);
    
    if (foreignKeys.rows.length > 0) {
      foreignKeys.rows.forEach(fk => {
        console.log(`  ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      });
    } else {
      console.log('  No foreign key relationships found');
    }

  } catch (error) {
    console.error('❌ Error analyzing tables:', error);
  } finally {
    process.exit(0);
  }
}

analyzeTables();
