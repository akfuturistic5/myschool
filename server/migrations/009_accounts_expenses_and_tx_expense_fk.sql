-- Expense categories + expenses; link ledger rows to expenses (run after 004_accounts_module.sql).
-- Idempotent.

CREATE TABLE IF NOT EXISTS public.accounts_expense_categories (
  id integer NOT NULL PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  academic_year_id integer,
  category_name character varying(255) NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT accounts_expense_categories_academic_year_id_fkey FOREIGN KEY (academic_year_id)
    REFERENCES public.academic_years (id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_expense_categories_name_year
  ON public.accounts_expense_categories (lower(trim(category_name::text)), COALESCE(academic_year_id, -1));

CREATE INDEX IF NOT EXISTS idx_accounts_expense_categories_year
  ON public.accounts_expense_categories (academic_year_id);

CREATE TABLE IF NOT EXISTS public.accounts_expenses (
  id integer NOT NULL PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  academic_year_id integer,
  category_id integer NOT NULL,
  expense_name character varying(255) NOT NULL,
  description text,
  expense_date date NOT NULL,
  amount numeric(14,2) NOT NULL,
  invoice_no character varying(64),
  payment_method character varying(64),
  status character varying(32) NOT NULL DEFAULT 'Completed',
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT accounts_expenses_amount_positive CHECK (amount > 0::numeric),
  CONSTRAINT accounts_expenses_academic_year_id_fkey FOREIGN KEY (academic_year_id)
    REFERENCES public.academic_years (id) ON DELETE SET NULL,
  CONSTRAINT accounts_expenses_category_id_fkey FOREIGN KEY (category_id)
    REFERENCES public.accounts_expense_categories (id) ON DELETE RESTRICT,
  CONSTRAINT accounts_expenses_status_check CHECK (
    (status)::text = ANY (ARRAY['Completed'::character varying, 'Pending'::character varying]::text[])
  )
);

DROP INDEX IF EXISTS idx_accounts_expenses_invoice_year;
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_expenses_invoice_year
  ON public.accounts_expenses (trim(invoice_no::text), COALESCE(academic_year_id, -1))
  WHERE invoice_no IS NOT NULL AND trim(invoice_no::text) <> '';

CREATE INDEX IF NOT EXISTS idx_accounts_expenses_year ON public.accounts_expenses (academic_year_id);
CREATE INDEX IF NOT EXISTS idx_accounts_expenses_category ON public.accounts_expenses (category_id);
CREATE INDEX IF NOT EXISTS idx_accounts_expenses_date ON public.accounts_expenses (expense_date);

ALTER TABLE public.accounts_transactions
  ADD COLUMN IF NOT EXISTS expense_id integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounts_transactions_expense_id_fkey'
  ) THEN
    ALTER TABLE public.accounts_transactions
      ADD CONSTRAINT accounts_transactions_expense_id_fkey
      FOREIGN KEY (expense_id) REFERENCES public.accounts_expenses (id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_accounts_transactions_expense ON public.accounts_transactions (expense_id);

-- Income: duplicate invoice number per academic year (when invoice_no set)
DROP INDEX IF EXISTS idx_accounts_income_invoice_year;
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_income_invoice_year
  ON public.accounts_income (trim(invoice_no::text), COALESCE(academic_year_id, -1))
  WHERE invoice_no IS NOT NULL AND trim(invoice_no::text) <> '';

-- At most one source: income XOR expense
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounts_transactions_income_xor_expense'
  ) THEN
    ALTER TABLE public.accounts_transactions
      ADD CONSTRAINT accounts_transactions_income_xor_expense CHECK (
        (income_id IS NULL OR expense_id IS NULL)
        AND NOT (income_id IS NOT NULL AND expense_id IS NOT NULL)
      );
  END IF;
END $$;
