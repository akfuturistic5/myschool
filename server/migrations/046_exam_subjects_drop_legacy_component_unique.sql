-- =============================================================================
-- Migration: 029_exam_subjects_drop_legacy_component_unique.sql
-- Purpose:
--   Remove legacy unique constraint that conflicts with class/section scoped
--   timetable model. Current model uses:
--     UNIQUE (exam_id, class_id, section_id, subject_id)
-- =============================================================================

BEGIN;

ALTER TABLE public.exam_subjects
  DROP CONSTRAINT IF EXISTS exam_subjects_exam_subject_component_key;

COMMIT;

