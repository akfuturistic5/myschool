/**
 * DB Runner - Unified SQL File Executor for Master and Tenant Databases.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const sslConfig = process.env.DATABASE_SSL_MODE === 'require' ? { rejectUnauthorized: false } : false;

function makePool(dbType, dbOverride) {
  const dbName = dbOverride || (dbType === 'master' 
    ? (process.env.DB_NAME || 'master_db') 
    : (process.env.TENANT_DB_NAME || 'school_db'));
    
  return new Pool({
    host: process.env.DB_HOST || 'localhost', port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres', password: process.env.DB_PASSWORD || '',
    database: dbName, ssl: sslConfig, max: 5,
  });
}

function splitSql(sql) {
  const statements = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inDollarQuote = false;
  let dollarTag = null;
  let inSingleLineComment = false;
  let inMultiLineComment = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1];

    if (inMultiLineComment) {
      if (char === '*' && nextChar === '/') {
        inMultiLineComment = false;
        i++;
      }
      continue;
    }

    if (inSingleLineComment) {
      if (char === '\n') {
        inSingleLineComment = false;
        current += ' '; // Add a space to prevent word merging
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && !inDollarQuote) {
      if (char === '/' && nextChar === '*') {
        inMultiLineComment = true;
        i++;
        continue;
      }
      if (char === '-' && nextChar === '-') {
        inSingleLineComment = true;
        i++;
        continue;
      }
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (char === '$') {
        if (inDollarQuote) {
          const remaining = sql.substring(i);
          if (remaining.startsWith(dollarTag)) {
            current += dollarTag;
            i += dollarTag.length - 1;
            inDollarQuote = false;
            dollarTag = null;
            continue;
          }
        } else {
          const match = sql.substring(i).match(/^(\$[a-zA-Z0-9_]*\$)/);
          if (match) {
            dollarTag = match[1];
            current += dollarTag;
            i += dollarTag.length - 1;
            inDollarQuote = true;
            continue;
          }
        }
      }
    }

    if (!inDollarQuote) {
      if (char === "'" && !inDoubleQuote) inSingleQuote = !inSingleQuote;
      if (char === '"' && !inSingleQuote) inDoubleQuote = !inDoubleQuote;
    }

    if (char === ';' && !inSingleQuote && !inDoubleQuote && !inDollarQuote) {
      statements.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) statements.push(current.trim());
  return statements.filter(s => s.trim().length > 0);
}

async function ensureHistoryTable(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS migration_history (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ DEFAULT NOW()
  );`);
}

async function runSqlFile(pool, filePath) {
  const fileName = path.basename(filePath);
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolutePath)) throw new Error(`File not found: ${absolutePath}`);

  // Skip check for seeders if preferred, but for migrations we track
  const check = await pool.query('SELECT 1 FROM migration_history WHERE migration_name = $1', [fileName]);
  if (check.rowCount > 0) {
    console.log(`⏩ Skipping ${fileName} (Already applied)`);
    return;
  }

  const sql = fs.readFileSync(absolutePath, 'utf8');
  const statements = splitSql(sql);
  
  console.log(`\n📄 Executing ${path.basename(filePath)} (${statements.length} statements)`);
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const statement of statements) {
      try {
        // Log the first 50 chars of the statement for debugging
        const snippet = statement.substring(0, 50).replace(/\n/g, ' ');
        console.log(`  ➔ Running: ${snippet}...`);
        await client.query(statement);
      } catch (err) {
        console.error(`\n❌ Failed: ${path.basename(filePath)}`);
        console.error(`💥 Statement: ${statement}`);
        console.error(`🔴 Error: ${err.message}`);
        process.exit(1);
      }
    }
    await client.query('INSERT INTO migration_history (migration_name) VALUES ($1)', [fileName]);
    await client.query('COMMIT');
    console.log(`✅ Success: ${fileName}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally { client.release(); }
}

async function main() {
  const args = process.argv.slice(2);
  const dbType = args[args.indexOf('--db') + 1];
  const sqlFiles = args[args.indexOf('--sql') + 1].split(',');
  
  const dbNameIdx = args.indexOf('--dbname');
  const dbOverride = dbNameIdx !== -1 ? args[dbNameIdx + 1] : null;

  const pool = makePool(dbType, dbOverride);
  try {
    await ensureHistoryTable(pool);
    for (const file of sqlFiles) { await runSqlFile(pool, file.trim()); }
  } catch (err) {
    console.error('💥 Failed:', err.message);
    process.exit(1);
  } finally { await pool.end(); }
}
main();
