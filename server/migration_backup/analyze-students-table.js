const { query } = require('./src/config/database');

async function analyzeStudentsTable() {
  try {
    console.log('🔍 Analyzing students table...\n');

    // Check if students table exists
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'students';
    `;
    
    const tables = await query(tablesQuery);
    console.log('📋 Available tables:', tables.rows.map(row => row.table_name));

    if (tables.rows.length === 0) {
      console.log('❌ Students table not found');
      return;
    }

    // Analyze students table structure
    console.log('\n📊 Students table structure:');
    const studentsStructure = await query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'students' 
      ORDER BY ordinal_position;
    `);
    
    studentsStructure.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
    });

    // Get sample data
    const studentsData = await query('SELECT * FROM students LIMIT 3');
    console.log('\n📝 Sample students data:');
    console.log(JSON.stringify(studentsData.rows, null, 2));

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
        AND tc.table_name = 'students'
      ORDER BY kcu.column_name;
    `);
    
    console.log('🔗 Foreign key relationships:');
    foreignKeys.rows.forEach(fk => {
      console.log(`  - ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    });

  } catch (error) {
    console.error('❌ Error analyzing students table:', error);
  } finally {
    process.exit(0);
  }
}

analyzeStudentsTable();
