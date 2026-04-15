/**
 * Analyzes drivers and vehicles tables: columns, sample data, and vehicle-driver join.
 * Run from server folder: node analyze-transport-tables.js
 */
const { query } = require('./src/config/database');

async function analyze() {
  try {
    console.log('🔍 Analyzing transport tables (drivers, vehicles)...\n');

    const driverColumns = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'drivers'
      ORDER BY ordinal_position
    `);
    console.log('📋 drivers table columns:');
    driverColumns.rows.forEach((c) => console.log(`  ${c.column_name} (${c.data_type})`));

    const vehicleColumns = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'vehicles'
      ORDER BY ordinal_position
    `);
    console.log('\n📋 vehicles table columns:');
    vehicleColumns.rows.forEach((c) => console.log(`  ${c.column_name} (${c.data_type})`));

    const driverSample = await query('SELECT * FROM drivers LIMIT 3');
    console.log('\n📊 Sample drivers rows (raw):');
    driverSample.rows.forEach((row, i) => {
      console.log(`  Row ${i + 1}:`, JSON.stringify(row, null, 2).split('\n').join('\n  '));
    });

    const vehicleSample = await query('SELECT * FROM vehicles LIMIT 3');
    console.log('\n📊 Sample vehicles rows (raw):');
    vehicleSample.rows.forEach((row, i) => {
      console.log(`  Row ${i + 1}:`, JSON.stringify(row, null, 2).split('\n').join('\n  '));
    });

    const joined = await query(`
      SELECT v.id AS vehicle_id, v.vehicle_number, v.driver_id, d.*
      FROM vehicles v
      LEFT JOIN drivers d ON d.id = v.driver_id
      LIMIT 3
    `);
    console.log('\n📊 Vehicles LEFT JOIN drivers (driver columns from DB):');
    if (joined.rows.length) {
      console.log('  Driver keys:', Object.keys(joined.rows[0]).filter((k) => k !== 'vehicle_id' && k !== 'vehicle_number' && k !== 'driver_id'));
      joined.rows.forEach((row, i) => console.log(`  Row ${i + 1}:`, row));
    } else console.log('  (no rows)');
  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.code) console.error('   Code:', err.code);
  } finally {
    const { pool } = require('./src/config/database');
    await pool.end();
  }
}

analyze();
