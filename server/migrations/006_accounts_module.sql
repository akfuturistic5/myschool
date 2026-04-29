-- Finance & Accounts: income, invoices, transactions ledger (run after 001_init_full_schema.sql).
-- Display codes (I000001, FT000001) are derived in the API from id.
-- Idempotent: safe to re-run on existing tenant DBs.

CREATE TABLE IF NOT EXISTS public.accounts_income (
  id integer NOT NULL PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  academic_year_id integer,
  income_name character varying(255) NOT NULL,
  description text,
  source character varying(255),
  income_date date NOT NULL,
  amount numeric(14,2) NOT NULL,
  invoice_no character varying(64),
  payment_method character varying(64),
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT accounts_income_academic_year_id_fkey FOREIGN KEY (academic_year_id)
    REFERENCES public.academic_years (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_accounts_income_year ON public.accounts_income (academic_year_id);
CREATE INDEX IF NOT EXISTS idx_accounts_income_date ON public.accounts_income (income_date);

CREATE TABLE IF NOT EXISTS public.accounts_invoices (
  id integer NOT NULL PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  academic_year_id integer,
  invoice_number character varying(64) NOT NULL,
  invoice_date date NOT NULL,
  description text,
  amount numeric(14,2) NOT NULL,
  payment_method character varying(64),
  due_date date NOT NULL,
  status character varying(32) NOT NULL DEFAULT 'Pending',
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT accounts_invoices_academic_year_id_fkey FOREIGN KEY (academic_year_id)
    REFERENCES public.academic_years (id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_invoices_number_year
  ON public.accounts_invoices (invoice_number, COALESCE(academic_year_id, -1));

CREATE INDEX IF NOT EXISTS idx_accounts_invoices_year ON public.accounts_invoices (academic_year_id);

CREATE TABLE IF NOT EXISTS public.accounts_transactions (
  id integer NOT NULL PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  academic_year_id integer,
  description text NOT NULL,
  transaction_date date NOT NULL,
  amount numeric(14,2) NOT NULL,
  payment_method character varying(64),
  transaction_type character varying(16) NOT NULL,
  status character varying(32) NOT NULL DEFAULT 'Completed',
  income_id integer,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT accounts_transactions_academic_year_id_fkey FOREIGN KEY (academic_year_id)
    REFERENCES public.academic_years (id) ON DELETE SET NULL,
  CONSTRAINT accounts_transactions_income_id_fkey FOREIGN KEY (income_id)
    REFERENCES public.accounts_income (id) ON DELETE CASCADE,
  CONSTRAINT accounts_transactions_type_check CHECK (
    (transaction_type)::text = ANY (ARRAY['Income'::character varying, 'Expense'::character varying]::text[])
  ),
  CONSTRAINT accounts_transactions_status_check CHECK (
    (status)::text = ANY (ARRAY['Completed'::character varying, 'Pending'::character varying]::text[])
  )
);

CREATE INDEX IF NOT EXISTS idx_accounts_transactions_year ON public.accounts_transactions (academic_year_id);
CREATE INDEX IF NOT EXISTS idx_accounts_transactions_income ON public.accounts_transactions (income_id);
