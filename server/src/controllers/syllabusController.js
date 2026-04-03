const { query } = require('../config/database');

function formatCreatedDate(row) {
  const d = row.created_at ?? row.created_date;
  if (!d) return null;
  if (typeof d === 'string' && /^[\d\s\w,]+\d{4}$/.test(d)) return d;
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return null;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function mapRow(row) {
  const cls = row.class ?? row.class_name;
  const sec = row.section ?? row.section_name;
  const statusVal = row.status ?? 'Active';
  const normalizedStatus = (statusVal === 'Active' || statusVal === 'active' || statusVal === true)
    ? 'Active'
    : (statusVal === 'Inactive' || statusVal === 'inactive' || statusVal === false ? 'Inactive' : statusVal);
  return {
    id: row.id,
    key: row.id,
    class: cls ?? 'N/A',
    section: sec ?? 'N/A',
    subjectGroup: row.subject_group ?? row.subjectGroup ?? '',
    createdDate: formatCreatedDate(row),
    status: normalizedStatus,
    originalData: row
  };
}

// Returns ALL syllabus (Active + Inactive) - no status filter
// Optional query: academic_year_id - filter by academic year
const getAllSyllabus = async (req, res) => {
  try {
    const academicYearId = req.query.academic_year_id ? parseInt(req.query.academic_year_id, 10) : null;
    const hasYearFilter = academicYearId != null && !Number.isNaN(academicYearId);
    const yearWhere = hasYearFilter ? ' WHERE s.academic_year_id = $1' : '';
    const params = hasYearFilter ? [academicYearId] : [];

    const result = await query(
      `SELECT
        s.id,
        s.class_id,
        s.section_id,
        COALESCE(c.class_name, s.class_name) AS class,
        COALESCE(sec.section_name, s.section_name) AS section,
        s.subject_group,
        s.status,
        s.description,
        s.academic_year_id,
        s.created_at,
        s.modified_at
      FROM class_syllabus s
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN sections sec ON sec.id = s.section_id${yearWhere}
      ORDER BY s.id ASC`,
      params
    );
    const data = result.rows.map(mapRow);
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Syllabus fetched successfully',
      data,
      count: data.length
    });
  } catch (err) {
    try {
      const result = await query(`
        SELECT id, class_id, section_id, class_name, section_name, subject_group, status, created_at, modified_at
        FROM class_syllabus
        ORDER BY id ASC
      `);
      const data = result.rows.map((row) => mapRow({
        ...row,
        class: row.class_name,
        section: row.section_name
      }));
      return res.status(200).json({
        status: 'SUCCESS',
        message: 'Syllabus fetched successfully',
        data,
        count: data.length
      });
    } catch (e2) {
      console.error('Error fetching syllabus:', err);
      res.status(500).json({
        status: 'ERROR',
        message: 'Failed to fetch syllabus'
      });
    }
  }
};

const getSyllabusById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT
        s.id,
        s.class_id,
        s.section_id,
        COALESCE(c.class_name, s.class_name) AS class,
        COALESCE(sec.section_name, s.section_name) AS section,
        s.subject_group,
        s.status,
        s.description,
        s.created_at,
        s.modified_at
      FROM class_syllabus s
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN sections sec ON sec.id = s.section_id
      WHERE s.id = $1
    `, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Syllabus not found' });
    }
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Syllabus fetched successfully',
      data: mapRow(result.rows[0])
    });
  } catch (err) {
    try {
      const { id } = req.params;
      const result = await query(
        'SELECT * FROM class_syllabus WHERE id = $1',
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ status: 'ERROR', message: 'Syllabus not found' });
      }
      const row = result.rows[0];
      return res.status(200).json({
        status: 'SUCCESS',
        message: 'Syllabus fetched successfully',
        data: mapRow({ ...row, class: row.class_name, section: row.section_name })
      });
    } catch (e2) {
      console.error('Error fetching syllabus:', err);
      res.status(500).json({ status: 'ERROR', message: 'Failed to fetch syllabus' });
    }
  }
};

const createSyllabus = async (req, res) => {
  try {
    const {
      class_id,
      section_id,
      class_name,
      class: classVal,
      section_name,
      section: sectionVal,
      subject_group,
      subjectGroup,
      status,
      description,
      academic_year_id
    } = req.body;

    const clsId = class_id ?? null;
    const secId = section_id ?? null;
    const clsName = class_name ?? classVal ?? '';
    const secName = section_name ?? sectionVal ?? '';
    const subjGroup = subject_group ?? subjectGroup ?? '';
    if (!subjGroup.trim()) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Subject group is required'
      });
    }
    const stat = (status && String(status).toLowerCase() === 'active') ? 'Active' : 'Inactive';

    const result = await query(`
      INSERT INTO class_syllabus (class_id, section_id, class_name, section_name, subject_group, status, description, academic_year_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [clsId, secId, clsName || null, secName || null, subjGroup.trim(), stat, description || null, academic_year_id || null]);

    const row = result.rows[0];
    res.status(201).json({
      status: 'SUCCESS',
      message: 'Syllabus created successfully',
      data: mapRow({ ...row, class: row.class_name ?? clsName, section: row.section_name ?? secName })
    });
  } catch (err) {
    console.error('Error creating syllabus:', err);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to create syllabus'
    });
  }
};

const updateSyllabus = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      class_id,
      section_id,
      class_name,
      class: classVal,
      section_name,
      section: sectionVal,
      subject_group,
      subjectGroup,
      status,
      description,
      academic_year_id
    } = req.body;

    const updates = [];
    const params = [];
    let idx = 1;

    if (class_id !== undefined) {
      updates.push(`class_id = $${idx++}`);
      params.push(class_id || null);
    }
    if (section_id !== undefined) {
      updates.push(`section_id = $${idx++}`);
      params.push(section_id || null);
    }
    const clsName = class_name ?? classVal;
    if (clsName !== undefined) {
      updates.push(`class_name = $${idx++}`);
      params.push(clsName || null);
    }
    const secName = section_name ?? sectionVal;
    if (secName !== undefined) {
      updates.push(`section_name = $${idx++}`);
      params.push(secName || null);
    }
    const subjGroup = subject_group ?? subjectGroup;
    if (subjGroup !== undefined) {
      updates.push(`subject_group = $${idx++}`);
      params.push(subjGroup || null);
    }
    if (status !== undefined) {
      const stat = (status && String(status).toLowerCase() === 'active') ? 'Active' : 'Inactive';
      updates.push(`status = $${idx++}`);
      params.push(stat);
    }
    if (description !== undefined) {
      updates.push(`description = $${idx++}`);
      params.push(description || null);
    }
    if (academic_year_id !== undefined) {
      updates.push(`academic_year_id = $${idx++}`);
      params.push(academic_year_id || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'No fields to update'
      });
    }

    updates.push('modified_at = NOW()');
    params.push(id);

    const result = await query(`
      UPDATE class_syllabus
      SET ${updates.join(', ')}
      WHERE id = $${idx}
      RETURNING *
    `, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Syllabus not found'
      });
    }

    const row = result.rows[0];
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Syllabus updated successfully',
      data: mapRow({ ...row, class: row.class_name, section: row.section_name })
    });
  } catch (err) {
    console.error('Error updating syllabus:', err);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to update syllabus'
    });
  }
};

const deleteSyllabus = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      'DELETE FROM class_syllabus WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Syllabus not found'
      });
    }
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Syllabus deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting syllabus:', err);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to delete syllabus'
    });
  }
};

module.exports = {
  getAllSyllabus,
  getSyllabusById,
  createSyllabus,
  updateSyllabus,
  deleteSyllabus
};
