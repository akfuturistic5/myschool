-- =============================================================================
-- Migration: 006_reseed_multi_academic_year_dummy_data.sql
-- Purpose:
--   1) Undo the previous seeded dummy dataset created by 005 migration.
--   2) Seed fresh data for EACH academic year:
--      - 3 classes per academic year
--      - 3 sections per class
--      - 5 students per section
--   3) Keep existing teachers and assign up to 2 sections per teacher per year.
--
-- This file is safe to run in pgAdmin.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_teacher_role_id INTEGER;
  v_student_role_id INTEGER;
  v_parent_role_id INTEGER;
  v_guardian_role_id INTEGER;
  v_blood_group_id INTEGER;
  v_religion_id INTEGER;
  v_cast_id INTEGER;
  v_mother_tongue_id INTEGER;
  v_house_id INTEGER;
  v_teacher_count INTEGER;
BEGIN
  -- ---------------------------------------------------------------------------
  -- 0) Resolve required ids
  -- ---------------------------------------------------------------------------
  SELECT id INTO v_teacher_role_id FROM user_roles WHERE lower(role_name) = 'teacher' LIMIT 1;
  SELECT id INTO v_student_role_id FROM user_roles WHERE lower(role_name) = 'student' LIMIT 1;
  SELECT id INTO v_parent_role_id FROM user_roles WHERE lower(role_name) = 'parent' LIMIT 1;
  SELECT id INTO v_guardian_role_id FROM user_roles WHERE lower(role_name) = 'guardian' LIMIT 1;

  IF v_student_role_id IS NULL OR v_parent_role_id IS NULL THEN
    RAISE EXCEPTION 'Required role ids missing in user_roles (student/parent).';
  END IF;

  -- ---------------------------------------------------------------------------
  -- 1) Undo previously seeded dataset (from 005 and this naming convention)
  -- ---------------------------------------------------------------------------
  DELETE FROM guardians g
  USING students s
  WHERE g.student_id = s.id
    AND s.admission_number LIKE 'ADM-AY%';

  DELETE FROM parents p
  USING students s
  WHERE p.student_id = s.id
    AND s.admission_number LIKE 'ADM-AY%';

  DELETE FROM addresses a
  WHERE a.role_id = v_student_role_id
    AND a.user_id IN (
      SELECT u.id
      FROM users u
      WHERE u.username LIKE 'stu_ay%'
    );

  DELETE FROM students
  WHERE admission_number LIKE 'ADM-AY%';

  DELETE FROM users
  WHERE username LIKE 'stu_ay%'
     OR username LIKE 'father_adm_ay%'
     OR username LIKE 'mother_adm_ay%'
     OR username LIKE 'guardian_adm_ay%';

  UPDATE teachers
  SET class_id = NULL,
      subject_id = NULL
  WHERE class_id IN (
      SELECT id FROM classes WHERE class_code LIKE 'DMY-AY%-C_'
    )
     OR subject_id IN (
      SELECT id FROM subjects WHERE subject_code ~ '^D[0-9]+C[123](ENG|MTH|EVS|CSC|GK)$'
    );

  DELETE FROM subjects
  WHERE subject_code ~ '^D[0-9]+C[123](ENG|MTH|EVS|CSC|GK)$';

  DELETE FROM sections s
  USING classes c
  WHERE s.class_id = c.id
    AND c.class_code LIKE 'DMY-AY%-C_'
    AND s.section_name IN ('Aurum', 'Cedar', 'Maple');

  DELETE FROM classes
  WHERE class_code LIKE 'DMY-AY%-C_';

  -- ---------------------------------------------------------------------------
  -- 2) Ensure lookup rows required by students
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

  SELECT id INTO v_blood_group_id FROM blood_groups WHERE blood_group = 'B+' LIMIT 1;
  SELECT id INTO v_cast_id FROM casts WHERE cast_name = 'Sunni' LIMIT 1;
  SELECT id INTO v_mother_tongue_id FROM mother_tongues WHERE language_name = 'Urdu' LIMIT 1;
  SELECT id INTO v_house_id FROM houses WHERE house_name = 'Falcon House' LIMIT 1;

  -- ---------------------------------------------------------------------------
  -- 3) Create 3 classes for EACH academic year
  -- ---------------------------------------------------------------------------
  INSERT INTO classes (
    class_name, class_code, academic_year_id, class_teacher_id,
    max_students, class_fee, description, is_active, no_of_students
  )
  SELECT
    'Class ' || v.class_no,
    'DMY-AY' || ay.id || '-C' || v.class_no,
    ay.id,
    NULL,
    40,
    v.class_fee,
    'Dummy class for academic year ' || ay.year_name,
    true,
    0
  FROM academic_years ay
  CROSS JOIN (
    VALUES
      (1, 24000.00::numeric),
      (2, 26000.00::numeric),
      (3, 28000.00::numeric)
  ) AS v(class_no, class_fee)
  WHERE NOT EXISTS (
    SELECT 1
    FROM classes c
    WHERE c.class_code = 'DMY-AY' || ay.id || '-C' || v.class_no
  );

  -- ---------------------------------------------------------------------------
  -- 4) Create 3 sections per class
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
  WHERE c.class_code LIKE 'DMY-AY%-C_'
    AND NOT EXISTS (
      SELECT 1
      FROM sections s
      WHERE s.class_id = c.id
        AND s.section_name = sec.section_name
    );

  -- ---------------------------------------------------------------------------
  -- 5) Create subjects per class
  -- ---------------------------------------------------------------------------
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
      ay.id AS ay_id,
      RIGHT(c.class_code, 1) AS class_no,
      sub.subject_name,
      sub.subject_short,
      sub.theory_hours,
      sub.practical_hours,
      sub.description,
      tp.staff_id
    FROM classes c
    JOIN academic_years ay ON ay.id = c.academic_year_id
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
    WHERE c.class_code LIKE 'DMY-AY%-C_'
  )
  INSERT INTO subjects (
    subject_name, subject_code, class_id, teacher_id,
    theory_hours, practical_hours, total_marks, passing_marks,
    description, is_active
  )
  SELECT
    src.subject_name,
    ('D' || src.ay_id || 'C' || src.class_no || src.subject_short),
    src.class_id,
    src.staff_id,
    src.theory_hours,
    src.practical_hours,
    100,
    35,
    src.description,
    true
  FROM src
  WHERE NOT EXISTS (
    SELECT 1
    FROM subjects s
    WHERE s.subject_code = ('D' || src.ay_id || 'C' || src.class_no || src.subject_short)
  );

  -- ---------------------------------------------------------------------------
  -- 6) Teacher-section allocation: each teacher gets max 2 sections per academic year
  -- ---------------------------------------------------------------------------
  SELECT COUNT(*)::int INTO v_teacher_count
  FROM teachers t
  WHERE t.staff_id IS NOT NULL;

  IF v_teacher_count > 0 THEN
    UPDATE sections s
    SET section_teacher_id = NULL
    FROM classes c
    WHERE s.class_id = c.id
      AND c.class_code LIKE 'DMY-AY%-C_';

    WITH teacher_pool AS (
      SELECT
        t.staff_id,
        ROW_NUMBER() OVER (ORDER BY t.id) AS teacher_rank
      FROM teachers t
      WHERE t.staff_id IS NOT NULL
    ),
    section_pool AS (
      SELECT
        s.id AS section_id,
        c.academic_year_id,
        ROW_NUMBER() OVER (
          PARTITION BY c.academic_year_id
          ORDER BY c.class_code, s.section_name
        ) AS section_rank
      FROM sections s
      JOIN classes c ON c.id = s.class_id
      WHERE c.class_code LIKE 'DMY-AY%-C_'
    ),
    mapped AS (
      SELECT
        sp.section_id,
        tp.staff_id
      FROM section_pool sp
      LEFT JOIN teacher_pool tp
        ON tp.teacher_rank = ((sp.section_rank - 1) / 2) + 1
      WHERE sp.section_rank <= (v_teacher_count * 2)
    )
    UPDATE sections s
    SET section_teacher_id = m.staff_id
    FROM mapped m
    WHERE s.id = m.section_id;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 7) Build student dataset: 5 students per section for each academic year
  -- ---------------------------------------------------------------------------
  CREATE TEMP TABLE tmp_seed_students (
    seq_no INTEGER,
    ay_id INTEGER,
    class_id INTEGER,
    section_id INTEGER,
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

  WITH target_sections AS (
    SELECT
      ay.id AS ay_id,
      c.id AS class_id,
      s.id AS section_id,
      ROW_NUMBER() OVER (PARTITION BY ay.id ORDER BY c.class_code, s.section_name) AS sec_no
    FROM academic_years ay
    JOIN classes c ON c.academic_year_id = ay.id
    JOIN sections s ON s.class_id = c.id
    WHERE c.class_code LIKE 'DMY-AY%-C_'
  ),
  expanded AS (
    SELECT
      ts.ay_id,
      ts.class_id,
      ts.section_id,
      ts.sec_no,
      gs.slot_no,
      ((ts.sec_no - 1) * 5 + gs.slot_no) AS seq_in_year
    FROM target_sections ts
    CROSS JOIN LATERAL generate_series(1, 5) AS gs(slot_no)
  )
  INSERT INTO tmp_seed_students (
    seq_no, ay_id, class_id, section_id, first_name, last_name, gender,
    admission_number, roll_number, username, email, unique_student_ids,
    pen_number, aadhar_no, gr_number
  )
  SELECT
    e.seq_in_year,
    e.ay_id,
    e.class_id,
    e.section_id,
    (ARRAY[
      'Ayaan','Vihaan','Reyansh','Arjun','Ishaan','Kabir','Advik','Sai','Devansh','Rudra',
      'Zayan','Aarav','Laksh','Krish','Yuvraj','Anaya','Myra','Aadhya','Saanvi','Kiara',
      'Fatima','Aisha','Inaya','Sara','Zoya','Meher','Anvi','Riya','Naina','Tara',
      'Prisha','Siya','Pari','Navya','Riddhi','Hridya','Mahir','Shaurya','Dhruv','Rayan',
      'Arnav','Nivaan','Samaira','Misha','Alina'
    ])[e.seq_in_year],
    (ARRAY[
      'Khan','Sharma','Patel','Ansari','Mishra','Verma','Singh','Qureshi','Shaikh','Gupta',
      'Naqvi','Malik','Rao','Joshi','Kulkarni','Deshmukh','Chopra','Siddiqui','Nair','Menon',
      'Pathan','Bano','Rahman','Iqbal','Hussain','Tiwari','Yadav','Jain','Kapoor','Bhatt',
      'Pillai','Thomas','Dutta','Saxena','Trivedi','Chauhan','Bhardwaj','Srivastava','Farooqui','Kazi',
      'Gandhi','Parekh','Reddy','Lodhi','Basu'
    ])[e.seq_in_year],
    CASE WHEN (e.seq_in_year % 2) = 0 THEN 'female' ELSE 'male' END,
    ('ADM-AY' || e.ay_id || '-' || LPAD(e.seq_in_year::text, 3, '0')),
    ('R-' || LPAD(e.seq_in_year::text, 3, '0')),
    ('stu_ay' || e.ay_id || '_' || LPAD(e.seq_in_year::text, 3, '0')),
    ('student.ay' || e.ay_id || '.' || LPAD(e.seq_in_year::text, 3, '0') || '@myschool.local'),
    ('UID-AY' || e.ay_id || '-' || LPAD(e.seq_in_year::text, 5, '0')),
    ('PEN' || e.ay_id || LPAD(e.seq_in_year::text, 7, '0')),
    ('9' || LPAD(e.ay_id::text, 2, '0') || LPAD(e.seq_in_year::text, 9, '0')),
    ('GR-AY' || e.ay_id || '-' || LPAD(e.seq_in_year::text, 4, '0'))
  FROM expanded e
  ORDER BY e.ay_id, e.seq_in_year;

  -- ---------------------------------------------------------------------------
  -- 8) Insert student users
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
    ('98' || LPAD((t.ay_id * 1000 + t.seq_no)::text, 8, '0')),
    true,
    ('Flat ' || t.seq_no || ', Green Residency, Civil Lines'),
    ('Village Road ' || t.seq_no || ', District Campus Area'),
    ('https://api.dicebear.com/8.x/adventurer/svg?seed=' || replace(t.first_name, ' ', '') || t.ay_id)
  FROM tmp_seed_students t
  WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.username = t.username);

  -- ---------------------------------------------------------------------------
  -- 9) Insert students
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
    ('98' || LPAD((t.ay_id * 1000 + t.seq_no)::text, 8, '0')),
    t.email,
    ('Flat ' || t.seq_no || ', Green Residency, Civil Lines'),
    t.ay_id,
    t.class_id,
    t.section_id,
    v_house_id,
    CURRENT_DATE - INTERVAL '45 days',
    'Bright Future Public School',
    ('https://api.dicebear.com/8.x/initials/svg?seed=' || replace(t.first_name || t.last_name, ' ', '') || t.ay_id),
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
    ('MH01AB' || LPAD((t.ay_id * 1000 + t.seq_no)::text, 4, '0')),
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
  -- 10) Student addresses
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
  WHERE s.admission_number LIKE 'ADM-AY%'
    AND NOT EXISTS (
      SELECT 1
      FROM addresses a
      WHERE a.user_id = u.id
        AND a.role_id = v_student_role_id
    );

  UPDATE students s
  SET address_id = a.id
  FROM addresses a
  WHERE s.user_id = a.user_id
    AND a.role_id = v_student_role_id
    AND s.admission_number LIKE 'ADM-AY%'
    AND (s.address_id IS NULL OR s.address_id <> a.id);

  -- ---------------------------------------------------------------------------
  -- 11) Parent users + parents rows
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
    'https://api.dicebear.com/8.x/avataaars/svg?seed=father' || s.id
  FROM students s
  WHERE s.admission_number LIKE 'ADM-AY%'
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
    'https://api.dicebear.com/8.x/avataaars/svg?seed=mother' || s.id
  FROM students s
  WHERE s.admission_number LIKE 'ADM-AY%'
    AND NOT EXISTS (
      SELECT 1 FROM users u WHERE u.username = 'mother_' || lower(replace(s.admission_number, '-', '_'))
    );

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
  WHERE s.admission_number LIKE 'ADM-AY%'
    AND NOT EXISTS (SELECT 1 FROM parents p WHERE p.student_id = s.id);

  UPDATE students s
  SET parent_id = p.id
  FROM parents p
  WHERE p.student_id = s.id
    AND s.admission_number LIKE 'ADM-AY%'
    AND (s.parent_id IS NULL OR s.parent_id <> p.id);

  -- ---------------------------------------------------------------------------
  -- 12) Guardian users + guardians rows
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
      'https://api.dicebear.com/8.x/avataaars/svg?seed=guardian' || s.id
    FROM students s
    WHERE s.admission_number LIKE 'ADM-AY%'
      AND NOT EXISTS (
        SELECT 1
        FROM users u
        WHERE u.username = 'guardian_' || lower(replace(s.admission_number, '-', '_'))
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
    WHERE s.admission_number LIKE 'ADM-AY%'
      AND NOT EXISTS (SELECT 1 FROM guardians g WHERE g.student_id = s.id);

    UPDATE students s
    SET guardian_id = g.id
    FROM guardians g
    WHERE g.student_id = s.id
      AND s.admission_number LIKE 'ADM-AY%'
      AND (s.guardian_id IS NULL OR s.guardian_id <> g.id);
  END IF;

  -- ---------------------------------------------------------------------------
  -- 13) Update class/section counts for seeded classes
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
      WHERE c2.class_code LIKE 'DMY-AY%-C_'
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
    AND c.class_code LIKE 'DMY-AY%-C_';

END $$;

COMMIT;
