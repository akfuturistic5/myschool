-- Remove Exams & Results module database objects.
-- Safe order: child tables first, then parent table.

DROP TABLE IF EXISTS public.exam_results;
DROP TABLE IF EXISTS public.exam_subjects;
DROP TABLE IF EXISTS public.exams;
