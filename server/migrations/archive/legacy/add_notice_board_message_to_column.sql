-- Add message_to column to notice_board if it doesn't exist
-- Fix for: column "message_to" does not exist (HTTP 500 on notice board)

ALTER TABLE notice_board ADD COLUMN IF NOT EXISTS message_to VARCHAR(100) DEFAULT 'All';
