const { query } = require('./src/config/database');

async function testQuery() {
  try {
    console.log('Testing student query for ID 16...');
    
    const result = await query(`
      SELECT
        s.id,
        s.user_id,
        addr.current_address,
        addr.permanent_address
      FROM students s
      LEFT JOIN addresses addr ON s.user_id = addr.user_id
      WHERE s.id = 16 AND s.is_active = true
    `);
    
    console.log('Query result:', result.rows[0]);
    
    if (result.rows[0]) {
      console.log('✅ Query successful!');
      console.log('   user_id:', result.rows[0].user_id);
      console.log('   current_address:', result.rows[0].current_address);
      console.log('   permanent_address:', result.rows[0].permanent_address);
    } else {
      console.log('❌ No results found');
    }
    
  } catch (error) {
    console.error('❌ Query failed:', error);
  } finally {
    process.exit(0);
  }
}

testQuery();
