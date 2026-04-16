-- Enquiries module: stores walk-in/call enquiries per academic year and creator.

CREATE TABLE IF NOT EXISTS enquiries (
  id BIGSERIAL PRIMARY KEY,
  enquiry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  name VARCHAR(160) NOT NULL,
  mobile_number VARCHAR(20) NOT NULL,
  address TEXT NULL,
  enquiry_about VARCHAR(200) NOT NULL,
  description TEXT NULL,
  email VARCHAR(254) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  follow_up_date DATE NULL,
  academic_year_id INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT enquiries_status_check CHECK (status IN ('open', 'in_progress', 'closed'))
);

CREATE INDEX IF NOT EXISTS idx_enquiries_date ON enquiries (enquiry_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_enquiries_academic_year ON enquiries (academic_year_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_created_by ON enquiries (created_by);
CREATE INDEX IF NOT EXISTS idx_enquiries_mobile ON enquiries (mobile_number);
