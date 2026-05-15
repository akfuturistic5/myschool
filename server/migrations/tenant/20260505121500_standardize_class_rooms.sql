-- Migration to standardize class_rooms table
-- 1. Remove room_type_id
-- 2. Standardize room_number column
-- 3. Standardize is_active (boolean) instead of status (string)
-- 4. Standardize building_name instead of building
-- 5. Remove description column

DO $$ 
BEGIN
    -- [1] Remove room_type_id if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'class_rooms' AND column_name = 'room_type_id') THEN
        ALTER TABLE public.class_rooms DROP COLUMN room_type_id;
    END IF;

    -- [2] Standardize Room Identifier to 'room_number'
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'class_rooms' AND column_name = 'room_no') THEN
        ALTER TABLE public.class_rooms RENAME COLUMN room_no TO room_number;
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'class_rooms' AND column_name = 'room_name') THEN
        ALTER TABLE public.class_rooms RENAME COLUMN room_name TO room_number;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'class_rooms' AND column_name = 'room_number') THEN
        ALTER TABLE public.class_rooms ADD COLUMN room_number character varying(50) NOT NULL DEFAULT 'TEMP';
        ALTER TABLE public.class_rooms ALTER COLUMN room_number DROP DEFAULT;
    END IF;

    -- [3] Standardize 'status' to 'is_active' (Boolean)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'class_rooms' AND column_name = 'status') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'class_rooms' AND column_name = 'is_active') THEN
            ALTER TABLE public.class_rooms ADD COLUMN is_active boolean DEFAULT true;
            UPDATE public.class_rooms SET is_active = (status ILIKE 'Active');
        END IF;
        ALTER TABLE public.class_rooms DROP COLUMN status;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'class_rooms' AND column_name = 'is_active') THEN
        ALTER TABLE public.class_rooms ADD COLUMN is_active boolean DEFAULT true;
    END IF;

    -- [4] Standardize 'building' to 'building_name'
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'class_rooms' AND column_name = 'building') THEN
        ALTER TABLE public.class_rooms RENAME COLUMN building TO building_name;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'class_rooms' AND column_name = 'building_name') THEN
        ALTER TABLE public.class_rooms ADD COLUMN building_name character varying(100);
    END IF;

    -- [5] Remove description column
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'class_rooms' AND column_name = 'description') THEN
        ALTER TABLE public.class_rooms DROP COLUMN description;
    END IF;

    -- [6] Ensure floor column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'class_rooms' AND column_name = 'floor') THEN
        ALTER TABLE public.class_rooms ADD COLUMN floor integer;
    END IF;

    -- [7] Ensure constraints
    ALTER TABLE public.class_rooms DROP CONSTRAINT IF EXISTS class_rooms_room_number_key;
    ALTER TABLE public.class_rooms ADD CONSTRAINT class_rooms_room_number_key UNIQUE (room_number);

END $$;
