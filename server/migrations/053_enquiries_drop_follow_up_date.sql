-- Enquiries module cleanup: remove unused follow_up_date column.

ALTER TABLE enquiries
  DROP COLUMN IF EXISTS follow_up_date;

