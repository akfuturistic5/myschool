const { Pool } = require('pg');
require('dotenv').config();

if (!process.env.DB_PASSWORD) {
  throw new Error('DB_PASSWORD is required to run this script');
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'schooldb',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});


async function analyzeStudentsTable() {
  try {
    console.log('🔍 Analyzing students table structure...\n');

    // Get students table columns
    const studentsColumns = await pool.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'students' 
      ORDER BY ordinal_position
    `);

    console.log('📋 Students Table Columns:');
    console.log('========================');
    studentsColumns.rows.forEach(col => {
      console.log(`${col.column_name} (${col.data_type}) - Nullable: ${col.is_nullable}`);
    });

    // Get classes table columns
    const classesColumns = await pool.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'classes' 
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Classes Table Columns:');
    console.log('========================');
    classesColumns.rows.forEach(col => {
      console.log(`${col.column_name} (${col.data_type}) - Nullable: ${col.is_nullable}`);
    });

    // Get sections table columns
    const sectionsColumns = await pool.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'sections' 
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Sections Table Columns:');
    console.log('========================');
    sectionsColumns.rows.forEach(col => {
      console.log(`${col.column_name} (${col.data_type}) - Nullable: ${col.is_nullable}`);
    });

    // Check foreign key relationships
    const foreignKeys = await pool.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'students'
    `);

    console.log('\n🔗 Foreign Key Relationships:');
    console.log('============================');
    foreignKeys.rows.forEach(fk => {
      console.log(`${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    });

    // Sample data from students table
    const sampleStudents = await pool.query(`
      SELECT * FROM students LIMIT 3
    `);

    console.log('\n📊 Sample Students Data:');
    console.log('========================');
    sampleStudents.rows.forEach((student, index) => {
      console.log(`\nStudent ${index + 1}:`);
      Object.entries(student).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    });

    // Test join with classes and sections
    const joinedData = await pool.query(`
      SELECT 
        s.id,
        s.admission_number,
        s.first_name,
        s.last_name,
        s.roll_number,
        s.gender,
        s.admission_date,
        s.photo_url,
        s.class_id,
        s.section_id,
        c.class_name,
        sec.section_name
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      LIMIT 3
    `);

    console.log('\n🔗 Joined Data (Students + Classes + Sections):');
    console.log('=============================================');
    joinedData.rows.forEach((row, index) => {
      console.log(`\nJoined Student ${index + 1}:`);
      Object.entries(row).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    });

  } catch (error) {
    console.error('❌ Error analyzing students table:', error);
  } finally {
    await pool.end();
  }
}

analyzeStudentsTable();
