-- Add duration_days and status to transport_fee_master
ALTER TABLE public.transport_fee_master 
ADD COLUMN IF NOT EXISTS duration_days integer,
ADD COLUMN IF NOT EXISTS status character varying(20) DEFAULT 'Active';

-- Add status check constraint
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE table_name = 'transport_fee_master' AND constraint_name = 'transport_fee_master_status_check') THEN
        ALTER TABLE public.transport_fee_master ADD CONSTRAINT transport_fee_master_status_check CHECK (status IN ('Active', 'Inactive'));
    END IF;
END $$;
