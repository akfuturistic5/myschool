-- Migration: Add deleted_at columns for soft delete audit
-- Added on: 2026-04-22

ALTER TABLE students ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Also update existing indexes or add new ones if performance is an issue, 
-- but for now, simple columns are enough.
