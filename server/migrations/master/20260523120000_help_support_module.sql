-- Help & Support module (master_db)
-- Platform help center content + cross-school support tickets

-- Categories for help articles
CREATE TABLE IF NOT EXISTS public.help_categories (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_help_categories_active_sort ON public.help_categories(is_active, sort_order);

-- Help articles / guides
CREATE TABLE IF NOT EXISTS public.help_articles (
    id SERIAL PRIMARY KEY,
    category_id INT NOT NULL REFERENCES public.help_categories(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content TEXT NOT NULL DEFAULT '',
    status VARCHAR(32) NOT NULL DEFAULT 'published',
    sort_order INT NOT NULL DEFAULT 0,
    created_by_super_admin_id INT,
    updated_by_super_admin_id INT,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_help_article_status CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_help_articles_category ON public.help_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_help_articles_status ON public.help_articles(status) WHERE deleted_at IS NULL;

-- FAQs
CREATE TABLE IF NOT EXISTS public.help_faqs (
    id SERIAL PRIMARY KEY,
    category_slug VARCHAR(80),
    question VARCHAR(500) NOT NULL,
    answer TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_help_faqs_active_sort ON public.help_faqs(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_help_faqs_category ON public.help_faqs(category_slug);

-- Support tickets (school-scoped via school_id)
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id SERIAL PRIMARY KEY,
    ticket_number VARCHAR(32) NOT NULL UNIQUE,
    school_id INT NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    created_by_user_id INT NOT NULL,
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(64) NOT NULL,
    priority VARCHAR(32) NOT NULL DEFAULT 'medium',
    status VARCHAR(64) NOT NULL DEFAULT 'open',
    last_reply_at TIMESTAMPTZ,
    last_reply_by VARCHAR(32),
    closed_at TIMESTAMPTZ,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    status_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_support_ticket_priority CHECK (
        priority IN ('low', 'medium', 'high', 'critical')
    ),
    CONSTRAINT chk_support_ticket_status CHECK (
        status IN ('open', 'in_progress', 'waiting_for_response', 'resolved', 'closed')
    )
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_school ON public.support_tickets(school_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_support_tickets_created ON public.support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_number ON public.support_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_support_tickets_messages ON public.support_tickets USING GIN (messages);
CREATE INDEX IF NOT EXISTS idx_support_tickets_attachments ON public.support_tickets USING GIN (attachments);

-- Upgrade older installs that used separate ticket child tables
ALTER TABLE public.support_tickets
    ADD COLUMN IF NOT EXISTS messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS status_history JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'support_ticket_messages'
    ) THEN
        UPDATE public.support_tickets t
        SET messages = COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', m.id,
                    'sender_type', m.sender_type,
                    'sender_user_id', m.sender_user_id,
                    'sender_super_admin_id', m.sender_super_admin_id,
                    'sender_name', m.sender_name,
                    'message', m.message,
                    'is_internal_note', m.is_internal_note,
                    'created_at', m.created_at
                ) ORDER BY m.created_at
            )
            FROM public.support_ticket_messages m
            WHERE m.ticket_id = t.id
        ), '[]'::jsonb)
        WHERE EXISTS (SELECT 1 FROM public.support_ticket_messages m WHERE m.ticket_id = t.id);

        UPDATE public.support_tickets t
        SET attachments = COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', a.id,
                    'message_id', a.message_id,
                    'school_id', a.school_id,
                    'file_name', a.file_name,
                    'file_path', a.file_path,
                    'file_type', a.file_type,
                    'file_size', a.file_size,
                    'uploaded_by_type', a.uploaded_by_type,
                    'uploaded_by_id', a.uploaded_by_id,
                    'created_at', a.created_at
                ) ORDER BY a.created_at
            )
            FROM public.support_ticket_attachments a
            WHERE a.ticket_id = t.id
        ), '[]'::jsonb)
        WHERE EXISTS (SELECT 1 FROM public.support_ticket_attachments a WHERE a.ticket_id = t.id);

        UPDATE public.support_tickets t
        SET status_history = COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', h.id,
                    'from_status', h.from_status,
                    'to_status', h.to_status,
                    'changed_by_type', h.changed_by_type,
                    'changed_by_id', h.changed_by_id,
                    'changed_by_name', h.changed_by_name,
                    'note', h.note,
                    'created_at', h.created_at
                ) ORDER BY h.created_at
            )
            FROM public.support_ticket_status_history h
            WHERE h.ticket_id = t.id
        ), '[]'::jsonb)
        WHERE EXISTS (SELECT 1 FROM public.support_ticket_status_history h WHERE h.ticket_id = t.id);

        DROP TABLE IF EXISTS public.support_ticket_attachments CASCADE;
        DROP TABLE IF EXISTS public.support_ticket_messages CASCADE;
        DROP TABLE IF EXISTS public.support_ticket_status_history CASCADE;
    END IF;
END $$;

-- Remove denormalized / unused ticket columns (creator resolved via created_by_user_id + tenant users)
--ALTER TABLE public.support_tickets
  --  DROP COLUMN IF EXISTS created_by_name,
  --  DROP COLUMN IF EXISTS created_by_email,
  --  DROP COLUMN IF EXISTS assigned_super_admin_id,
   -- DROP COLUMN IF EXISTS resolved_at;

--ALTER TABLE public.help_categories
  --  DROP COLUMN IF EXISTS icon;

--ALTER TABLE public.help_articles
   -- DROP COLUMN IF EXISTS slug;

--DROP INDEX IF EXISTS public.idx_help_articles_tags;

--ALTER TABLE public.help_articles
  --  DROP CONSTRAINT IF EXISTS chk_help_article_visibility;

--ALTER TABLE public.help_articles
  --  DROP COLUMN IF EXISTS tags,
  --  DROP COLUMN IF EXISTS visibility,
    --DROP COLUMN IF EXISTS view_count;

--ALTER TABLE public.help_faqs
  --  DROP COLUMN IF EXISTS tags;

ALTER TABLE public.support_tickets
    DROP COLUMN IF EXISTS tags;

-- Ticket number sequence per year
CREATE SEQUENCE IF NOT EXISTS support_ticket_number_seq START 1000;

-- Seed categories
INSERT INTO public.help_categories (slug, name, description, sort_order)
VALUES
    ('getting-started', 'Getting Started', 'Set up your school and learn the basics', 0),
    ('student-management', 'Student Management', 'Admissions, profiles, and student records', 10),
    ('teacher-management', 'Teacher Management', 'Staff, assignments, and teacher workflows', 20),
    ('fees-payments', 'Fees & Payments', 'Fee structures, collection, and receipts', 30),
    ('attendance', 'Attendance', 'Daily attendance and reports', 40),
    ('timetable', 'Timetable', 'Schedules, periods, and class timetables', 50),
    ('exams', 'Exams', 'Examinations, results, and grading', 60),
    ('reports', 'Reports', 'Analytics and exportable reports', 70),
    ('notifications', 'Notifications', 'Notices, events, and communication', 80),
    ('technical-issues', 'Technical Issues', 'Troubleshooting and system help', 90),
    ('account-security', 'Account & Security', 'Users, roles, and security settings', 100)
ON CONFLICT (slug) DO NOTHING;

-- Seed starter articles (minimal content; Super Admin can expand)
DO $$
DECLARE
    cat_id INT;
BEGIN
    SELECT id INTO cat_id FROM public.help_categories WHERE slug = 'getting-started' LIMIT 1;
    IF cat_id IS NOT NULL THEN
        INSERT INTO public.help_articles (category_id, title, description, content, status, sort_order, published_at)
        SELECT
            cat_id,
            'Welcome to MySchool',
            'A quick overview of your school admin panel and where to find key features.',
            '<h2>Welcome</h2><p>MySchool helps you manage students, staff, academics, fees, and more from one place.</p><h3>First steps</h3><ol><li>Complete your <strong>School Settings</strong> profile and logo.</li><li>Set up the current <strong>Academic Year</strong>.</li><li>Add classes, sections, and subjects.</li><li>Invite teachers and import or add students.</li></ol><div class="alert alert-info"><strong>Tip:</strong> Use the academic year selector in the header when working across years.</div>',
            'published',
            0,
            NOW()
        WHERE NOT EXISTS (
            SELECT 1 FROM public.help_articles
            WHERE category_id = cat_id AND title = 'Welcome to MySchool' AND deleted_at IS NULL
        );
    END IF;

    SELECT id INTO cat_id FROM public.help_categories WHERE slug = 'student-management' LIMIT 1;
    IF cat_id IS NOT NULL THEN
        INSERT INTO public.help_articles (category_id, title, description, content, status, sort_order, published_at)
        SELECT
            cat_id,
            'Add and manage students',
            'How to register students, assign classes, and maintain records.',
            '<h2>Adding students</h2><p>Go to <strong>Peoples → Students → Add Student</strong> to create a new admission.</p><h3>Key fields</h3><ul><li>Admission number (unique per school)</li><li>Class and section for the active academic year</li><li>Parent/guardian contact details</li></ul><p>Use bulk import where available to save time at the start of term.</p>',
            'published',
            0,
            NOW()
        WHERE NOT EXISTS (
            SELECT 1 FROM public.help_articles
            WHERE category_id = cat_id AND title = 'Add and manage students' AND deleted_at IS NULL
        );
    END IF;
END $$;

-- Seed FAQs
INSERT INTO public.help_faqs (category_slug, question, answer, sort_order)
VALUES
    ('getting-started', 'How do I reset my password?', 'Use <strong>Forgot Password</strong> on the login page, or ask your headmaster to reset your account from User Management.', 0),
    ('getting-started', 'Who can access the Help & Support page?', 'Only Headmaster and Administrative roles can access Help & Support and raise tickets.', 10),
    ('fees-payments', 'Why is a student fee showing as overdue?', 'Check that fees are assigned for the correct academic year and that due dates on the fee master are set correctly.', 0),
    ('technical-issues', 'The page is not loading after login. What should I do?', 'Clear your browser cache, ensure you are on a supported browser (Chrome, Edge, Firefox), and try again. If the issue persists, raise a support ticket with a screenshot.', 0),
    ('account-security', 'How do I add another administrative user?', 'Headmaster can create users from <strong>User Management</strong> and assign the Administrative role with appropriate access.', 0);
