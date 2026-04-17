BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'holidays'
  ) THEN
    CREATE TABLE public.holidays (
      id SERIAL PRIMARY KEY,
      holiday_name VARCHAR(200) NOT NULL,
      title VARCHAR(200) NULL,
      description TEXT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      holiday_type VARCHAR(32) NULL,
      academic_year_id INTEGER NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_by INTEGER NULL REFERENCES public.users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      modified_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT holidays_date_range_check CHECK (start_date <= end_date)
    );
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'holidays' AND column_name = 'title'
    ) THEN
      ALTER TABLE public.holidays ADD COLUMN title VARCHAR(200) NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'holidays' AND column_name = 'updated_at'
    ) THEN
      ALTER TABLE public.holidays ADD COLUMN updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'holidays' AND column_name = 'modified_at'
    ) THEN
      ALTER TABLE public.holidays ADD COLUMN modified_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'holidays' AND column_name = 'is_active'
    ) THEN
      ALTER TABLE public.holidays ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'holidays' AND column_name = 'holiday_name'
  ) THEN
    UPDATE public.holidays
       SET title = COALESCE(NULLIF(TRIM(title), ''), holiday_name)
     WHERE title IS NULL OR TRIM(title) = '';
  END IF;
END $$;

ALTER TABLE public.holidays DROP CONSTRAINT IF EXISTS holidays_holiday_type_check;
ALTER TABLE public.holidays DROP CONSTRAINT IF EXISTS holidays_type_check;
ALTER TABLE public.holidays
  ADD CONSTRAINT holidays_holiday_type_check
  CHECK (
    holiday_type IS NULL OR holiday_type IN (
      'public', 'school', 'custom',
      'national', 'religious', 'academic', 'optional'
    )
  );

ALTER TABLE public.holidays DROP CONSTRAINT IF EXISTS holidays_date_range_check;
ALTER TABLE public.holidays
  ADD CONSTRAINT holidays_date_range_check CHECK (start_date <= end_date);

CREATE INDEX IF NOT EXISTS idx_holidays_start_end ON public.holidays(start_date, end_date);

COMMIT;
