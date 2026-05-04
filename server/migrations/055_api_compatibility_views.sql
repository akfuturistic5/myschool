-- API compatibility shims for legacy table names expected by older controllers.
-- Prefer querying canonical tables (staff, school_holidays) in application code long term.
-- Apply per tenant: node scripts/tenant-bulk-runner.js --sql migrations/055_api_compatibility_views.sql

-- Holidays: legacy code queried table "holidays" with start_date/end_date columns.
-- Canonical table is school_holidays (holiday_period daterange).
CREATE OR REPLACE VIEW public.holidays AS
SELECT
  sh.id,
  sh.holiday_name,
  sh.description,
  lower(sh.holiday_period)::date AS start_date,
  (CASE
    WHEN upper_inf(sh.holiday_period) THEN lower(sh.holiday_period)::date
    ELSE (upper(sh.holiday_period)::date - interval '1 day')::date
  END)::date AS end_date,
  sh.holiday_type,
  sh.academic_year_id,
  sh.created_by,
  sh.created_at,
  sh.updated_at,
  sh.updated_at AS modified_at
FROM public.school_holidays sh;

COMMENT ON VIEW public.holidays IS 'Compatibility read view over school_holidays; use school_holidays for INSERT/UPDATE/DELETE.';

-- Teachers: canonical model is staff + users; legacy code used table "teachers".
CREATE OR REPLACE VIEW public.teachers AS
SELECT
  s.id AS id,
  NULL::integer AS class_id,
  NULL::integer AS subject_id,
  s.father_name,
  s.mother_name,
  s.marital_status,
  s.languages_known,
  NULL::character varying AS blood_group,
  s.previous_school_name,
  s.previous_school_address,
  s.previous_school_phone,
  u.current_address AS current_address,
  u.permanent_address AS permanent_address,
  sa.pan_number,
  s.id_number,
  sa.bank_name,
  sa.branch,
  sa.ifsc_code AS ifsc,
  sa.contract_type,
  sa.shift,
  sa.work_location,
  u.facebook,
  u.twitter,
  u.linkedin,
  s.status,
  s.created_at,
  NULL::text AS resume,
  NULL::text AS joining_letter,
  s.updated_at AS modified_at,
  s.id AS staff_id,
  u.youtube,
  u.instagram,
  s.other_info AS other_info,
  sa.account_name AS account_name,
  sa.account_no AS account_number,
  NULL::character varying AS subject_name,
  NULL::character varying AS class_name,
  u.first_name AS teacher_first_name,
  u.last_name AS teacher_last_name
FROM public.staff s
INNER JOIN public.users u ON u.id = s.user_id
LEFT JOIN LATERAL (
  SELECT
    ssa.pan_number,
    ssa.bank_name,
    ssa.branch,
    ssa.ifsc_code,
    ssa.account_name,
    ssa.account_no,
    ssa.contract_type,
    ssa.shift,
    ssa.work_location
  FROM public.staff_salary_assignments ssa
  WHERE ssa.staff_id = s.id
  ORDER BY lower(ssa.valid_period) DESC NULLS LAST
  LIMIT 1
) sa ON true
WHERE s.deleted_at IS NULL;

COMMENT ON VIEW public.teachers IS 'Compatibility view: teachers.id and teachers.staff_id both map to staff.id; names live on users.';
