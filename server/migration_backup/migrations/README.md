# Database migrations

## Error in pgAdmin: `syntax error at or near "2"` (or similar on COPY lines)

The file `001_init_full_schema.sql` is a **pg_dump-style** script. The tenant part contains:

```sql
COPY public.some_table (...) FROM stdin;
<tab-separated data lines>
\.
```

**pgAdmin (and most GUI “Query” tools) do not execute this as one statement.** They run `COPY` alone, then try to run each data line as SQL → you see an error on the first column of the first data row.

### What to use instead

1. **Recommended:** from the `server` folder, with PostgreSQL running and `.env` set (`DB_USER`, `DB_PASSWORD`, etc.):

   ```bash
   npm run db:init
   ```

   Master DDL runs via Node (`pg`). The tenant section is applied with **`psql -f`** (embedded `COPY ... FROM stdin` does not work through `node-pg`). Install PostgreSQL and put `psql` on `PATH`, or set **`PSQL_PATH`** to `psql.exe` (e.g. `C:\Program Files\PostgreSQL\18\bin\psql.exe`).

   Fresh tenant DB after a failed run: `npm run db:init:reset` (drops and recreates the tenant database name from `TENANT_INIT_DB_NAME` / `DB_NAME`).

2. **`psql` only:** Split at the banner before `-- === TENANT_SCHEMA_BEGIN ===` (see `001_init_full_schema.sql`): run the part **before** it on `master_db`, then the part **after** on your tenant DB. Or use `scripts/run-init-psql.ps1`.

3. **pgAdmin — master only:** You may paste and execute **only** the block from the top of the file down to (but not including) the line with `=== TENANT_SCHEMA_BEGIN ===`. Do **not** run the rest in pgAdmin.

### After init (optional)

- Sample schools in master: `node init-master-database.js`
- Super admin: `node scripts/create-default-super-admin.js` (see script comments)

### Legacy patches

Older SQL files are under `migrations/archive/legacy/` and are not required if you use `001_init_full_schema.sql`.
