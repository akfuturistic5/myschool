const { query } = require('../config/database');

const columnCache = new Map();
const tableCache = new Map();

async function hasColumn(tableName, columnName) {
  const t = String(tableName || '').trim().toLowerCase();
  const c = String(columnName || '').trim().toLowerCase();
  const key = `${t}.${c}`;
  if (columnCache.has(key)) return columnCache.get(key);

  const res = await query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND column_name = $2
     LIMIT 1`,
    [t, c]
  );
  const exists = res.rows.length > 0;
  columnCache.set(key, exists);
  return exists;
}

async function hasTable(tableName) {
  const t = String(tableName || '').trim().toLowerCase();
  if (!t) return false;
  if (tableCache.has(t)) return tableCache.get(t);

  const res = await query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = $1
     LIMIT 1`,
    [t]
  );
  const exists = res.rows.length > 0;
  tableCache.set(t, exists);
  return exists;
}

module.exports = {
  hasColumn,
  hasTable,
};

