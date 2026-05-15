-- Migration to add legacy document columns to staff table
-- This replaces the functionality from the deprecated teachers table
-- while maintaining compatibility with the existing document upload API logic.

ALTER TABLE staff
ADD COLUMN IF NOT EXISTS resume TEXT,
ADD COLUMN IF NOT EXISTS joining_letter TEXT;
