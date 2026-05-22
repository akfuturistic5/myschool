-- =============================================================================
-- Homework module — production upgrade
-- - Extends homework / homework_submissions to full LMS-ready model
-- - Adds homework_attachments, homework_recipients, submission_attachments
-- - Drops legacy single attachment_url columns
-- Idempotent: safe to re-run on tenants already on the new shape.
-- =============================================================================

-- 1) Homework master — new columns & constraints
ALTER TABLE public.homework ADD COLUMN IF NOT EXISTS instructions text;
ALTER TABLE public.homework ADD COLUMN IF NOT EXISTS homework_type character varying(30) DEFAULT 'Homework';
ALTER TABLE public.homework ADD COLUMN IF NOT EXISTS publish_at TIMESTAMPTZ;
ALTER TABLE public.homework ADD COLUMN IF NOT EXISTS visible_until TIMESTAMPTZ;
ALTER TABLE public.homework ADD COLUMN IF NOT EXISTS allow_late_submission boolean DEFAULT true;
ALTER TABLE public.homework ADD COLUMN IF NOT EXISTS is_graded boolean DEFAULT true;
ALTER TABLE public.homework ADD COLUMN IF NOT EXISTS status character varying(20) DEFAULT 'Published';
ALTER TABLE public.homework ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.homework DROP COLUMN IF EXISTS attachment_url;

UPDATE public.homework SET homework_type = 'Homework' WHERE homework_type IS NULL;
UPDATE public.homework SET status = 'Published' WHERE status IS NULL;
UPDATE public.homework SET allow_late_submission = true WHERE allow_late_submission IS NULL;
UPDATE public.homework SET is_graded = true WHERE is_graded IS NULL;

ALTER TABLE public.homework ALTER COLUMN homework_type SET DEFAULT 'Homework';
ALTER TABLE public.homework ALTER COLUMN status SET DEFAULT 'Published';

ALTER TABLE public.homework DROP CONSTRAINT IF EXISTS chk_homework_status;
ALTER TABLE public.homework ADD CONSTRAINT chk_homework_status CHECK (
    status IN ('Draft', 'Published', 'Closed', 'Archived')
);

ALTER TABLE public.homework DROP CONSTRAINT IF EXISTS chk_homework_type;
ALTER TABLE public.homework ADD CONSTRAINT chk_homework_type CHECK (
    homework_type IN (
        'Homework', 'Assignment', 'Project', 'Worksheet',
        'Practical', 'Reading', 'Activity'
    )
);

ALTER TABLE public.homework DROP CONSTRAINT IF EXISTS chk_homework_max_attempts;
ALTER TABLE public.homework ADD CONSTRAINT chk_homework_max_attempts CHECK (max_attempts >= 1);

-- 2) Homework attachments
CREATE TABLE IF NOT EXISTS public.homework_attachments (
    id SERIAL PRIMARY KEY,
    homework_id integer NOT NULL REFERENCES public.homework(id) ON DELETE CASCADE,
    file_name character varying(255) NOT NULL,
    file_path text NOT NULL,
    file_type character varying(100),
    file_size bigint,
    uploaded_by integer,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 3) Homework recipients
CREATE TABLE IF NOT EXISTS public.homework_recipients (
    id SERIAL PRIMARY KEY,
    homework_id integer NOT NULL REFERENCES public.homework(id) ON DELETE CASCADE,
    student_id integer NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    student_lifecycle_id integer NOT NULL,
    academic_year_id integer NOT NULL,
    class_id integer NOT NULL,
    status character varying(20) DEFAULT 'Assigned',
    viewed_at TIMESTAMPTZ,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_homework_recipient_status CHECK (
        status IN ('Assigned', 'Viewed', 'Completed')
    ),
    CONSTRAINT uq_homework_student UNIQUE (homework_id, student_id)
);

ALTER TABLE public.homework_recipients DROP CONSTRAINT IF EXISTS fk_homework_recipient_lifecycle;
ALTER TABLE public.homework_recipients ADD CONSTRAINT fk_homework_recipient_lifecycle
    FOREIGN KEY (student_lifecycle_id, student_id, academic_year_id, class_id)
    REFERENCES public.student_lifecycle_ledger (id, student_id, to_academic_year_id, to_class_id);

ALTER TABLE public.homework_recipients DROP CONSTRAINT IF EXISTS fk_homework_recipient_homework_context;
ALTER TABLE public.homework_recipients ADD CONSTRAINT fk_homework_recipient_homework_context
    FOREIGN KEY (homework_id, class_id, academic_year_id)
    REFERENCES public.homework (id, class_id, academic_year_id);

-- 4) Homework submissions — extend workflow
ALTER TABLE public.homework_submissions ADD COLUMN IF NOT EXISTS is_late boolean DEFAULT false;
ALTER TABLE public.homework_submissions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE public.homework_submissions ADD COLUMN IF NOT EXISTS returned_for_correction boolean DEFAULT false;
ALTER TABLE public.homework_submissions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.homework_submissions DROP COLUMN IF EXISTS attachment_url;

ALTER TABLE public.homework_submissions ALTER COLUMN status TYPE character varying(30);
ALTER TABLE public.homework_submissions ALTER COLUMN status SET DEFAULT 'Submitted';

ALTER TABLE public.homework_submissions DROP CONSTRAINT IF EXISTS homework_submissions_status_check;
ALTER TABLE public.homework_submissions DROP CONSTRAINT IF EXISTS chk_submission_status;
ALTER TABLE public.homework_submissions ADD CONSTRAINT chk_submission_status CHECK (
    status IN (
        'Draft', 'Submitted', 'Late', 'Under Review',
        'Evaluated', 'Returned', 'Resubmission Requested'
    )
);

ALTER TABLE public.homework_submissions DROP CONSTRAINT IF EXISTS chk_homework_submission_attempt;
ALTER TABLE public.homework_submissions ADD CONSTRAINT chk_homework_submission_attempt CHECK (attempt_number >= 1);

-- 5) Submission attachments
CREATE TABLE IF NOT EXISTS public.submission_attachments (
    id SERIAL PRIMARY KEY,
    submission_id integer NOT NULL REFERENCES public.homework_submissions(id) ON DELETE CASCADE,
    file_name character varying(255) NOT NULL,
    file_path text NOT NULL,
    file_type character varying(100),
    file_size bigint,
    uploaded_by integer,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 6) Indexes
CREATE INDEX IF NOT EXISTS idx_homework_context
    ON public.homework (class_section_id, class_subject_id, academic_year_id)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_homework_due_date ON public.homework (due_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_homework_status ON public.homework (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_homework_publish ON public.homework (publish_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_homework_attachments_homework
    ON public.homework_attachments (homework_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_homework_recipients_student ON public.homework_recipients (student_id);
CREATE INDEX IF NOT EXISTS idx_homework_recipients_homework ON public.homework_recipients (homework_id);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_student
    ON public.homework_submissions (student_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_homework_submissions_homework
    ON public.homework_submissions (homework_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_submission_status
    ON public.homework_submissions (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_submission_attachments_submission
    ON public.submission_attachments (submission_id) WHERE deleted_at IS NULL;
