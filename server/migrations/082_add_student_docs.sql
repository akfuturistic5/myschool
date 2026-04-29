-- Migration: Add medical and TC document paths to students
-- Date: 2026-04-27

ALTER TABLE students ADD COLUMN IF NOT EXISTS medical_document_path character varying(500);
ALTER TABLE students ADD COLUMN IF NOT EXISTS transfer_certificate_path character varying(500);
