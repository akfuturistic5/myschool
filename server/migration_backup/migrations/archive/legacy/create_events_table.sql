-- =====================================================
-- EVENTS TABLE - School-wide events (visible to all roles)
-- Used by: Headmaster/Admin to add events; Parent, Guardian, Teacher, Student dashboards
-- =====================================================

CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP,
    event_color VARCHAR(50) DEFAULT 'bg-primary',
    is_all_day BOOLEAN DEFAULT FALSE,
    location VARCHAR(255),
    event_category VARCHAR(50),
    event_for VARCHAR(20) DEFAULT 'all',
    target_class_ids JSONB,
    target_section_ids JSONB,
    attachment_url TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_end_date ON events(end_date);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
CREATE INDEX IF NOT EXISTS idx_events_event_for ON events(event_for);
CREATE INDEX IF NOT EXISTS idx_events_event_category ON events(event_category);

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
