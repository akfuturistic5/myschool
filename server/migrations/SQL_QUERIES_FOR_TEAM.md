# SQL Queries for Application Sections Tables

This document contains all the SQL queries used to create the database tables for the application sections (Chat, Call, Calendar, Email, To Do, Notes, File Manager).

## Database Migration File

The complete migration file is located at: `server/migrations/create_application_tables.sql`

## Tables Created

1. **chats** - For chat messages and conversations
2. **calls** - For call history
3. **calendar_events** - For calendar events
4. **emails** - For email messages
5. **todos** - For todo tasks
6. **notes** - For notes
7. **files** - For file manager

## Complete SQL Migration

```sql
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
```

## Sample Data Insertion

The migration file also includes sample data insertion that uses existing users from your users table. The sample data is inserted only if users exist in the database.

## How to Run

The migration has already been executed. If you need to run it again or share with team members:

1. **Using psql command line:**
   ```bash
   psql -U schooluser -d schooldb -f server/migrations/create_application_tables.sql
   ```

2. **Using Node.js:**
   ```bash
   cd server
   node -e "const { query } = require('./src/config/database'); const fs = require('fs'); const sql = fs.readFileSync('./migrations/create_application_tables.sql', 'utf8'); (async () => { try { await query(sql); console.log('✅ Tables created successfully!'); process.exit(0); } catch (e) { console.error('❌ Error:', e.message); process.exit(1); } })();"
   ```

## API Endpoints Created

All endpoints require authentication (JWT token). Base URL: `/api`

### Chats
- `GET /chats` - Get all chats for current user
- `GET /chats/conversations` - Get conversations grouped by recipient
- `GET /chats/:id` - Get chat by ID
- `POST /chats` - Create new chat
- `PUT /chats/:id` - Update chat
- `DELETE /chats/:id` - Delete chat

### Calls
- `GET /calls` - Get all calls for current user
- `GET /calls/:id` - Get call by ID
- `POST /calls` - Create new call
- `PUT /calls/:id` - Update call
- `DELETE /calls/:id` - Delete call

### Calendar Events
- `GET /calendar` - Get all calendar events for current user
- `GET /calendar/:id` - Get event by ID
- `POST /calendar` - Create new event
- `PUT /calendar/:id` - Update event
- `DELETE /calendar/:id` - Delete event

### Emails
- `GET /emails?folder=inbox` - Get emails for current user (folder: inbox, sent, drafts, trash)
- `GET /emails/:id` - Get email by ID
- `POST /emails` - Create new email
- `PUT /emails/:id` - Update email
- `DELETE /emails/:id` - Move email to trash

### Todos
- `GET /todos` - Get all todos for current user
- `GET /todos/:id` - Get todo by ID
- `POST /todos` - Create new todo
- `PUT /todos/:id` - Update todo
- `DELETE /todos/:id` - Delete todo

### Notes
- `GET /notes` - Get all notes for current user
- `GET /notes/:id` - Get note by ID
- `POST /notes` - Create new note
- `PUT /notes/:id` - Update note
- `DELETE /notes/:id` - Soft delete note

### Files
- `GET /files` - Get all files for current user
- `GET /files/:id` - Get file by ID
- `POST /files` - Create new file/folder
- `PUT /files/:id` - Update file
- `DELETE /files/:id` - Delete file

## Important Notes

1. **User Data Isolation**: All queries automatically filter by `user_id` from the authenticated user's JWT token. No user can see another user's data.

2. **Foreign Keys**: All tables reference the `users` table with `ON DELETE CASCADE` to ensure data integrity.

3. **Indexes**: All tables have indexes on `user_id` and other frequently queried columns for optimal performance.

4. **Timestamps**: All tables have `created_at` and most have `updated_at` timestamps that are automatically managed.

5. **Soft Deletes**: Notes use soft delete (`is_deleted` flag) instead of hard delete.

6. **Sample Data**: The migration includes sample data insertion that uses existing users from your database.

## Frontend Integration

The frontend has been updated with:
- Hooks: `useChats`, `useCalls`, `useCalendarEvents`, `useEmails`, `useTodos`, `useNotes`, `useFiles`
- API Service methods for all endpoints
- Example implementation in Call History component

To update other components, replace dummy data imports with the appropriate hooks and map the API response to match the component's expected data structure.
