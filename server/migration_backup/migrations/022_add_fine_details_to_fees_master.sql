-- Migration to add due date and fine details to fees_master
ALTER TABLE fees_master 
ADD COLUMN IF NOT EXISTS due_date DATE,
ADD COLUMN IF NOT EXISTS fine_type VARCHAR(20) DEFAULT 'None',
ADD COLUMN IF NOT EXISTS fine_amount NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS fine_percentage NUMERIC(5, 2) DEFAULT 0;
