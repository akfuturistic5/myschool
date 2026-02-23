-- Fix fee_collections payment_method check constraint to allow: cash, upi, card
-- Run this migration if you get: fee_collections_payment_method_check constraint violation

-- 1. Drop existing check constraint (if it exists)
ALTER TABLE fee_collections DROP CONSTRAINT IF EXISTS fee_collections_payment_method_check;

-- 2. Update existing rows: map old values to new allowed values
--    Cash/CASH -> cash, Paytm/UPI -> upi, Card/Cash On Delivery/NULL/other -> card
UPDATE fee_collectionsatte
SET payment_method = CASE
  WHEN payment_method IS NULL OR TRIM(payment_method) = '' THEN 'cash'
  WHEN LOWER(TRIM(payment_method)) = 'cash' THEN 'cash'
  WHEN LOWER(TRIM(payment_method)) IN ('paytm', 'upi') THEN 'upi'
  ELSE 'card'
END
WHERE payment_method IS NULL
   OR TRIM(payment_method) = ''
   OR LOWER(TRIM(payment_method)) NOT IN ('cash', 'upi', 'card');

-- 3. Add new check constraint allowing: cash, upi, card
ALTER TABLE fee_collections ADD CONSTRAINT fee_collections_payment_method_check
  CHECK (payment_method IN ('cash', 'upi', 'card'));
sa
