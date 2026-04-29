-- Delete account request workflow storage for User Management page.
-- Safe in production: idempotent and scoped to the tenant DB.

CREATE TABLE IF NOT EXISTS account_delete_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requisition_date TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delete_request_date TIMESTAMP WITHOUT TIME ZONE NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  reason TEXT NULL,
  requested_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITHOUT TIME ZONE NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT account_delete_requests_status_check CHECK (
    status IN ('pending', 'confirmed', 'rejected', 'cancelled')
  )
);

CREATE INDEX IF NOT EXISTS idx_account_delete_requests_user_id
  ON account_delete_requests (user_id);

CREATE INDEX IF NOT EXISTS idx_account_delete_requests_requisition_date
  ON account_delete_requests (requisition_date DESC);

CREATE INDEX IF NOT EXISTS idx_account_delete_requests_status
  ON account_delete_requests (status);
