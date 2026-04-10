-- Driver designation (Support Staff department) + link transport drivers to HRM staff.
-- Safe to run multiple times (idempotent).

-- 1) Designation "Driver" under Support Staff (only if no Driver/Drivers row exists)
INSERT INTO designations (designation_name, department_id, description, is_active, created_at, modified_at)
SELECT 'Driver', d.id, 'School vehicle driver', true, NOW(), NOW()
FROM departments d
WHERE LOWER(TRIM(d.department_name)) = 'support staff'
  AND (d.is_active IS NOT FALSE OR d.is_active IS NULL)
  AND NOT EXISTS (
    SELECT 1 FROM designations z WHERE LOWER(TRIM(z.designation_name)) IN ('driver', 'drivers')
  )
LIMIT 1;

-- 2) drivers.staff_id → staff (one transport row per staff driver)
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_staff_id_unique
  ON drivers (staff_id)
  WHERE staff_id IS NOT NULL;
