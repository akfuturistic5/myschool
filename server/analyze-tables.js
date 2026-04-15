const { query } = require('./src/config/database');

async function analyzeTables() {
  try {
    console.log('🔍 Analyzing database tables...\n');

    // Check if classes and sections tables exist
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('classes', 'sections')
      ORDER BY table_name;
    `;
    
    const tables = await query(tablesQuery);
    console.log('📋 Available tables:', tables.rows.map(row => row.table_name));

    // Analyze classes table structure
    if (tables.rows.some(row => row.table_name === 'classes')) {
      console.log('\n📊 Classes table structure:');
      const classesStructure = await query(`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = 'classes' 
        ORDER BY ordinal_position;
      `);
      
      classesStructure.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
      });

      // Get sample data
      const classesData = await query('SELECT * FROM classes LIMIT 3');
      console.log('\n📝 Sample classes data:');
      console.log(JSON.stringify(classesData.rows, null, 2));
    }

    // Analyze sections table structure
    if (tables.rows.some(row => row.table_name === 'sections')) {
      console.log('\n📊 Sections table structure:');
      const sectionsStructure = await query(`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = 'sections' 
        ORDER BY ordinal_position;
      `);
      
      sectionsStructure.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
      });

      // Get sample data
      const sectionsData = await query('SELECT * FROM sections LIMIT 3');
      console.log('\n📝 Sample sections data:');
      console.log(JSON.stringify(sectionsData.rows, null, 2));
    }

    // Check for foreign key relationships
    console.log('\n🔍 Checking foreign key relationships...');
    const foreignKeys = await query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name IN ('classes', 'sections')
      ORDER BY tc.table_name, kcu.column_name;
    `);
    
    console.log('🔗 Foreign key relationships:');
    foreignKeys.rows.forEach(fk => {
      console.log(`  - ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    });

  } catch (error) {
    console.error('❌ Error analyzing tables:', error);
  } finally {
    process.exit(0);
  }
}

analyzeTables();

