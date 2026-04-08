-- Backfill legacy transport drivers into staff + users and link drivers.staff_id
-- Run AFTER:
--   012_driver_designation_and_drivers_staff_id.sql
--   013_user_role_driver.sql
--
-- Safe to re-run (idempotent for already-linked rows).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  rec RECORD;
  v_driver_designation_id INTEGER;
  v_support_department_id INTEGER;
  v_driver_role_id INTEGER;
  v_staff_id INTEGER;
  v_user_id INTEGER;
  v_email TEXT;
  v_phone TEXT;
  v_phone_digits TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
  v_employee_code TEXT;
  v_username TEXT;
  v_username_base TEXT;
  v_suffix INTEGER;
  v_password_hash TEXT;
  v_linked_count INTEGER := 0;
  v_skip_phone_count INTEGER := 0;
BEGIN
  SELECT id INTO v_driver_designation_id
  FROM designations
  WHERE LOWER(TRIM(designation_name)) IN ('driver', 'drivers')
  ORDER BY id ASC
  LIMIT 1;

  SELECT id INTO v_support_department_id
  FROM departments
  WHERE LOWER(TRIM(department_name)) = 'support staff'
  ORDER BY id ASC
  LIMIT 1;

  SELECT id INTO v_driver_role_id
  FROM user_roles
  WHERE LOWER(TRIM(role_name)) = 'driver'
  ORDER BY id ASC
  LIMIT 1;

  IF v_driver_designation_id IS NULL THEN
    RAISE EXCEPTION 'Driver designation not found. Run 012 first.';
  END IF;
  IF v_support_department_id IS NULL THEN
    RAISE EXCEPTION 'Support Staff department not found. Run 012 first.';
  END IF;
  IF v_driver_role_id IS NULL THEN
    RAISE EXCEPTION 'Driver role not found. Run 013 first.';
  END IF;

  FOR rec IN
    SELECT *
    FROM drivers
    WHERE staff_id IS NULL
    ORDER BY id ASC
  LOOP
    -- Normalize phone and skip invalid lengths (same safety as server-side script).
    v_phone := LEFT(COALESCE(TRIM(rec.phone), ''), 15);
    v_phone_digits := regexp_replace(v_phone, '\D', '', 'g');
    IF char_length(v_phone_digits) < 7 OR char_length(v_phone_digits) > 15 THEN
      v_skip_phone_count := v_skip_phone_count + 1;
      CONTINUE;
    END IF;

    -- Parse name
    IF POSITION(' ' IN COALESCE(TRIM(rec.driver_name), '')) > 0 THEN
      v_first_name := LEFT(TRIM(split_part(TRIM(rec.driver_name), ' ', 1)), 50);
      v_last_name := LEFT(TRIM(substr(TRIM(rec.driver_name), POSITION(' ' IN TRIM(rec.driver_name)) + 1)), 50);
      IF v_last_name = '' THEN v_last_name := 'Staff'; END IF;
    ELSE
      v_first_name := LEFT(COALESCE(NULLIF(TRIM(rec.driver_name), ''), 'Driver'), 50);
      v_last_name := 'Staff';
    END IF;

    -- Email fallback when invalid/missing/duplicate in users or staff
    v_email := LEFT(COALESCE(TRIM(rec.email), ''), 100);
    IF v_email = '' OR v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
       OR EXISTS (SELECT 1 FROM users u WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(v_email)))
       OR EXISTS (SELECT 1 FROM staff s WHERE LOWER(TRIM(s.email)) = LOWER(TRIM(v_email)))
    THEN
      v_email := LEFT(format('legacy.driver.%s.%s@noreply.local', rec.id, floor(extract(epoch from clock_timestamp()))::bigint), 100);
      WHILE EXISTS (SELECT 1 FROM users u WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(v_email))) LOOP
        v_email := LEFT(format('legacy.driver.%s.%s@noreply.local', rec.id, floor(extract(epoch from clock_timestamp() + (random() * interval '1 second')))::bigint), 100);
      END LOOP;
    END IF;

    -- Employee code with uniqueness in staff
    v_employee_code := LEFT(COALESCE(NULLIF(TRIM(rec.employee_code), ''), format('DRV%s', rec.id)), 20);
    IF EXISTS (SELECT 1 FROM staff s WHERE s.employee_code = v_employee_code) THEN
      v_employee_code := LEFT(format('DRV%s', rec.id), 20);
      IF EXISTS (SELECT 1 FROM staff s WHERE s.employee_code = v_employee_code) THEN
        v_employee_code := LEFT(format('DRV%s%s', rec.id, floor(random() * 1000)::int), 20);
      END IF;
    END IF;

    -- Insert staff row first
    INSERT INTO staff (
      user_id, employee_code, first_name, last_name, gender, date_of_birth, blood_group_id,
      phone, email, address, emergency_contact_name, emergency_contact_phone,
      designation_id, department_id, joining_date, salary, qualification, experience_years,
      photo_url, is_active, created_by, created_at, modified_at
    ) VALUES (
      NULL, v_employee_code, v_first_name, v_last_name, NULL, NULL, NULL,
      v_phone, v_email, rec.address, NULL, NULL,
      v_driver_designation_id, v_support_department_id, rec.joining_date, rec.salary, NULL, NULL,
      NULL, COALESCE(rec.is_active, true), NULL, NOW(), NOW()
    )
    RETURNING id INTO v_staff_id;

    -- Build unique username
    v_username_base := LEFT(COALESCE(NULLIF(TRIM(v_email), ''), NULLIF(TRIM(v_phone), ''), format('driver_%s', rec.id)), 50);
    v_username := v_username_base;
    v_suffix := 1;
    WHILE EXISTS (SELECT 1 FROM users u WHERE u.username = v_username) LOOP
      v_username := LEFT(format('%s.%s', LEFT(v_username_base, 44), v_suffix), 50);
      v_suffix := v_suffix + 1;
      IF v_suffix > 5000 THEN
        v_username := LEFT(format('driver.%s.%s', rec.id, floor(random() * 1000000)::int), 50);
        EXIT;
      END IF;
    END LOOP;

    -- Bcrypt hash using phone digits as initial password (same idea as app).
    v_password_hash := crypt(v_phone_digits, gen_salt('bf', 12));

    INSERT INTO users (
      username, email, password_hash, role_id, first_name, last_name, phone, is_active, created_at, modified_at
    ) VALUES (
      v_username, v_email, v_password_hash, v_driver_role_id, v_first_name, v_last_name, v_phone, COALESCE(rec.is_active, true), NOW(), NOW()
    )
    RETURNING id INTO v_user_id;

    -- Link staff -> user and drivers -> staff
    UPDATE staff
    SET user_id = v_user_id,
        modified_at = NOW()
    WHERE id = v_staff_id;

    UPDATE drivers
    SET staff_id = v_staff_id,
        modified_at = NOW()
    WHERE id = rec.id;

    v_linked_count := v_linked_count + 1;
  END LOOP;

  RAISE NOTICE 'Backfill complete. Linked: %, Skipped (invalid phone): %', v_linked_count, v_skip_phone_count;
END $$;

