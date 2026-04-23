-- ============================================================================
-- Migration: 047_student_rejoins_rejoined_by_user
-- Purpose:
--   - Ensure student_rejoins.rejoined_by stores authenticated users.id
--   - Backfill missing rejoined_by from created_by where possible
-- ============================================================================

-- Drop old FK first so backfill can safely write users.id values.
ALTER TABLE public.student_rejoins
  DROP CONSTRAINT IF EXISTS student_rejoins_rejoined_by_fkey;

-- Backfill historical rows created by authenticated users.
UPDATE public.student_rejoins sr
SET rejoined_by = sr.created_by
WHERE sr.rejoined_by IS NULL
  AND sr.created_by IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = sr.created_by
  );

-- Normalize legacy values that are not valid users.id.
UPDATE public.student_rejoins sr
SET rejoined_by = sr.created_by
WHERE sr.rejoined_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = sr.rejoined_by
  )
  AND sr.created_by IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = sr.created_by
  );

UPDATE public.student_rejoins sr
SET rejoined_by = NULL
WHERE sr.rejoined_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = sr.rejoined_by
  );

ALTER TABLE public.student_rejoins
  ADD CONSTRAINT student_rejoins_rejoined_by_fkey
  FOREIGN KEY (rejoined_by) REFERENCES public.users(id) ON DELETE SET NULL;
