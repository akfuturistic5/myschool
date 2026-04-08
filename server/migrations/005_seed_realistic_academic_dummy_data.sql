-- =============================================================================
-- Migration: 005_seed_realistic_academic_dummy_data.sql
-- Purpose:
--   Seed realistic, linked dummy data for testing with these targets:
--   - 1 current academic year dataset
--   - 3 classes
--   - 3 sections in each class
--   - 5 students in each section (45 students)
--   - subjects, student users, parents, guardians, addresses fully linked
--   - existing teachers are assigned into seeded sections (up to 2 sections each)
--
-- Notes:
--   - Idempotent: uses deterministic codes and NOT EXISTS checks.
--   - Uses existing schema as-is (users/students/parents/guardians/addresses/etc).
--   - Safe for pgAdmin execution (single SQL file).
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_teacher_role_id INTEGER;
  v_student_role_id INTEGER;
  v_parent_role_id INTEGER;
  v_guardian_role_id INTEGER;
  v_current_ay_id INTEGER;
  v_primary_dept_id INTEGER;
  v_primary_desig_id INTEGER;
  v_blood_group_id INTEGER;
  v_religion_id INTEGER;
  v_cast_id INTEGER;
  v_mother_tongue_id INTEGER;
BEGIN
  -- ---------------------------------------------------------------------------
  -- 1) Resolve required role ids
  -- ---------------------------------------------------------------------------
  SELECT id INTO v_teacher_role_id FROM user_roles WHERE lower(role_name) = 'teacher' LIMIT 1;
  SELECT id INTO v_student_role_id FROM user_roles WHERE lower(role_name) = 'student' LIMIT 1;
  SELECT id INTO v_parent_role_id  FROM user_roles WHERE lower(role_name) = 'parent'  LIMIT 1;
  SELECT id INTO v_guardian_role_id FROM user_roles WHERE lower(role_name) = 'guardian' LIMIT 1;

  IF v_teacher_role_id IS NULL OR v_student_role_id IS NULL OR v_parent_role_id IS NULL THEN
    RAISE EXCEPTION 'Required role(s) missing in user_roles. Expected teacher/student/parent.';
  END IF;

  -- ---------------------------------------------------------------------------
  -- 2) Ensure lookup/master rows needed by student profile columns
  -- ---------------------------------------------------------------------------
  INSERT INTO blood_groups (blood_group, description, is_active)
  SELECT 'B+', 'B Positive', true
  WHERE NOT EXISTS (SELECT 1 FROM blood_groups WHERE blood_group = 'B+');

  INSERT INTO religions (religion_name, description, is_active)
  SELECT 'Islam', 'Islam religion', true
  WHERE NOT EXISTS (SELECT 1 FROM religions WHERE religion_name = 'Islam');

  SELECT id INTO v_religion_id FROM religions WHERE religion_name = 'Islam' LIMIT 1;

  INSERT INTO casts (cast_name, religion_id, description, is_active)
  SELECT 'Sunni', v_religion_id, 'Sunni community', true
  WHERE NOT EXISTS (SELECT 1 FROM casts WHERE cast_name = 'Sunni');

  INSERT INTO mother_tongues (language_name, language_code, description, is_active)
  SELECT 'Urdu', 'UR', 'Urdu language', true
  WHERE NOT EXISTS (SELECT 1 FROM mother_tongues WHERE language_name = 'Urdu');

  INSERT INTO houses (house_name, house_color, house_captain, description, is_active)
  SELECT 'Falcon House', '#1E3A8A', 'Ayaan Khan', 'Performance and discipline house', true
  WHERE NOT EXISTS (SELECT 1 FROM houses WHERE house_name = 'Falcon House');

  INSERT INTO languages (language_name, language_code, is_compulsory, description, is_active)
  SELECT 'English', 'EN', true, 'Instruction language', true
  WHERE NOT EXISTS (SELECT 1 FROM languages WHERE language_name = 'English');

  INSERT INTO languages (language_name, language_code, is_compulsory, description, is_active)
  SELECT 'Hindi', 'HI', true, 'Second language', true
  WHERE NOT EXISTS (SELECT 1 FROM languages WHERE language_name = 'Hindi');

  -- ---------------------------------------------------------------------------
  -- 3) Resolve ids used in seeding
  -- ---------------------------------------------------------------------------
  SELECT id INTO v_current_ay_id
  FROM academic_years
  WHERE is_current = true
  ORDER BY id DESC
  LIMIT 1;

  IF v_current_ay_id IS NULL THEN
    SELECT id INTO v_current_ay_id FROM academic_years ORDER BY id DESC LIMIT 1;
  END IF;

  IF v_current_ay_id IS NULL THEN
    RAISE EXCEPTION 'No academic year found. Add at least one row in academic_years first.';
  END IF;

  SELECT id INTO v_primary_dept_id
  FROM departments
  WHERE lower(department_name) LIKE '%primary%'
  ORDER BY id
  LIMIT 1;

  IF v_primary_dept_id IS NULL THEN
    SELECT id INTO v_primary_dept_id FROM departments ORDER BY id LIMIT 1;
  END IF;

  SELECT id INTO v_primary_desig_id
  FROM designations
  WHERE lower(designation_name) LIKE '%teacher%'
  ORDER BY id
  LIMIT 1;

  IF v_primary_desig_id IS NULL THEN
    SELECT id INTO v_primary_desig_id FROM designations ORDER BY id LIMIT 1;
  END IF;

  SELECT id INTO v_blood_group_id FROM blood_groups WHERE blood_group = 'B+' LIMIT 1;
  SELECT id INTO v_cast_id FROM casts WHERE cast_name = 'Sunni' LIMIT 1;
  SELECT id INTO v_mother_tongue_id FROM mother_tongues WHERE language_name = 'Urdu' LIMIT 1;

  -- ---------------------------------------------------------------------------
  -- 4) Ensure 3 classes for current academic year
  -- ---------------------------------------------------------------------------
  INSERT INTO classes (
    class_name, class_code, academic_year_id, class_teacher_id, max_students,
    class_fee, description, is_active, no_of_students
  )
  SELECT
    s.class_name,
    s.class_code,
    v_current_ay_id,
    NULL,
    40,
    s.class_fee,
    s.description,
    true,
    0
  FROM (
    VALUES
      ('Class 1', 'DMY-AY-C1', 24000.00::numeric, 'Foundational class for current academic year'),
      ('Class 2', 'DMY-AY-C2', 26000.00::numeric, 'Progressive class for current academic year'),
      ('Class 3', 'DMY-AY-C3', 28000.00::numeric, 'Senior primary class for current academic year')
  ) AS s(class_name, class_code, class_fee, description)
  WHERE NOT EXISTS (
    SELECT 1 FROM classes c WHERE c.class_code = s.class_code
  );

  -- ---------------------------------------------------------------------------
  -- 5) Ensure 3 sections per seeded class (Aurum, Cedar, Maple)
  -- ---------------------------------------------------------------------------
  INSERT INTO sections (
    section_name, class_id, section_teacher_id, max_students, room_number,
    description, is_active, no_of_students
  )
  SELECT
    sec.section_name,
    c.id,
    NULL,
    35,
    sec.room_number,
    sec.description,
    true,
    0
  FROM classes c
  CROSS JOIN (
    VALUES
      ('Aurum', 'R-101', 'Aurum learning section'),
      ('Cedar', 'R-102', 'Cedar learning section'),
      ('Maple', 'R-103', 'Maple learning section')
  ) AS sec(section_name, room_number, description)
  WHERE c.class_code IN ('DMY-AY-C1', 'DMY-AY-C2', 'DMY-AY-C3')
    AND NOT EXISTS (
      SELECT 1
      FROM sections s
      WHERE s.class_id = c.id
        AND s.section_name = sec.section_name
    );

  -- ---------------------------------------------------------------------------
  -- 6) Ensure realistic subjects for each seeded class
  -- ---------------------------------------------------------------------------
  INSERT INTO subjects (
    subject_name, subject_code, class_id, teacher_id,
    theory_hours, practical_hours, total_marks, passing_marks,
    description, is_active
  )
  WITH teacher_pool AS (
    SELECT
      t.staff_id,
      ROW_NUMBER() OVER (ORDER BY t.id) AS teacher_rank
    FROM teachers t
    WHERE t.staff_id IS NOT NULL
  ),
  teacher_meta AS (
    SELECT COUNT(*)::int AS teacher_count FROM teacher_pool
  ),
  src AS (
    SELECT
      c.id AS class_id,
      tp.staff_id AS teacher_staff_id,
      sub.subject_name,
      ('D' || v_current_ay_id || replace(c.class_code, 'DMY-AY-', '') || sub.subject_short) AS subject_code,
      sub.theory_hours,
      sub.practical_hours,
      sub.description
    FROM classes c
    CROSS JOIN (
      VALUES
        ('English', 'ENG', 5, 0, 'Language and communication'),
        ('Mathematics', 'MTH', 5, 0, 'Numerical and logical thinking'),
        ('Environmental Studies', 'EVS', 4, 1, 'Awareness of environment and society'),
        ('Computer Science', 'CSC', 3, 2, 'Digital literacy and computing basics'),
        ('General Knowledge', 'GK', 2, 0, 'Current affairs and broad awareness')
    ) AS sub(subject_name, subject_short, theory_hours, practical_hours, description)
    LEFT JOIN teacher_meta tm ON true
    LEFT JOIN teacher_pool tp
      ON tp.teacher_rank = CASE
        WHEN COALESCE(tm.teacher_count, 0) = 0 THEN NULL
        ELSE ((ASCII(sub.subject_short) % tm.teacher_count) + 1)
      END
    WHERE c.class_code IN ('DMY-AY-C1', 'DMY-AY-C2', 'DMY-AY-C3')
  )
  SELECT
    src.subject_name,
    src.subject_code,
    src.class_id,
    src.teacher_staff_id,
    src.theory_hours,
    src.practical_hours,
    100,
    35,
    src.description,
    true
  FROM src
  WHERE NOT EXISTS (
    SELECT 1 FROM subjects s WHERE s.subject_code = src.subject_code
  );

  -- ---------------------------------------------------------------------------
  -- 7) Assign seeded sections to existing teachers (target: up to 2 each)
  -- ---------------------------------------------------------------------------
  UPDATE sections s
  SET section_teacher_id = NULL
  WHERE s.section_teacher_id IN (
    SELECT staff_id FROM teachers WHERE staff_id IS NOT NULL
  );

  WITH teacher_pool AS (
    SELECT t.id AS teacher_id, t.staff_id, ROW_NUMBER() OVER (ORDER BY t.id) AS teacher_rank
    FROM teachers t
    WHERE t.staff_id IS NOT NULL
  ),
  section_pool AS (
    SELECT
      s.id AS section_id,
      ROW_NUMBER() OVER (ORDER BY c.class_code, s.section_name) AS section_rank
    FROM sections s
    JOIN classes c ON c.id = s.class_id
    WHERE c.class_code IN ('DMY-AY-C1', 'DMY-AY-C2', 'DMY-AY-C3')
  ),
  mapped AS (
    SELECT
      sp.section_id,
      tp.staff_id
    FROM section_pool sp
    JOIN teacher_pool tp
      ON tp.teacher_rank = ((sp.section_rank - 1) / 2) + 1
  )
  UPDATE sections s
  SET section_teacher_id = m.staff_id
  FROM mapped m
  WHERE s.id = m.section_id
    AND (s.section_teacher_id IS DISTINCT FROM m.staff_id);

  -- ---------------------------------------------------------------------------
  -- 8) Prepare deterministic 45-student dataset (5 per section x 9 sections)
  -- ---------------------------------------------------------------------------
  CREATE TEMP TABLE tmp_seed_students (
    seq_no INTEGER,
    class_id INTEGER,
    section_id INTEGER,
    academic_year_id INTEGER,
    first_name TEXT,
    last_name TEXT,
    gender TEXT,
    admission_number TEXT,
    roll_number TEXT,
    username TEXT,
    email TEXT,
    unique_student_ids TEXT,
    pen_number TEXT,
    aadhar_no TEXT,
    gr_number TEXT
  ) ON COMMIT DROP;

  WITH seeded_sections AS (
    SELECT
      s.id AS section_id,
      c.id AS class_id,
      c.class_code,
      ROW_NUMBER() OVER (ORDER BY c.class_code, s.section_name) AS section_seq
    FROM sections s
    JOIN classes c ON c.id = s.class_id
    WHERE c.class_code IN ('DMY-AY-C1', 'DMY-AY-C2', 'DMY-AY-C3')
  ),
  expanded AS (
    SELECT
      ss.class_id,
      ss.section_id,
      ss.section_seq,
      gs.student_slot,
      ((ss.section_seq - 1) * 5 + gs.student_slot) AS seq_no
    FROM seeded_sections ss
    CROSS JOIN LATERAL generate_series(1, 5) AS gs(student_slot)
  )
  INSERT INTO tmp_seed_students (
    seq_no, class_id, section_id, academic_year_id, first_name, last_name, gender,
    admission_number, roll_number, username, email, unique_student_ids, pen_number, aadhar_no, gr_number
  )
  SELECT
    e.seq_no,
    e.class_id,
    e.section_id,
    v_current_ay_id,
    (ARRAY[
      'Ayaan','Vihaan','Reyansh','Arjun','Ishaan','Kabir','Advik','Sai','Devansh','Rudra',
      'Zayan','Aarav','Laksh','Krish','Yuvraj','Anaya','Myra','Aadhya','Saanvi','Kiara',
      'Fatima','Aisha','Inaya','Sara','Zoya','Meher','Anvi','Riya','Naina','Tara',
      'Prisha','Siya','Pari','Navya','Riddhi','Hridya','Mahir','Shaurya','Dhruv','Rayan',
      'Arnav','Nivaan','Samaira','Misha','Alina'
    ])[e.seq_no],
    (ARRAY[
      'Khan','Sharma','Patel','Ansari','Mishra','Verma','Singh','Qureshi','Shaikh','Gupta',
      'Naqvi','Malik','Rao','Joshi','Kulkarni','Deshmukh','Chopra','Siddiqui','Nair','Menon',
      'Pathan','Bano','Rahman','Iqbal','Hussain','Tiwari','Yadav','Jain','Kapoor','Bhatt',
      'Pillai','Thomas','Dutta','Saxena','Trivedi','Chauhan','Bhardwaj','Srivastava','Farooqui','Kazi',
      'Gandhi','Parekh','Reddy','Lodhi','Basu'
    ])[e.seq_no],
    CASE WHEN (e.seq_no % 2) = 0 THEN 'female' ELSE 'male' END,
    ('ADM-AY' || v_current_ay_id || '-' || LPAD(e.seq_no::text, 3, '0')),
    ('R-' || LPAD(e.seq_no::text, 3, '0')),
    ('stu_ay' || v_current_ay_id || '_' || LPAD(e.seq_no::text, 3, '0')),
    ('student.ay' || v_current_ay_id || '.' || LPAD(e.seq_no::text, 3, '0') || '@myschool.local'),
    ('UID-AY' || v_current_ay_id || '-' || LPAD(e.seq_no::text, 5, '0')),
    ('PEN' || v_current_ay_id || LPAD(e.seq_no::text, 7, '0')),
    ('9' || LPAD(v_current_ay_id::text, 2, '0') || LPAD(e.seq_no::text, 9, '0')),
    ('GR-AY' || v_current_ay_id || '-' || LPAD(e.seq_no::text, 4, '0'))
  FROM expanded e
  ORDER BY e.seq_no;

  -- ---------------------------------------------------------------------------
  -- 9) Create student login users (all mandatory users columns filled)
  -- ---------------------------------------------------------------------------
  INSERT INTO users (
    username, email, password_hash, role_id,
    first_name, last_name, phone, is_active,
    current_address, permanent_address, avatar
  )
  SELECT
    t.username,
    t.email,
    '$2a$10$4f8x7Qw5l8VvM1xJ8Nf2oOGS5YQ7s8XQ5QJfS2f4v9m5XvF2aR9VO',
    v_student_role_id,
    t.first_name,
    t.last_name,
    ('98' || LPAD(t.seq_no::text, 8, '0')),
    true,
    ('Flat ' || t.seq_no || ', Green Residency, Civil Lines'),
    ('Village Road ' || t.seq_no || ', District Campus Area'),
    ('https://api.dicebear.com/8.x/adventurer/svg?seed=' || replace(t.first_name, ' ', ''))
  FROM tmp_seed_students t
  WHERE NOT EXISTS (
    SELECT 1 FROM users u WHERE u.username = t.username
  );

  -- ---------------------------------------------------------------------------
  -- 10) Create student core rows (all required + important optional columns filled)
  -- ---------------------------------------------------------------------------
  INSERT INTO students (
    user_id, admission_number, roll_number, first_name, last_name, gender,
    date_of_birth, place_of_birth, blood_group_id, religion_id, cast_id, mother_tongue_id,
    nationality, phone, email, address, academic_year_id, class_id, section_id, house_id,
    admission_date, previous_school, photo_url, is_transport_required, is_hostel_required, is_active,
    bank_name, branch, ifsc, known_allergies, medications, sibiling_1, sibiling_2,
    sibiling_1_class, sibiling_2_class, previous_school_address, medical_condition,
    other_information, vehicle_number, current_address, permanent_address,
    unique_student_ids, pen_number, aadhar_no, gr_number
  )
  SELECT
    u.id,
    t.admission_number,
    t.roll_number,
    t.first_name,
    t.last_name,
    t.gender,
    (DATE '2017-04-01' + ((t.seq_no % 120) * INTERVAL '1 day'))::date,
    'Mumbai',
    v_blood_group_id,
    v_religion_id,
    v_cast_id,
    v_mother_tongue_id,
    'Indian',
    ('98' || LPAD(t.seq_no::text, 8, '0')),
    t.email,
    ('Flat ' || t.seq_no || ', Green Residency, Civil Lines'),
    t.academic_year_id,
    t.class_id,
    t.section_id,
    (SELECT id FROM houses WHERE house_name = 'Falcon House' LIMIT 1),
    CURRENT_DATE - INTERVAL '45 days',
    'Bright Future Public School',
    ('https://api.dicebear.com/8.x/initials/svg?seed=' || replace(t.first_name || t.last_name, ' ', '')),
    false,
    false,
    true,
    'State Bank of India',
    'Central Branch',
    'SBIN0001234',
    'None',
    'None',
    'Not Applicable',
    'Not Applicable',
    'N/A',
    'N/A',
    'Old Town Road, Mumbai',
    'No chronic condition',
    'Participates in co-curricular activities',
    ('MH01AB' || LPAD(t.seq_no::text, 4, '0')),
    ('Flat ' || t.seq_no || ', Green Residency, Civil Lines'),
    ('Village Road ' || t.seq_no || ', District Campus Area'),
    t.unique_student_ids,
    t.pen_number,
    t.aadhar_no,
    t.gr_number
  FROM tmp_seed_students t
  JOIN users u ON u.username = t.username
  WHERE NOT EXISTS (
    SELECT 1 FROM students s WHERE s.admission_number = t.admission_number
  );

  -- ---------------------------------------------------------------------------
  -- 11) Student addresses table + FK wiring (students.address_id, addresses.person_id)
  -- ---------------------------------------------------------------------------
  INSERT INTO addresses (current_address, permanent_address, user_id, role_id, person_id)
  SELECT
    s.current_address,
    s.permanent_address,
    u.id,
    v_student_role_id,
    s.id
  FROM students s
  JOIN users u ON u.id = s.user_id
  WHERE s.admission_number LIKE ('ADM-AY' || v_current_ay_id || '-%')
    AND NOT EXISTS (
      SELECT 1 FROM addresses a
      WHERE a.user_id = u.id
        AND a.role_id = v_student_role_id
    );

  UPDATE students s
  SET address_id = a.id
  FROM addresses a
  WHERE s.user_id = a.user_id
    AND a.role_id = v_student_role_id
    AND s.admission_number LIKE ('ADM-AY' || v_current_ay_id || '-%')
    AND (s.address_id IS NULL OR s.address_id <> a.id);

  -- ---------------------------------------------------------------------------
  -- 12) Parent users (father + mother) for each seeded student
  -- ---------------------------------------------------------------------------
  INSERT INTO users (
    username, email, password_hash, role_id,
    first_name, last_name, phone, is_active,
    current_address, permanent_address, avatar
  )
  SELECT
    'father_' || lower(replace(s.admission_number, '-', '_')),
    lower(replace(s.admission_number, '-', '.')) || '.father@myschool.local',
    '$2a$10$4f8x7Qw5l8VvM1xJ8Nf2oOGS5YQ7s8XQ5QJfS2f4v9m5XvF2aR9VO',
    v_parent_role_id,
    'Imran',
    (s.last_name || ' Sr'),
    ('97' || LPAD(s.id::text, 8, '0')),
    true,
    s.current_address,
    s.permanent_address,
    'https://api.dicebear.com/8.x/avataaars/svg?seed=father'
  FROM students s
  WHERE s.admission_number LIKE ('ADM-AY' || v_current_ay_id || '-%')
    AND NOT EXISTS (
      SELECT 1 FROM users u WHERE u.username = 'father_' || lower(replace(s.admission_number, '-', '_'))
    );

  INSERT INTO users (
    username, email, password_hash, role_id,
    first_name, last_name, phone, is_active,
    current_address, permanent_address, avatar
  )
  SELECT
    'mother_' || lower(replace(s.admission_number, '-', '_')),
    lower(replace(s.admission_number, '-', '.')) || '.mother@myschool.local',
    '$2a$10$4f8x7Qw5l8VvM1xJ8Nf2oOGS5YQ7s8XQ5QJfS2f4v9m5XvF2aR9VO',
    v_parent_role_id,
    'Sana',
    (s.last_name || ' Sr'),
    ('96' || LPAD(s.id::text, 8, '0')),
    true,
    s.current_address,
    s.permanent_address,
    'https://api.dicebear.com/8.x/avataaars/svg?seed=mother'
  FROM students s
  WHERE s.admission_number LIKE ('ADM-AY' || v_current_ay_id || '-%')
    AND NOT EXISTS (
      SELECT 1 FROM users u WHERE u.username = 'mother_' || lower(replace(s.admission_number, '-', '_'))
    );

  -- ---------------------------------------------------------------------------
  -- 13) Parents table rows + link to students.parent_id
  -- ---------------------------------------------------------------------------
  INSERT INTO parents (
    student_id, father_name, father_email, father_phone, father_occupation, father_image_url,
    mother_name, mother_email, mother_phone, mother_occupation, mother_image_url,
    user_id, father_user_id, mother_user_id
  )
  SELECT
    s.id,
    ('Imran ' || s.last_name),
    fu.email,
    fu.phone,
    'Business Owner',
    'https://api.dicebear.com/8.x/avataaars/svg?seed=imran' || s.id,
    ('Sana ' || s.last_name),
    mu.email,
    mu.phone,
    'Teacher',
    'https://api.dicebear.com/8.x/avataaars/svg?seed=sana' || s.id,
    fu.id,
    fu.id,
    mu.id
  FROM students s
  JOIN users fu ON fu.username = 'father_' || lower(replace(s.admission_number, '-', '_'))
  JOIN users mu ON mu.username = 'mother_' || lower(replace(s.admission_number, '-', '_'))
  WHERE s.admission_number LIKE ('ADM-AY' || v_current_ay_id || '-%')
    AND NOT EXISTS (
      SELECT 1 FROM parents p WHERE p.student_id = s.id
    );

  UPDATE students s
  SET parent_id = p.id
  FROM parents p
  WHERE p.student_id = s.id
    AND s.admission_number LIKE ('ADM-AY' || v_current_ay_id || '-%')
    AND (s.parent_id IS NULL OR s.parent_id <> p.id);

  -- ---------------------------------------------------------------------------
  -- 14) Guardian users + guardians table + link students.guardian_id
  -- ---------------------------------------------------------------------------
  IF v_guardian_role_id IS NOT NULL THEN
    INSERT INTO users (
      username, email, password_hash, role_id,
      first_name, last_name, phone, is_active,
      current_address, permanent_address, avatar
    )
    SELECT
      'guardian_' || lower(replace(s.admission_number, '-', '_')),
      lower(replace(s.admission_number, '-', '.')) || '.guardian@myschool.local',
      '$2a$10$4f8x7Qw5l8VvM1xJ8Nf2oOGS5YQ7s8XQ5QJfS2f4v9m5XvF2aR9VO',
      v_guardian_role_id,
      'Rafiq',
      (s.last_name || ' Uncle'),
      ('95' || LPAD(s.id::text, 8, '0')),
      true,
      s.current_address,
      s.permanent_address,
      'https://api.dicebear.com/8.x/avataaars/svg?seed=guardian'
    FROM students s
    WHERE s.admission_number LIKE ('ADM-AY' || v_current_ay_id || '-%')
      AND NOT EXISTS (
        SELECT 1 FROM users u WHERE u.username = 'guardian_' || lower(replace(s.admission_number, '-', '_'))
      );

    INSERT INTO guardians (
      student_id, guardian_type, first_name, last_name, relation, occupation,
      phone, email, address, office_address, annual_income,
      is_primary_contact, is_emergency_contact, is_active, user_id
    )
    SELECT
      s.id,
      'guardian',
      'Rafiq',
      s.last_name,
      'Uncle',
      'Supervisor',
      gu.phone,
      gu.email,
      s.current_address,
      'Industrial Area, Mumbai',
      420000.00,
      false,
      true,
      true,
      gu.id
    FROM students s
    JOIN users gu ON gu.username = 'guardian_' || lower(replace(s.admission_number, '-', '_'))
    WHERE s.admission_number LIKE ('ADM-AY' || v_current_ay_id || '-%')
      AND NOT EXISTS (
        SELECT 1 FROM guardians g WHERE g.student_id = s.id
      );

    UPDATE students s
    SET guardian_id = g.id
    FROM guardians g
    WHERE g.student_id = s.id
      AND s.admission_number LIKE ('ADM-AY' || v_current_ay_id || '-%')
      AND (s.guardian_id IS NULL OR s.guardian_id <> g.id);
  END IF;

  -- ---------------------------------------------------------------------------
  -- 15) Update class/section headcount fields for seeded structures
  -- ---------------------------------------------------------------------------
  UPDATE sections s
  SET no_of_students = COALESCE(x.cnt, 0)
  FROM (
    SELECT section_id, COUNT(*)::int AS cnt
    FROM students
    WHERE section_id IS NOT NULL
    GROUP BY section_id
  ) x
  WHERE s.id = x.section_id
    AND s.id IN (
      SELECT s2.id
      FROM sections s2
      JOIN classes c2 ON c2.id = s2.class_id
      WHERE c2.class_code IN ('DMY-AY-C1', 'DMY-AY-C2', 'DMY-AY-C3')
    );

  UPDATE classes c
  SET no_of_students = COALESCE(x.cnt, 0)
  FROM (
    SELECT class_id, COUNT(*)::int AS cnt
    FROM students
    WHERE class_id IS NOT NULL
    GROUP BY class_id
  ) x
  WHERE c.id = x.class_id
    AND c.class_code IN ('DMY-AY-C1', 'DMY-AY-C2', 'DMY-AY-C3');

  -- ---------------------------------------------------------------------------
  -- 16) Optional: enrich existing teachers record with class/subject mappings
  -- ---------------------------------------------------------------------------
  UPDATE teachers t
  SET
    class_id = m.class_id,
    subject_id = m.subject_id,
    blood_group = COALESCE(NULLIF(t.blood_group, ''), 'B+'),
    contract_type = COALESCE(t.contract_type, 'Permanent'),
    shift = COALESCE(t.shift, 'Morning'),
    work_location = COALESCE(t.work_location, 'Main Campus'),
    bank_name = COALESCE(t.bank_name, 'State Bank of India'),
    branch = COALESCE(t.branch, 'Central Branch'),
    ifsc = COALESCE(t.ifsc, 'SBIN0001234'),
    current_address = COALESCE(t.current_address, 'Faculty Block, Main Campus'),
    permanent_address = COALESCE(t.permanent_address, 'Hometown Address'),
    modified_at = NOW()
  FROM (
    SELECT
      t2.id AS teacher_id,
      c.id AS class_id,
      (
        SELECT s.id
        FROM subjects s
        WHERE s.class_id = c.id
        ORDER BY s.id
        LIMIT 1
      ) AS subject_id
    FROM teachers t2
    JOIN sections sec ON sec.section_teacher_id = t2.staff_id
    JOIN classes c ON c.id = sec.class_id
    WHERE c.class_code IN ('DMY-AY-C1', 'DMY-AY-C2', 'DMY-AY-C3')
    GROUP BY t2.id, c.id
  ) m
  WHERE t.id = m.teacher_id
    AND m.subject_id IS NOT NULL;

END $$;

COMMIT;
