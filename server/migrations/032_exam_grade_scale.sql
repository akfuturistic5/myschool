-- =============================================================================
-- Migration: 032_exam_grade_scale.sql
-- Purpose:
--   Create persistent exam_grade table for exams/results so grades can be
--   added/edited/deleted by admin users and reused consistently in reports.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.exam_grade (
  id SERIAL PRIMARY KEY,
  grad VARCHAR(20) NOT NULL,
  min_precentage NUMERIC(5,2) NOT NULL,
  max_precentage NUMERIC(5,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  modified_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT exam_grade_min_max_valid CHECK (
    min_precentage >= 0
    AND max_precentage <= 100
    AND min_precentage <= max_precentage
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS exam_grade_grade_unique_ci
  ON public.exam_grade (LOWER(TRIM(grad)));

CREATE INDEX IF NOT EXISTS exam_grade_active_sort_idx
  ON public.exam_grade (is_active, min_precentage DESC);

-- Seed defaults only when table is empty.
INSERT INTO public.exam_grade (grad, min_precentage, max_precentage, is_active)
SELECT x.grad, x.min_precentage, x.max_precentage, true
FROM (
  VALUES
    ('A+', 91.00::numeric, 100.00::numeric),
    ('A', 86.00::numeric, 90.99::numeric),
    ('B+', 76.00::numeric, 85.99::numeric),
    ('B', 66.00::numeric, 75.99::numeric),
    ('C', 50.00::numeric, 65.99::numeric),
    ('D', 0.00::numeric, 49.99::numeric)
) AS x(grad, min_precentage, max_precentage)
WHERE NOT EXISTS (SELECT 1 FROM public.exam_grade);

COMMIT;

