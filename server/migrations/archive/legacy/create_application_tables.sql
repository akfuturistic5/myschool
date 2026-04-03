-- =====================================================
-- Application Sections Database Tables
-- Created for: Chat, Call, Calendar, Email, To Do, Notes, File Manager
-- =====================================================

-- =====================================================
-- 1. CHATS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS chats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE,
    message_type VARCHAR(20) DEFAULT 'text', -- text, image, file, video, audio
    file_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_recipient_id ON chats(recipient_id);
CREATE INDEX IF NOT EXISTS idx_chats_created_at ON chats(created_at DESC);

-- =====================================================
-- 2. CALLS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS calls (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    call_type VARCHAR(20) NOT NULL, -- incoming, outgoing, missed
    phone_number VARCHAR(20),
    duration INTEGER DEFAULT 0, -- duration in seconds
    call_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calls_user_id ON calls(user_id);
CREATE INDEX IF NOT EXISTS idx_calls_recipient_id ON calls(recipient_id);
CREATE INDEX IF NOT EXISTS idx_calls_call_date ON calls(call_date DESC);

-- =====================================================
-- 3. CALENDAR_EVENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS calendar_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP,
    event_color VARCHAR(20) DEFAULT 'bg-primary', -- bg-primary, bg-success, bg-danger, bg-warning, bg-info, bg-purple
    is_all_day BOOLEAN DEFAULT FALSE,
    location VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_date ON calendar_events(start_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_end_date ON calendar_events(end_date);

-- =====================================================
-- 4. EMAILS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS emails (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    sender_email VARCHAR(255),
    recipient_email VARCHAR(255),
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    is_starred BOOLEAN DEFAULT FALSE,
    is_important BOOLEAN DEFAULT FALSE,
    folder VARCHAR(50) DEFAULT 'inbox', -- inbox, sent, drafts, trash, spam
    has_attachment BOOLEAN DEFAULT FALSE,
    attachment_url TEXT,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_emails_user_id ON emails(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_sender_id ON emails(sender_id);
CREATE INDEX IF NOT EXISTS idx_emails_folder ON emails(folder);
CREATE INDEX IF NOT EXISTS idx_emails_sent_at ON emails(sent_at DESC);

-- =====================================================
-- 5. TODOS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS todos (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date TIMESTAMP,
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high
    status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, done, cancelled
    tag VARCHAR(50), -- pending, onhold, inprogress, done
    is_important BOOLEAN DEFAULT FALSE,
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
CREATE INDEX IF NOT EXISTS idx_todos_priority ON todos(priority);
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);

-- =====================================================
-- 6. NOTES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    tag VARCHAR(50), -- pending, onhold, inprogress, done
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high
    is_important BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_is_deleted ON notes(is_deleted);
CREATE INDEX IF NOT EXISTS idx_notes_priority ON notes(priority);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);

-- =====================================================
-- 7. FILES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS files (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50), -- file, folder
    mime_type VARCHAR(100), -- image/jpeg, application/pdf, etc.
    size BIGINT DEFAULT 0, -- size in bytes
    file_url TEXT,
    parent_folder_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
    is_folder BOOLEAN DEFAULT FALSE,
    is_shared BOOLEAN DEFAULT FALSE,
    shared_with INTEGER[], -- array of user_ids
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_parent_folder_id ON files(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_files_file_type ON files(file_type);
CREATE INDEX IF NOT EXISTS idx_files_is_folder ON files(is_folder);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at DESC);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at
CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON chats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON calendar_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_emails_updated_at BEFORE UPDATE ON emails
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_todos_updated_at BEFORE UPDATE ON todos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SAMPLE DATA INSERTION (Using existing users from users table)
-- =====================================================
-- Note: This will only insert data if users exist in the users table
-- Replace user IDs with actual user IDs from your users table

DO $$
DECLARE
    sample_user_id INTEGER;
    sample_user_id_2 INTEGER;
BEGIN
    -- Get first two active users for sample data
    SELECT id INTO sample_user_id FROM users WHERE is_active = true LIMIT 1;
    SELECT id INTO sample_user_id_2 FROM users WHERE is_active = true AND id != sample_user_id LIMIT 1;
    
    -- Only insert if we have users
    IF sample_user_id IS NOT NULL THEN
        
        -- Insert sample chats
        INSERT INTO chats (user_id, recipient_id, message, is_read, is_pinned, message_type)
        VALUES 
            (sample_user_id, sample_user_id_2, 'Hello! How are you?', false, true, 'text'),
            (sample_user_id, sample_user_id_2, 'Have you completed the assignment?', false, false, 'text'),
            (sample_user_id_2, sample_user_id, 'Yes, I have completed it.', true, false, 'text')
        ON CONFLICT DO NOTHING;
        
        -- Calls: no sample data - calls appear only when user makes/receives real calls
        
        -- Insert sample calendar events
        INSERT INTO calendar_events (user_id, title, description, start_date, end_date, event_color, is_all_day)
        VALUES 
            (sample_user_id, 'Team Meeting', 'Discuss project progress', CURRENT_TIMESTAMP + INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '1 day' + INTERVAL '1 hour', 'bg-primary', false),
            (sample_user_id, 'School Event', 'Annual day celebration', CURRENT_TIMESTAMP + INTERVAL '5 days', CURRENT_TIMESTAMP + INTERVAL '5 days', 'bg-success', true),
            (sample_user_id, 'Parent-Teacher Meeting', 'Discuss student progress', CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP + INTERVAL '7 days' + INTERVAL '2 hours', 'bg-info', false)
        ON CONFLICT DO NOTHING;
        
        -- Insert sample emails
        INSERT INTO emails (user_id, sender_id, sender_email, subject, body, is_read, is_starred, folder)
        VALUES 
            (sample_user_id, sample_user_id_2, 'sender@example.com', 'Welcome to School Management System', 'This is a welcome email.', false, true, 'inbox'),
            (sample_user_id, sample_user_id_2, 'admin@example.com', 'Important Notice', 'Please review the attached document.', false, false, 'inbox'),
            (sample_user_id, NULL, 'noreply@example.com', 'System Update', 'The system will be updated tonight.', true, false, 'inbox')
        ON CONFLICT DO NOTHING;
        
        -- Insert sample todos
        INSERT INTO todos (user_id, title, description, due_date, priority, status, tag, is_important)
        VALUES 
            (sample_user_id, 'Complete Assignment', 'Finish the math homework', CURRENT_TIMESTAMP + INTERVAL '1 day', 'high', 'pending', 'pending', true),
            (sample_user_id, 'Review Notes', 'Review class notes for exam', CURRENT_TIMESTAMP + INTERVAL '3 days', 'medium', 'in_progress', 'inprogress', false),
            (sample_user_id, 'Submit Project', 'Submit the science project', CURRENT_TIMESTAMP - INTERVAL '1 day', 'high', 'done', 'done', true)
        ON CONFLICT DO NOTHING;
        
        -- Insert sample notes
        INSERT INTO notes (user_id, title, content, tag, priority, is_important)
        VALUES 
            (sample_user_id, 'Class Notes - Math', 'Today we learned about algebra and quadratic equations.', NULL, 'medium', false),
            (sample_user_id, 'Important Reminders', 'Remember to bring lab coat tomorrow. Submit assignment by Friday.', 'pending', 'high', true),
            (sample_user_id, 'Study Plan', 'Study chapters 1-5 for the upcoming test.', 'inprogress', 'medium', false)
        ON CONFLICT DO NOTHING;
        
        -- Insert sample files (folders and files)
        INSERT INTO files (user_id, name, file_type, mime_type, size, is_folder, parent_folder_id)
        VALUES 
            (sample_user_id, 'Documents', 'folder', NULL, 0, true, NULL),
            (sample_user_id, 'Assignments', 'folder', NULL, 0, true, NULL),
            (sample_user_id, 'Math Assignment.pdf', 'file', 'application/pdf', 1024000, false, (SELECT id FROM files WHERE name = 'Assignments' AND user_id = sample_user_id LIMIT 1)),
            (sample_user_id, 'Science Project.docx', 'file', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 2048000, false, (SELECT id FROM files WHERE name = 'Documents' AND user_id = sample_user_id LIMIT 1))
        ON CONFLICT DO NOTHING;
        
    END IF;
END $$;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
