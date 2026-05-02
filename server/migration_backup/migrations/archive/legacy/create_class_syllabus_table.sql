-- =====================================================
-- CLASS SYLLABUS TABLE
-- For: Academic > Syllabus (Class + Section + Subject Group)
-- Run this migration to create and seed class_syllabus table.
-- =====================================================

CREATE TABLE IF NOT EXISTS class_syllabus (
    id SERIAL PRIMARY KEY,
    class_id INTEGER,
    section_id INTEGER,
    class_name VARCHAR(100),
    section_name VARCHAR(100),
    subject_group VARCHAR(500) NOT NULL,
    status VARCHAR(20) DEFAULT 'Active',
    description TEXT,
    academic_year_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_class_syllabus_class_id ON class_syllabus(class_id);
CREATE INDEX IF NOT EXISTS idx_class_syllabus_section_id ON class_syllabus(section_id);
CREATE INDEX IF NOT EXISTS idx_class_syllabus_status ON class_syllabus(status);
CREATE INDEX IF NOT EXISTS idx_class_syllabus_academic_year ON class_syllabus(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_class_syllabus_created_at ON class_syllabus(created_at DESC);

-- Optional: Add FKs if classes and sections tables exist (run separately if needed)
-- ALTER TABLE class_syllabus ADD CONSTRAINT fk_syllabus_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;
-- ALTER TABLE class_syllabus ADD CONSTRAINT fk_syllabus_section FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE SET NULL;

-- Seed initial data (matching static JSON - run only if table is empty)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM class_syllabus LIMIT 1) THEN
    INSERT INTO class_syllabus (class_name, section_name, subject_group, status) VALUES
      ('I', 'A', 'I, C English', 'Active'),
      ('I', 'B', 'III, A Maths', 'Active'),
      ('II', 'A', 'II, A English', 'Active'),
      ('II', 'B', 'IV, A Physics', 'Active'),
      ('II', 'C', 'V, A Chemistry', 'Active'),
      ('III', 'A', 'III, B Maths', 'Active'),
      ('III', 'B', 'IV, B Chemistry', 'Active'),
      ('IV', 'A', 'I, B Maths', 'Active'),
      ('IV', 'B', 'VI, B Chemistry', 'Active'),
      ('V', 'A', 'IV, D Maths', 'Active');
  END IF;
END $$;
