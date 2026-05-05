/**
 * DB Runner - Unified SQL File Executor for Master and Tenant Databases.
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const sslConfig =
  process.env.DATABASE_SSL_MODE === 'require'
    ? { rejectUnauthorized: false }
    : false;

/**
 * Create DB pool based on type (master / tenant)
 */
function makePool(dbType, dbOverride) {
  const isMaster = dbType === 'master';

  const config = {
    host: isMaster
      ? process.env.DB_MASTER_HOST
      : process.env.DB_SCHOOL_HOST,
    port: parseInt(
      isMaster
        ? process.env.DB_MASTER_PORT
        : process.env.DB_SCHOOL_PORT,
      10
    ),
    user: isMaster
      ? process.env.DB_MASTER_USER
      : process.env.DB_SCHOOL_USER,
    password: isMaster
      ? process.env.DB_MASTER_PASS
      : process.env.DB_SCHOOL_PASS,
    database:
      dbOverride ||
      (isMaster
        ? process.env.DB_MASTER_NAME
        : process.env.DB_SCHOOL_NAME),
    ssl: sslConfig,
    max: 5,
  };

  // 🔍 DEBUG LOG (important)
  console.log(
    `\n🔌 Connecting to ${isMaster ? 'MASTER' : 'TENANT'} DB:`,
    config.database
  );

  // ❌ Fail fast if missing config
  if (!config.database) {
    throw new Error(
      `Database name missing for ${dbType}. Check your .env file.`
    );
  }

  return new Pool(config);
}

/**
 * Split SQL into safe statements
 */
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
        current += ' ';
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
      if (char === "'" && !inDoubleQuote)
        inSingleQuote = !inSingleQuote;
      if (char === '"' && !inSingleQuote)
        inDoubleQuote = !inDoubleQuote;
    }

    if (
      char === ';' &&
      !inSingleQuote &&
      !inDoubleQuote &&
      !inDollarQuote
    ) {
      statements.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) statements.push(current.trim());
  return statements.filter((s) => s.trim().length > 0);
}

/**
 * Ensure migration history table exists
 */
async function ensureHistoryTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migration_history (
      id SERIAL PRIMARY KEY,
      migration_name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

/**
 * Execute SQL file safely
 */
async function runSqlFile(pool, filePath) {
  const fileName = path.basename(filePath);
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const check = await pool.query(
    'SELECT 1 FROM migration_history WHERE migration_name = $1',
    [fileName]
  );

  if (check.rowCount > 0) {
    console.log(`⏩ Skipping ${fileName} (Already applied)`);
    return;
  }

  const sql = fs.readFileSync(absolutePath, 'utf8');
  const statements = splitSql(sql);

  console.log(
    `\n📄 Executing ${fileName} (${statements.length} statements)`
  );

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const statement of statements) {
      const snippet = statement
        .substring(0, 50)
        .replace(/\n/g, ' ');
      console.log(`  ➔ Running: ${snippet}...`);

      await client.query(statement);
    }

    await client.query(
      'INSERT INTO migration_history (migration_name) VALUES ($1)',
      [fileName]
    );

    await client.query('COMMIT');
    console.log(`✅ Success: ${fileName}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`❌ Failed: ${fileName}`);
    console.error(`🔴 Error: ${err.message}`);
    process.exit(1);
  } finally {
    client.release();
  }
}

/**
 * Main runner
 */
async function main() {
  const args = process.argv.slice(2);

  const dbType = args[args.indexOf('--db') + 1];
  const sqlFiles = args[args.indexOf('--sql') + 1].split(',');

  const dbNameIdx = args.indexOf('--dbname');
  const dbOverride =
    dbNameIdx !== -1 ? args[dbNameIdx + 1] : null;

  const pool = makePool(dbType, dbOverride);

  try {
    await ensureHistoryTable(pool);

    for (const file of sqlFiles) {
      await runSqlFile(pool, file.trim());
    }
  } catch (err) {
    console.error('💥 Failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();