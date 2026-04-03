-- =====================================================
-- CLASS_SYLLABUS - ADD FOREIGN KEYS
-- Run after populating class_id, section_id, academic_year_id
-- =====================================================

-- class_id -> classes(id)
ALTER TABLE class_syllabus
  ADD CONSTRAINT fk_syllabus_class
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;

-- section_id -> sections(id)
ALTER TABLE class_syllabus
  ADD CONSTRAINT fk_syllabus_section
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE SET NULL;

-- academic_year_id -> academic_years(id)
ALTER TABLE class_syllabus
  ADD CONSTRAINT fk_syllabus_academic_year
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL;
