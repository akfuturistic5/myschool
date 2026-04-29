BEGIN;

ALTER TABLE public.exam_results
  ADD COLUMN IF NOT EXISTS exam_component varchar(20);

UPDATE public.exam_results er
SET exam_component = COALESCE(
  er.exam_component,
  es.exam_component,
  'theory'
)
FROM public.exam_subjects es
WHERE er.exam_subject_id = es.id;

UPDATE public.exam_results
SET exam_component = 'theory'
WHERE exam_component IS NULL;

ALTER TABLE public.exam_results
  ALTER COLUMN exam_component SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'exam_results_exam_component_check'
  ) THEN
    ALTER TABLE public.exam_results
      ADD CONSTRAINT exam_results_exam_component_check
      CHECK (exam_component IN ('theory', 'practical'));
  END IF;
END $$;

ALTER TABLE public.exam_results
  DROP CONSTRAINT IF EXISTS exam_results_exam_id_student_id_subject_id_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'exam_results_exam_id_student_id_subject_component_key'
  ) THEN
    ALTER TABLE public.exam_results
      ADD CONSTRAINT exam_results_exam_id_student_id_subject_component_key
      UNIQUE (exam_id, student_id, subject_id, exam_component);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_exam_results_exam_subject_component
  ON public.exam_results (exam_id, subject_id, exam_component);

COMMIT;

