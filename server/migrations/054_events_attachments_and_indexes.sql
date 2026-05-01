BEGIN;

-- Event attachment metadata (supports multiple files per event)
CREATE TABLE IF NOT EXISTS public.event_attachments (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(120),
  file_size BIGINT,
  relative_path TEXT,
  uploaded_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Query/perf indexes for attachments
CREATE INDEX IF NOT EXISTS idx_event_attachments_event_id ON public.event_attachments(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attachments_uploaded_by ON public.event_attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_event_attachments_created_at ON public.event_attachments(created_at DESC);

-- Reinforce filtering indexes for events (safe no-op if already present)
CREATE INDEX IF NOT EXISTS idx_events_start_date ON public.events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_end_date ON public.events(end_date);
CREATE INDEX IF NOT EXISTS idx_events_event_category ON public.events(event_category);
CREATE INDEX IF NOT EXISTS idx_events_event_for ON public.events(event_for);

COMMIT;

