/**
 * One-time migration: parents + parent_persons → users; slim guardians (user_id only).
 *
 * From server/:  node scripts/migrate-unify-parents-guardians.js
 * BACKUP the database first.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../src/config/roles');
const { createParentIndividualUser, createGuardianUser } = require('../src/utils/createPersonUser');

function poolFromEnv() {
  if (process.env.DATABASE_URL) {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : { rejectUnauthorized: false },
    });
  }
  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'school_db',
  });
}

async function columnExists(client, table, col) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, col]
  );
  return r.rows.length > 0;
}

async function tableExists(client, name) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [name]
  );
  return r.rows.length > 0;
}

async function migrate() {
  const pool = poolFromEnv();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS occupation VARCHAR(255)`);

    const hasParents = await tableExists(client, 'parents');
    const hasParentPersons = await tableExists(client, 'parent_persons');
    const guardiansLegacy = await columnExists(client, 'guardians', 'first_name');

    console.log('State:', { hasParents, hasParentPersons, guardiansLegacy });

    if (hasParentPersons) {
      const pps = await client.query(
        `SELECT id, full_name, phone, email, address, occupation FROM parent_persons`
      );
      for (const row of pps.rows) {
        const phone = row.phone ? String(row.phone).trim() : '';
        const email = row.email ? String(row.email).trim().toLowerCase() : '';
        if (!phone && !email) continue;
        const exists = await client.query(
          `SELECT id FROM users WHERE role_id = $1 AND (
            ($2::text <> '' AND regexp_replace(COALESCE(phone,''), '[^0-9]', '', 'g') = regexp_replace($2::text, '[^0-9]', '', 'g'))
            OR ($3::text <> '' AND LOWER(TRIM(COALESCE(email,''))) = $3)
          ) LIMIT 1`,
          [ROLES.PARENT, phone, email]
        );
        if (exists.rows.length) continue;
        const parts = String(row.full_name || '').trim().split(/\s+/);
        const fn = parts[0] || 'Parent';
        const ln = parts.slice(1).join(' ') || '';
        const hash = await bcrypt.hash((phone || '').replace(/\D/g, '') || '123456', 10);
        const uname = `mig.pp.${row.id}`.slice(0, 50);
        await client.query('SAVEPOINT mig_parent_person');
        try {
          await client.query(
            `INSERT INTO users (username, email, phone, password_hash, role_id, first_name, last_name, occupation, current_address, is_active, created_at, modified_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), NOW())`,
            [
              uname,
              email || null,
              phone || null,
              hash,
              ROLES.PARENT,
              fn,
              ln || null,
              row.occupation || null,
              row.address || 'Not Provided',
            ]
          );
        } catch (e) {
          await client.query('ROLLBACK TO SAVEPOINT mig_parent_person');
          if (e.code !== '23505') console.warn('skip parent_persons row', row.id, e.message);
        } finally {
          await client.query('RELEASE SAVEPOINT mig_parent_person');
        }
      }
    }

    if (guardiansLegacy) {
      const gRows = await client.query(
        `SELECT id, student_id, first_name, last_name, phone, email, user_id FROM guardians WHERE user_id IS NULL`
      );
      for (const g of gRows.rows) {
        const phone = (g.phone || '').toString().trim();
        const email = (g.email || '').toString().trim();
        if (!phone && !email) continue;
        await client.query('SAVEPOINT mig_guardian_user');
        let uid;
        try {
          uid = await createGuardianUser(client, {
            first_name: g.first_name || 'Guardian',
            last_name: g.last_name || '',
            phone,
            email: email || null,
          });
        } catch (e) {
          await client.query('ROLLBACK TO SAVEPOINT mig_guardian_user');
          console.warn('skip guardian row', g.id, e.message);
          uid = null;
        } finally {
          await client.query('RELEASE SAVEPOINT mig_guardian_user');
        }
        if (uid) {
          await client.query(`UPDATE guardians SET user_id = $1, modified_at = NOW() WHERE id = $2`, [uid, g.id]);
        }
      }
    }

    if (hasParents && guardiansLegacy) {
      const prs = await client.query(`SELECT * FROM parents`);
      for (const p of prs.rows) {
        await client.query('SAVEPOINT mig_parents_student');
        try {
          const sid = p.student_id;
          let fid = null;
          let mid = null;
          if ((p.father_phone || p.father_email) && p.father_name) {
            fid = await createParentIndividualUser(client, {
              full_name: p.father_name,
              email: p.father_email,
              phone: p.father_phone,
              parent_row_id: p.id,
              side: 'f',
            });
          }
          if ((p.mother_phone || p.mother_email) && p.mother_name) {
            mid = await createParentIndividualUser(client, {
              full_name: p.mother_name,
              email: p.mother_email,
              phone: p.mother_phone,
              parent_row_id: p.id,
              side: 'm',
            });
          }
          await client.query(`DELETE FROM guardians WHERE student_id = $1`, [sid]);
          if (fid) {
            await client.query(
              `INSERT INTO guardians (
                student_id, user_id, guardian_type, relation, is_primary_contact, is_emergency_contact, is_active,
                first_name, last_name, phone, email, address, occupation, created_at, modified_at
              ) VALUES ($1, $2, 'father', 'Father', true, false, true, '', '', '', '', '', '', NOW(), NOW())`,
              [sid, fid]
            );
          }
          if (mid) {
            await client.query(
              `INSERT INTO guardians (
                student_id, user_id, guardian_type, relation, is_primary_contact, is_emergency_contact, is_active,
                first_name, last_name, phone, email, address, occupation, created_at, modified_at
              ) VALUES ($1, $2, 'mother', 'Mother', $3, false, true, '', '', '', '', '', '', NOW(), NOW())`,
              [sid, mid, !fid]
            );
          }
          const gid = fid
            ? (await client.query(`SELECT id FROM guardians WHERE student_id = $1 AND guardian_type = 'father' LIMIT 1`, [sid])).rows[0]?.id
            : mid
              ? (await client.query(`SELECT id FROM guardians WHERE student_id = $1 AND guardian_type = 'mother' LIMIT 1`, [sid])).rows[0]?.id
              : null;
          if (gid) {
            await client.query(`UPDATE students SET guardian_id = $1 WHERE id = $2`, [gid, sid]);
          }
        } catch (e) {
          await client.query('ROLLBACK TO SAVEPOINT mig_parents_student');
          console.warn('skip parents migration row', p.id, e.message);
        } finally {
          await client.query('RELEASE SAVEPOINT mig_parents_student');
        }
      }
    }

    if (guardiansLegacy) {
      console.log('Dropping legacy guardian columns…');
      await client.query(`ALTER TABLE guardians DROP COLUMN IF EXISTS first_name`);
      await client.query(`ALTER TABLE guardians DROP COLUMN IF EXISTS last_name`);
      await client.query(`ALTER TABLE guardians DROP COLUMN IF EXISTS phone`);
      await client.query(`ALTER TABLE guardians DROP COLUMN IF EXISTS email`);
      await client.query(`ALTER TABLE guardians DROP COLUMN IF EXISTS address`);
      await client.query(`ALTER TABLE guardians DROP COLUMN IF EXISTS office_address`);
      await client.query(`ALTER TABLE guardians DROP COLUMN IF EXISTS occupation`);
      await client.query(`ALTER TABLE guardians DROP COLUMN IF EXISTS annual_income`);
    }

    await client.query(`ALTER TABLE guardians ALTER COLUMN user_id SET NOT NULL`).catch(() => {
      console.warn('Note: set NOT NULL on guardians.user_id after fixing null user_id rows.');
    });

    await client.query(`ALTER TABLE students DROP CONSTRAINT IF EXISTS fk_students_parent`);
    await client.query(`ALTER TABLE students DROP COLUMN IF EXISTS parent_id`);
    await client.query(`ALTER TABLE students DROP COLUMN IF EXISTS father_person_id`);
    await client.query(`ALTER TABLE students DROP COLUMN IF EXISTS mother_person_id`);
    await client.query(`ALTER TABLE students DROP COLUMN IF EXISTS guardian_person_id`);

    if (hasParents) {
      await client.query(`DROP TABLE IF EXISTS parents CASCADE`);
    }
    if (hasParentPersons) {
      await client.query(`DROP TABLE IF EXISTS parent_persons CASCADE`);
    }

    await client.query('COMMIT');
    console.log('Migration finished OK.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', e);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
