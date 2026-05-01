/**
 * Create Database Utility
 * Usage: node scripts/create-db.js [db_name]
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Client } = require('pg');

async function createDatabase(dbName) {
  if (!dbName) {
    console.error('Usage: node scripts/create-db.js [db_name]');
    process.exit(1);
  }

  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: 'postgres', // Connect to default system DB
  });

  try {
    await client.connect();
    // Check if exists
    const res = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (res.rowCount > 0) {
      console.log(`⏩ Database "${dbName}" already exists.`);
    } else {
      await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
      console.log(`✅ Database "${dbName}" created successfully.`);
    }
  } catch (err) {
    console.error('💥 Failed to create database:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createDatabase(process.argv[2]);
