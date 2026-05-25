/**
 * One-time upgrade: merge support ticket child tables into support_tickets JSONB columns.
 * Safe to re-run (idempotent after child tables are dropped).
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { masterQuery } = require('../src/config/database');

async function main() {
  const file = path.join(__dirname, '../migrations/master/20260523120000_help_support_module.sql');
  const full = fs.readFileSync(file, 'utf8');
  const start = full.indexOf('-- Upgrade older installs');
  const end = full.indexOf('-- Ticket number sequence');
  if (start === -1 || end === -1) {
    throw new Error('Upgrade block not found in migration file');
  }
  const block = full.slice(start, end).trim();
  console.log('Applying support_tickets JSONB upgrade...');
  await masterQuery(block);
  const tables = await masterQuery(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name LIKE 'support_ticket%'
     ORDER BY table_name`
  );
  console.log('support_ticket* tables:', tables.rows.map((r) => r.table_name).join(', '));
  const cols = await masterQuery(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'support_tickets'
       AND column_name IN ('messages', 'attachments', 'status_history')
     ORDER BY column_name`
  );
  console.log('JSONB columns:', cols.rows.map((r) => r.column_name).join(', '));
  console.log('Done.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
