/**
 * Tenant Bulk Runner
 * Executes provided SQL files on every active school database in the master registry.
 * Usage: node scripts/tenant-bulk-runner.js --sql path/to/file1.sql,path/to/file2.sql
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const sslConfig = process.env.DATABASE_SSL_MODE === 'require' ? { rejectUnauthorized: false } : false;

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

async function runOnDatabase(dbName, sqlFiles) {
  console.log(`\n---------------------------------------------------------`);
  console.log(`📡 Processing Tenant: ${dbName}`);
  console.log(`---------------------------------------------------------`);

  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
    ssl: sslConfig,
  });

  try {
    // 1. Ensure history table
    await pool.query(`CREATE TABLE IF NOT EXISTS migration_history (
      id SERIAL PRIMARY KEY,
      migration_name VARCHAR(255) NOT NULL UNIQUE,
      batch INTEGER,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );`);

    for (const filePath of sqlFiles) {
      const fileName = path.basename(filePath);
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
      
      if (!fs.existsSync(absolutePath)) {
        console.error(`❌ File not found: ${filePath}`);
        continue;
      }

      // 2. Check if already applied
      const check = await pool.query('SELECT 1 FROM migration_history WHERE migration_name = $1', [fileName]);
      if (check.rowCount > 0) {
        console.log(`⏩ Skipping ${fileName} (Already applied to ${dbName})`);
        continue;
      }

      // 3. Run SQL
      const sql = fs.readFileSync(absolutePath, 'utf8');
      const statements = splitSql(sql);
      
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const statement of statements) {
          try {
            await client.query(statement);
          } catch (err) {
            console.error(`\n❌ Failed: ${fileName} on ${dbName}`);
            console.error(`💥 Statement: ${statement}`);
            console.error(`🔴 Error in ${dbName}: ${err.message}`);
            throw err;
          }
        }
        await client.query('INSERT INTO migration_history (migration_name) VALUES ($1)', [fileName]);
        await client.query('COMMIT');
        console.log(`✅ Success: ${fileName} on ${dbName}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Failed: ${fileName} on ${dbName}`);
        throw err;
      } finally { client.release(); }
    }

  } catch (err) {
    console.error(`💥 Error in ${dbName}:`, err.message);
  } finally {
    await pool.end();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const sqlIdx = args.indexOf('--sql');
  
  if (sqlIdx === -1) {
    console.error('Usage: node scripts/tenant-bulk-runner.js --sql file1.sql,file2.sql');
    process.exit(1);
  }
  
  const rawEntries = args[sqlIdx + 1].split(',').map(f => f.trim());
  const sqlFiles = [];

  for (const entry of rawEntries) {
    const absoluteEntry = path.isAbsolute(entry) ? entry : path.resolve(process.cwd(), entry);
    
    if (fs.existsSync(absoluteEntry)) {
      const stats = fs.statSync(absoluteEntry);
      if (stats.isDirectory()) {
        // Find all .sql files in directory, sort them alphabetically
        const allFiles = fs.readdirSync(absoluteEntry)
          .filter(f => f.toLowerCase().endsWith('.sql'))
          .sort();
        
        // Ensure schema.sql always comes first
        const schemaIdx = allFiles.findIndex(f => f.toLowerCase() === 'schema.sql');
        if (schemaIdx > -1) {
          const [schemaFile] = allFiles.splice(schemaIdx, 1);
          allFiles.unshift(schemaFile);
        }

        const files = allFiles.map(f => path.join(entry, f));
        sqlFiles.push(...files);
      } else {
        sqlFiles.push(entry);
      }
    } else {
      // If it doesn't exist yet, just push it and let runOnDatabase handle the error
      sqlFiles.push(entry);
    }
  }

  if (sqlFiles.length === 0) {
    console.error('No SQL files found to execute.');
    process.exit(0);
  }

  const masterPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'master_db',
    ssl: sslConfig,
  });

  try {
    console.log('🔍 Discovering all active school databases...');
    const res = await masterPool.query('SELECT db_name FROM public.schools WHERE status = $1', ['active']);
    const dbs = res.rows.map(r => r.db_name);

    if (dbs.length === 0) {
      console.log('⚠️ No active school databases found.');
      return;
    }

    console.log(`🚀 Bulk running on ${dbs.length} databases...`);

    for (const db of dbs) {
      await runOnDatabase(db, sqlFiles);
    }

    console.log('\n✨ All bulk operations completed.');
  } catch (err) {
    console.error('💥 Critical Error:', err.message);
    process.exit(1);
  } finally {
    await masterPool.end();
  }
}

main();
