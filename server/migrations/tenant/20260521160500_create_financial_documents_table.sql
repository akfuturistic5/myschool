-- Migration to create financial_documents table for income and expense attachments
CREATE TABLE IF NOT EXISTS public.financial_documents (
    id SERIAL PRIMARY KEY,
    ledger_id INTEGER NOT NULL REFERENCES public.financial_ledger(id) ON DELETE CASCADE,
    document_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT,
    file_type VARCHAR(100),
    uploaded_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_financial_documents_ledger ON public.financial_documents(ledger_id);
CREATE INDEX IF NOT EXISTS idx_financial_documents_deleted ON public.financial_documents(deleted_at) WHERE deleted_at IS NULL;
