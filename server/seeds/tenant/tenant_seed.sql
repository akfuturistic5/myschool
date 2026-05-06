/*
=============================================================================
TENANT SEED DATA - DEFAULT VALUES
=============================================================================
This script populates standard lookup data for a school database.
=============================================================================
*/

-- 1. Academic Year (Sample)
INSERT INTO public.academic_years (year_name, start_date, end_date, is_current, is_active)
VALUES ('2024-25', '2024-04-01', '2025-03-31', true, true)
ON CONFLICT (year_name) DO NOTHING;

-- 2. User Roles (Synced with src/config/roles.js)
INSERT INTO public.user_roles (role_name, description) VALUES
('Admin', 'School Administrator with full control over school settings'), -- ID: 1
('Teacher', 'Academic staff with access to class management and grading'), -- ID: 2
('Student', 'Students enrolled in the school'),                           -- ID: 3
('Parent', 'Guardians and parents of students'),                          -- ID: 4
('Guardian', 'Additional guardians of students'),                         -- ID: 5
('Administrative', 'Staff managing enquiries and front-desk tasks'),       -- ID: 6
('Accountant', 'Financial staff managing fees and payroll'),
('Librarian', 'Staff managing library assets and circulation'),
('Receptionist', 'Staff managing enquiries and front-desk tasks')
ON CONFLICT (role_name) DO NOTHING;

-- 3. Blood Groups
INSERT INTO public.blood_groups (blood_group_name) VALUES
('A+'), ('A-'), ('B+'), ('B-'), ('O+'), ('O-'), ('AB+'), ('AB-')
ON CONFLICT (blood_group_name) DO NOTHING;

-- 4. Religions
INSERT INTO public.religions (religion_name) VALUES
('Hinduism'), ('Islam'), ('Christianity'), ('Sikhism'), ('Buddhism'), ('Jainism'), ('Zoroastrianism')
ON CONFLICT (religion_name) DO NOTHING;

-- 5. Mother Tongues
INSERT INTO public.mother_tongues (language_name) VALUES
('Hindi'), ('English'), ('Marathi'), ('Gujarati'), ('Bengali'), ('Tamil'), ('Telugu'), ('Kannada'), ('Malayalam'), ('Punjabi')
ON CONFLICT (language_name) DO NOTHING;

-- 6. Departments
INSERT INTO public.departments (department_name) VALUES
('Academic'), ('Administration'), ('Accounts'), ('Library'), ('Transport'), ('Housekeeping'), ('Security')
ON CONFLICT (department_name) DO NOTHING;

-- 7. Designations
INSERT INTO public.designations (designation_name, department_id)
SELECT d.name, d.dept_id FROM (VALUES
    ('Principal', 2),
    ('Vice Principal', 2),
    ('HOD', 1),
    ('Senior Teacher', 1),
    ('Teacher', 1),
    ('Assistant Teacher', 1),
    ('Accountant', 3),
    ('Clerk', 2),
    ('Librarian', 4),
    ('Driver', 5)
) AS d(name, dept_id)
WHERE NOT EXISTS (
    SELECT 1 FROM public.designations WHERE designation_name = d.name
);

-- 8. Salary Components
INSERT INTO public.salary_components (component_name, type)
SELECT c.name, c.type FROM (VALUES
    ('Basic Salary', 'allowance'),
    ('HRA', 'allowance'),
    ('DA', 'allowance'),
    ('TA', 'allowance'),
    ('Medical Allowance', 'allowance'),
    ('PF (Employee)', 'deduction'),
    ('Professional Tax', 'deduction'),
    ('TDS', 'deduction')
) AS c(name, type)
WHERE NOT EXISTS (
    SELECT 1 FROM public.salary_components WHERE component_name = c.name
);

-- 9. Leave Types
INSERT INTO public.leave_types (leave_type, max_days, applicable_for) VALUES
('Casual Leave', 12, 'both'),
('Sick Leave', 10, 'both'),
('Earned Leave', 15, 'staff'),
('Maternity Leave', 180, 'staff'),
('Paternity Leave', 15, 'staff'),
('Duty Leave', 10, 'staff')
ON CONFLICT DO NOTHING;

-- 10. Fee Types
INSERT INTO public.fees_types (name)
SELECT f.name FROM (VALUES
    ('Admission Fee'),
    ('Tuition Fee'),
    ('Examination Fee'),
    ('Library Fee'),
    ('Transport Fee'),
    ('Laboratory Fee'),
    ('Computer Fee'),
    ('Annual Function Fee'),
    ('Registration Fee')
) AS f(name)
WHERE NOT EXISTS (
    SELECT 1 FROM public.fees_types WHERE name = f.name
);

-- 11. Document Types
INSERT INTO public.document_types (document_type, applicable_for)
SELECT d.type, d.app FROM (VALUES
    ('Aadhar Card', 'both'),
    ('Birth Certificate', 'student'),
    ('Transfer Certificate (TC)', 'student'),
    ('Previous Marksheet', 'student'),
    ('Medical Certificate', 'both'),
    ('Passport Photo', 'both'),
    ('Experience Certificate', 'staff'),
    ('PAN Card', 'staff'),
    ('Voter ID', 'staff')
) AS d(type, app)
WHERE NOT EXISTS (
    SELECT 1 FROM public.document_types WHERE document_type = d.type
);

-- 12. Room Types (Optional - used for Hostels)
-- INSERT INTO public.room_types (room_type, max_occupancy) VALUES
-- ('Single Sharing', 1),
-- ('Double Sharing', 2),
-- ('Triple Sharing', 3)
-- ON CONFLICT (room_type) DO NOTHING;

-- 13. Time Slots
INSERT INTO public.timetable_time_slots (slot_name, start_time, end_time, is_break)
SELECT s.name, s.start_t::time, s.end_t::time, s.brk FROM (VALUES
    ('Period 1', '08:00:00', '08:45:00', false),
    ('Period 2', '08:45:00', '09:30:00', false),
    ('Period 3', '09:30:00', '10:15:00', false),
    ('Short Break', '10:15:00', '10:30:00', true),
    ('Period 4', '10:30:00', '11:15:00', false),
    ('Period 5', '11:15:00', '12:00:00', false),
    ('Lunch Break', '12:00:00', '12:45:00', true),
    ('Period 6', '12:45:00', '13:30:00', false),
    ('Period 7', '13:30:00', '14:15:00', false),
    ('Period 8', '14:15:00', '15:00:00', false)
) AS s(name, start_t, end_t, brk)
WHERE NOT EXISTS (
    SELECT 1 FROM public.timetable_time_slots WHERE slot_name = s.name
);

-- 14. Houses
INSERT INTO public.houses (house_name) VALUES
('Red House'), ('Blue House'), ('Green House'), ('Yellow House')
ON CONFLICT (house_name) DO NOTHING;

-- 15. Languages
INSERT INTO public.languages (language_name, language_code, is_compulsory) VALUES
('English', 'EN', true),
('Hindi', 'HI', true),
('Sanskrit', 'SK', false),
('French', 'FR', false)
ON CONFLICT (language_name) DO NOTHING;
