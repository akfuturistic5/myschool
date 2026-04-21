const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Creating student_siblings table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS student_siblings (
        id SERIAL PRIMARY KEY,
        student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        is_in_same_school BOOLEAN DEFAULT false,
        name TEXT,
        class_name TEXT,
        roll_number TEXT,
        admission_number TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        modified_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('Checking for legacy sibling columns...');
    const colCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'students' 
        AND column_name IN ('sibiling_1', 'sibiling_2', 'sibiling_1_class', 'sibiling_2_class')
    `);

    if (colCheck.rows.length > 0) {
      console.log('Migrating existing sibling data...');
      const students = await client.query(`
        SELECT id, sibiling_1, sibiling_2, sibiling_1_class, sibiling_2_class 
        FROM students 
        WHERE (sibiling_1 IS NOT NULL AND TRIM(sibiling_1) <> '') 
           OR (sibiling_2 IS NOT NULL AND TRIM(sibiling_2) <> '')
      `);

      for (const student of students.rows) {
        if (student.sibiling_1 && student.sibiling_1.trim()) {
          await client.query(`
            INSERT INTO student_siblings (student_id, name, class_name)
            VALUES ($1, $2, $3)
          `, [student.id, student.sibiling_1.trim(), student.sibiling_1_class]);
        }
        if (student.sibiling_2 && student.sibiling_2.trim()) {
          await client.query(`
            INSERT INTO student_siblings (student_id, name, class_name)
            VALUES ($1, $2, $3)
          `, [student.id, student.sibiling_2.trim(), student.sibiling_2_class]);
        }
      }

      console.log('Dropping legacy sibling columns...');
      await client.query(`
        ALTER TABLE students 
        DROP COLUMN IF EXISTS sibiling_1,
        DROP COLUMN IF EXISTS sibiling_2,
        DROP COLUMN IF EXISTS sibiling_1_class,
        DROP COLUMN IF EXISTS sibiling_2_class
      `);
    } else {
      console.log('Legacy columns already removed.');
    }

    await client.query('COMMIT');
    console.log('Migration completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
