-- =============================================================================
-- Hostel module — Phase 1 (production-oriented)
-- - Academic year only on hostels + hostel_assignments (not on floors/rooms/beds/types).
-- - Occupancy derived from hostel_beds.bed_status (+ assignments), not mirrored counts.
-- - Hostel room taxonomy: hostel_room_types (separate from classroom room_types master).
-- - hostels: hostel_category (student/staff) + gender (boys/girls/mixed).
-- Idempotent: safe to re-run on tenants that never had legacy hostel tables.
-- =============================================================================

-- 1) Hostel room types (reuse-friendly, not academic-year scoped)
CREATE TABLE IF NOT EXISTS public.hostel_room_types (
    id SERIAL PRIMARY KEY,
    name character varying(100) NOT NULL,
    sharing_capacity integer NOT NULL CHECK (sharing_capacity >= 1 AND sharing_capacity <= 20),
    has_ac boolean DEFAULT false,
    has_wifi boolean DEFAULT false,
    has_attached_bathroom boolean DEFAULT false,
    description text,
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT hostel_room_types_name_key UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_hostel_room_types_active ON public.hostel_room_types (is_active);

-- 2) Hostels (scoped to academic year)
CREATE TABLE IF NOT EXISTS public.hostels (
    id SERIAL PRIMARY KEY,
    academic_year_id integer NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    hostel_name character varying(150) NOT NULL,
    code character varying(50) NOT NULL,
    hostel_category character varying(20) NOT NULL DEFAULT 'student'
        CHECK (hostel_category IN ('student', 'staff')),
    gender character varying(20) NOT NULL
        CHECK (gender IN ('boys', 'girls', 'mixed')),
    address text,
    total_floors integer DEFAULT 1 CHECK (total_floors >= 1),
    intake_capacity integer,
    warden_user_id integer REFERENCES public.users(id) ON DELETE SET NULL,
    contact_number character varying(20),
    email character varying(150),
    description text,
    facilities text,
    rules text,
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by integer,
    updated_by integer
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_hostels_code_alive
ON public.hostels (code)
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_hostels_name_alive_per_year
ON public.hostels (academic_year_id, hostel_name)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_hostels_year ON public.hostels (academic_year_id);
CREATE INDEX IF NOT EXISTS idx_hostels_active ON public.hostels (is_active) WHERE deleted_at IS NULL;

-- 3) Floors (inherit year via hostel → no academic_year_id)
CREATE TABLE IF NOT EXISTS public.hostel_floors (
    id SERIAL PRIMARY KEY,
    hostel_id integer NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
    floor_name character varying(100) NOT NULL,
    floor_number integer NOT NULL CHECK (floor_number >= -10 AND floor_number <= 200),
    wing_name character varying(100),
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_hostel_floors_number_alive
ON public.hostel_floors (hostel_id, floor_number)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_hostel_floors_hostel ON public.hostel_floors (hostel_id);

-- 4) Rooms (no occupied_beds / max_occupancy mirrors)
CREATE TABLE IF NOT EXISTS public.hostel_rooms (
    id SERIAL PRIMARY KEY,
    hostel_id integer NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
    floor_id integer NOT NULL REFERENCES public.hostel_floors(id) ON DELETE RESTRICT,
    hostel_room_type_id integer NOT NULL REFERENCES public.hostel_room_types(id) ON DELETE RESTRICT,
    room_number character varying(50) NOT NULL,
    monthly_rent numeric(10,2) DEFAULT 0,
    room_status character varying(30) NOT NULL DEFAULT 'available'
        CHECK (room_status IN ('available', 'full', 'maintenance', 'blocked')),
    notes text,
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by integer,
    updated_by integer
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_hostel_rooms_room_alive
ON public.hostel_rooms (hostel_id, room_number)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_hostel_rooms_hostel ON public.hostel_rooms (hostel_id);
CREATE INDEX IF NOT EXISTS idx_hostel_rooms_floor ON public.hostel_rooms (floor_id);

-- 5) Beds
CREATE TABLE IF NOT EXISTS public.hostel_beds (
    id SERIAL PRIMARY KEY,
    room_id integer NOT NULL REFERENCES public.hostel_rooms(id) ON DELETE CASCADE,
    bed_number character varying(50) NOT NULL,
    position_label character varying(50),
    bed_status character varying(30) NOT NULL DEFAULT 'available'
        CHECK (bed_status IN ('available', 'occupied', 'reserved', 'maintenance')),
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_hostel_beds_room_label_alive
ON public.hostel_beds (room_id, bed_number)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_hostel_beds_room ON public.hostel_beds (room_id);

-- 6) Assignments (operational anchor for year)
CREATE TABLE IF NOT EXISTS public.hostel_assignments (
    id SERIAL PRIMARY KEY,
    academic_year_id integer NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    user_type character varying(20) NOT NULL
        CHECK (user_type IN ('student', 'staff')),
    student_id integer REFERENCES public.students(id) ON DELETE RESTRICT,
    staff_id integer REFERENCES public.staff(id) ON DELETE RESTRICT,
    hostel_id integer NOT NULL REFERENCES public.hostels(id) ON DELETE RESTRICT,
    floor_id integer NOT NULL REFERENCES public.hostel_floors(id) ON DELETE RESTRICT,
    room_id integer NOT NULL REFERENCES public.hostel_rooms(id) ON DELETE RESTRICT,
    bed_id integer NOT NULL REFERENCES public.hostel_beds(id) ON DELETE RESTRICT,
    assigned_date date NOT NULL DEFAULT CURRENT_DATE,
    expected_checkout_date date,
    checkout_date date,
    security_deposit numeric(10,2) DEFAULT 0,
    remarks text,
    assignment_status character varying(20) NOT NULL DEFAULT 'active'
        CHECK (assignment_status IN ('active', 'completed', 'cancelled')),
    assigned_by integer REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by integer,
    updated_by integer,
    CONSTRAINT hostel_assignments_student_staff_check CHECK (
        (user_type = 'student' AND student_id IS NOT NULL AND staff_id IS NULL)
        OR (user_type = 'staff' AND staff_id IS NOT NULL AND student_id IS NULL)
    ),
    CONSTRAINT hostel_assignments_checkout_dates_check CHECK (
        checkout_date IS NULL OR assigned_date <= checkout_date
    ),
    CONSTRAINT hostel_assignments_expected_checkout_check CHECK (
        expected_checkout_date IS NULL OR assigned_date <= expected_checkout_date
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_hostel_assign_active_bed
ON public.hostel_assignments (bed_id)
WHERE assignment_status = 'active' AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_hostel_assign_active_student_nn
ON public.hostel_assignments (student_id)
WHERE assignment_status = 'active' AND deleted_at IS NULL AND student_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_hostel_assign_active_staff_nn
ON public.hostel_assignments (staff_id)
WHERE assignment_status = 'active' AND deleted_at IS NULL AND staff_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hostel_assign_year ON public.hostel_assignments (academic_year_id);
CREATE INDEX IF NOT EXISTS idx_hostel_assign_room ON public.hostel_assignments (room_id);

COMMENT ON TABLE public.student_hostel_assignments IS
    'Legacy logistics row; superseded by hostel_assignments when the full hostel hierarchy is enabled.';
