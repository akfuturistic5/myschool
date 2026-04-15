const { query } = require('./src/config/database');

async function analyzeHousesAndReligions() {
  try {
    console.log('🔍 Analyzing houses and religions tables...\n');

    // Check if houses and religions tables exist
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('houses', 'religions')
      ORDER BY table_name;
    `;
    
    const tables = await query(tablesQuery);
    console.log('📋 Available tables:', tables.rows.map(row => row.table_name));

    // Analyze houses table structure
    if (tables.rows.some(row => row.table_name === 'houses')) {
      console.log('\n📊 Houses table structure:');
      const housesStructure = await query(`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = 'houses' 
        ORDER BY ordinal_position;
      `);
      
      housesStructure.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
      });

      // Get sample data
      const housesData = await query('SELECT * FROM houses LIMIT 3');
      console.log('\n📝 Sample houses data:');
      console.log(JSON.stringify(housesData.rows, null, 2));
    }

    // Analyze religions table structure
    if (tables.rows.some(row => row.table_name === 'religions')) {
      console.log('\n📊 Religions table structure:');
      const religionsStructure = await query(`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = 'religions' 
        ORDER BY ordinal_position;
      `);
      
      religionsStructure.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
      });

      // Get sample data
      const religionsData = await query('SELECT * FROM religions LIMIT 3');
      console.log('\n📝 Sample religions data:');
      console.log(JSON.stringify(religionsData.rows, null, 2));
    }

  } catch (error) {
    console.error('❌ Error analyzing tables:', error);
  } finally {
    process.exit(0);
  }
}

analyzeHousesAndReligions();
