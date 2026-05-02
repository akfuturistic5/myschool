-- =====================================================
-- NOTICE_BOARD TABLE
-- For: Announcements > Notice Board
-- Run this migration to create and seed notice_board table.
-- =====================================================

CREATE TABLE IF NOT EXISTS notice_board (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    content TEXT,
    message_to VARCHAR(100) DEFAULT 'All',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notice_board_created_at ON notice_board(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notice_board_modified_at ON notice_board(modified_at DESC);

-- Trigger to auto-update modified_at on UPDATE
CREATE OR REPLACE FUNCTION update_notice_board_modified_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.modified_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_notice_board_modified_at ON notice_board;
CREATE TRIGGER update_notice_board_modified_at
    BEFORE UPDATE ON notice_board
    FOR EACH ROW
    EXECUTE FUNCTION update_notice_board_modified_at();

-- Seed data (run only if table is empty)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM notice_board LIMIT 1) THEN
    INSERT INTO notice_board (title, content, message_to) VALUES
      ('Classes Preparation', 'Please ensure all class materials are ready for the new session. Teachers are requested to submit lesson plans by end of week.', 'All'),
      ('Fees Reminder', 'Kindly pay the pending fees before the due date to avoid late charges. Contact accounts office for any queries.', 'All'),
      ('Parents Teacher Meeting', 'PTM scheduled for this Saturday. All parents are requested to attend. Timings: 10:00 AM - 1:00 PM.', 'Parents'),
      ('New Academic Session For Admission (2024-25)', 'Admission for the new academic session is now open. Submit applications before the deadline.', 'All'),
      ('Staff Meeting', 'All staff meeting on Friday at 3:00 PM in the conference room. Attendance is mandatory.', 'Staff'),
      ('World Environment Day Program', 'Join us for World Environment Day celebration. Plantation drive and awareness programs planned.', 'All'),
      ('New Syllabus Instructions', 'Updated syllabus for all classes is available. Please review and align your teaching plans accordingly.', 'Teachers'),
      ('Exam Preparation Notification', 'Final exams begin next month. Students are advised to complete revision and submit pending assignments.', 'Students'),
      ('Online Classes Preparation', 'Technical setup for hybrid learning is complete. Teachers should familiarize themselves with the platform.', 'Teachers'),
      ('Exam Time Table Release', 'Exam time table has been published. Students can collect hard copies from the office or check online.', 'Students');
  END IF;
END $$;

-- If notice_board already existed without modified_at, add it now
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notice_board') THEN
    ALTER TABLE notice_board ADD COLUMN IF NOT EXISTS modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
