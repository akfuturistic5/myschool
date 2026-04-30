-- Guardian / parent contact APIs read occupation from public.users (see guardianController,
-- parentPersonController, contactUserService). Base schema 001 did not include this column;
-- it was only added by optional JS unify scripts. Idempotent: safe to re-run.
--
-- Apply (tenant DB), e.g.:
--   psql "$DATABASE_URL" -f server/migrations/021_users_occupation.sql
-- Or from repo root with server/.env loaded:
--   node server/scripts/run-users-occupation-migration.js

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS occupation character varying(255);

-- Backfill from legacy guardians.occupation when that column still exists (skipped at parse
-- time when the column is absent via dynamic SQL).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'guardians'
      AND column_name = 'occupation'
  ) THEN
    EXECUTE $backfill$
      UPDATE public.users u
      SET occupation = g.occupation
      FROM public.guardians g
      WHERE g.user_id = u.id
        AND g.occupation IS NOT NULL
        AND TRIM(COALESCE(g.occupation::text, '')) <> ''
        AND (
          u.occupation IS NULL
          OR TRIM(COALESCE(u.occupation::text, '')) = ''
        )
    $backfill$;
  END IF;
END
$$;
