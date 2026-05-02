/**
 * Full schema analysis for current school_db.
 *
 * This script inspects:
 * - All public tables
 * - Columns (types, nullability, defaults)
 * - Primary keys
 * - Foreign keys and dependencies
 * - Indexes
 *
 * It also computes a suggested dependency order for inserts based on FK graph.
 *
 * Run with:
 *   NODE_ENV=development node analyze-full-schema.js
 */

const { query } = require('./src/config/database');

async function fetchTables() {
  const res = await query(
    `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
    `
  );
  return res.rows.map((r) => r.table_name);
}

async function fetchColumns() {
  const res = await query(
    `
    SELECT
      table_name,
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
    `
  );
  const byTable = {};
  for (const row of res.rows) {
    if (!byTable[row.table_name]) byTable[row.table_name] = [];
    byTable[row.table_name].push(row);
  }
  return byTable;
}

async function fetchConstraints() {
  const res = await query(
    `
    SELECT
      tc.table_name,
      tc.constraint_name,
      tc.constraint_type,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    LEFT JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    LEFT JOIN information_schema.constraint_column_usage AS ccu
      ON tc.constraint_name = ccu.constraint_name
      AND tc.table_schema = ccu.table_schema
    WHERE tc.table_schema = 'public'
    ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name, kcu.ordinal_position
    `
  );

  const byTable = {};
  for (const row of res.rows) {
    if (!byTable[row.table_name]) byTable[row.table_name] = [];
    byTable[row.table_name].push(row);
  }
  return byTable;
}

async function fetchIndexes() {
  const res = await query(
    `
    SELECT
      tablename AS table_name,
      indexname,
      indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname
    `
  );
  const byTable = {};
  for (const row of res.rows) {
    if (!byTable[row.table_name]) byTable[row.table_name] = [];
    byTable[row.table_name].push(row);
  }
  return byTable;
}

function buildDependencyGraph(tables, constraintsByTable) {
  // Graph: table -> set of tables it depends on (via FK)
  const deps = {};
  tables.forEach((t) => {
    deps[t] = new Set();
  });

  for (const [table, cons] of Object.entries(constraintsByTable)) {
    for (const c of cons) {
      if (c.constraint_type === 'FOREIGN KEY' && c.foreign_table_name) {
        deps[table]?.add(c.foreign_table_name);
      }
    }
  }

  // Kahn's algorithm for topological sort
  const inDegree = {};
  tables.forEach((t) => (inDegree[t] = 0));
  for (const [t, set] of Object.entries(deps)) {
    for (const ft of set) {
      if (inDegree[ft] != null) {
        inDegree[ft]++;
      }
    }
  }

  const queue = [];
  for (const [t, deg] of Object.entries(inDegree)) {
    if (deg === 0) queue.push(t);
  }

  const order = [];
  while (queue.length) {
    const t = queue.shift();
    order.push(t);
    for (const ft of deps[t] || []) {
      if (inDegree[ft] != null) {
        inDegree[ft]--;
        if (inDegree[ft] === 0) {
          queue.push(ft);
        }
      }
    }
  }

  const hasCycle = order.length !== tables.length;
  return { deps, order, hasCycle };
}

async function analyze() {
  console.log('=== Full Schema Analysis (public schema) ===\n');

  const tables = await fetchTables();
  console.log(`Found ${tables.length} tables:\n  - ${tables.join('\n  - ')}\n`);

  const [columnsByTable, constraintsByTable, indexesByTable] = await Promise.all([
    fetchColumns(),
    fetchConstraints(),
    fetchIndexes(),
  ]);

  const { order, hasCycle, deps } = buildDependencyGraph(tables, constraintsByTable);

  console.log('=== Suggested dependency order (FK-based, parents first) ===');
  console.log(
    hasCycle
      ? '(Graph has cycles; order is partial and some join tables may be interdependent)'
      : '(Acyclic FK graph)'
  );
  console.log(order.join(' -> '));
  console.log('\n');

  for (const table of tables) {
    console.log('------------------------------------------------------------');
    console.log(`TABLE: ${table}`);

    const cols = columnsByTable[table] || [];
    console.log('\n  Columns:');
    cols.forEach((c) => {
      console.log(
        `    - ${c.column_name} ${c.data_type}` +
          ` ${c.is_nullable === 'NO' ? 'NOT NULL' : ''}` +
          (c.column_default ? ` DEFAULT ${c.column_default}` : '')
      );
    });

    const cons = constraintsByTable[table] || [];
    const pks = cons.filter((c) => c.constraint_type === 'PRIMARY KEY');
    const fks = cons.filter((c) => c.constraint_type === 'FOREIGN KEY');
    const uniques = cons.filter((c) => c.constraint_type === 'UNIQUE');

    console.log('\n  Primary Keys:');
    if (pks.length === 0) {
      console.log('    (none)');
    } else {
      const byName = {};
      for (const c of pks) {
        if (!byName[c.constraint_name]) byName[c.constraint_name] = [];
        if (c.column_name) byName[c.constraint_name].push(c.column_name);
      }
      for (const [name, colsArr] of Object.entries(byName)) {
        console.log(`    - ${name}: (${colsArr.join(', ')})`);
      }
    }

    console.log('\n  Foreign Keys:');
    if (fks.length === 0) {
      console.log('    (none)');
    } else {
      const byName = {};
      for (const c of fks) {
        if (!byName[c.constraint_name]) byName[c.constraint_name] = [];
        byName[c.constraint_name].push(c);
      }
      for (const [name, parts] of Object.entries(byName)) {
        const colsLocal = parts.map((p) => p.column_name).filter(Boolean);
        const refTable = parts[0].foreign_table_name;
        const colsRef = parts.map((p) => p.foreign_column_name).filter(Boolean);
        console.log(
          `    - ${name}: (${colsLocal.join(', ')}) -> ${refTable} (${colsRef.join(', ')})`
        );
      }
    }

    console.log('\n  Unique Constraints:');
    if (uniques.length === 0) {
      console.log('    (none)');
    } else {
      const byName = {};
      for (const c of uniques) {
        if (!byName[c.constraint_name]) byName[c.constraint_name] = [];
        if (c.column_name) byName[c.constraint_name].push(c.column_name);
      }
      for (const [name, colsArr] of Object.entries(byName)) {
        console.log(`    - ${name}: (${colsArr.join(', ')})`);
      }
    }

    console.log('\n  Indexes:');
    const idxs = indexesByTable[table] || [];
    if (idxs.length === 0) {
      console.log('    (none)');
    } else {
      idxs.forEach((idx) => {
        console.log(`    - ${idx.indexname}: ${idx.indexdef}`);
      });
    }

    const fkDeps = Array.from(deps[table] || []);
    if (fkDeps.length > 0) {
      console.log('\n  Depends on (via FK):');
      fkDeps.forEach((t) => console.log(`    - ${t}`));
    }

    console.log('\n');
  }

  console.log('=== Schema analysis complete ===');
}

analyze()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Schema analysis failed:', err);
    process.exit(1);
  });

