const { query, executeTransaction } = require('../config/database');
const { createGuardianUser } = require('../utils/createPersonUser');

// Create new guardian
const createGuardian = async (req, res) => {
  try {
    const {
      student_id, guardian_type, first_name, last_name, relation, occupation,
      phone, email, address, office_address, is_primary_contact, is_emergency_contact
    } = req.body;

    if (!first_name || !last_name || !phone) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'First name, last name, and phone are required'
      });
    }

    if (!student_id) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Student ID is required'
      });
    }

    const guardianRow = await executeTransaction(async (client) => {
      const result = await client.query(`
        INSERT INTO guardians (
          student_id, guardian_type, first_name, last_name, relation, occupation,
          phone, email, address, office_address, is_primary_contact, is_emergency_contact,
          is_active, created_at, modified_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, NOW(), NOW())
        RETURNING *
      `, [
        student_id,
        guardian_type || null,
        first_name,
        last_name,
        relation || null,
        occupation || null,
        phone,
        email || null,
        address || null,
        office_address || null,
        is_primary_contact === true || is_primary_contact === 'true',
        is_emergency_contact === true || is_emergency_contact === 'true'
      ]);
      const row = result.rows[0];
      try {
        const guardianUserId = await createGuardianUser(client, {
          first_name, last_name, phone, email: email || null
        });
        if (guardianUserId) {
          await client.query('UPDATE guardians SET user_id = $1, modified_at = NOW() WHERE id = $2', [guardianUserId, row.id]);
          row.user_id = guardianUserId;
        }
      } catch (e) {
        console.warn('createGuardian: could not create guardian user:', e.message);
      }
      return row;
    });

    res.status(201).json({
      status: 'SUCCESS',
      message: 'Guardian created successfully',
      data: guardianRow
    });
  } catch (error) {
    console.error('Error creating guardian:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to create guardian',
    });
  }
};

// Update guardian
const updateGuardian = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      student_id, guardian_type, first_name, last_name, relation, occupation,
      phone, email, address, office_address, is_primary_contact, is_emergency_contact
    } = req.body;

    if (!first_name || !last_name || !phone) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'First name, last name, and phone are required'
      });
    }

    const result = await query(`
      UPDATE guardians SET
        student_id = COALESCE($1, student_id),
        guardian_type = $2,
        first_name = $3,
        last_name = $4,
        relation = $5,
        occupation = $6,
        phone = $7,
        email = $8,
        address = $9,
        office_address = $10,
        is_primary_contact = $11,
        is_emergency_contact = $12,
        modified_at = NOW()
      WHERE id = $13
      RETURNING *
    `, [
      student_id || null,
      guardian_type || null,
      first_name,
      last_name,
      relation || null,
      occupation || null,
      phone,
      email || null,
      address || null,
      office_address || null,
      is_primary_contact === true || is_primary_contact === 'true',
      is_emergency_contact === true || is_emergency_contact === 'true',
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Guardian not found'
      });
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Guardian updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating guardian:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to update guardian',
    });
  }
};

// Get all guardians (optional query: academic_year_id - only guardians whose student is in that year)
const getAllGuardians = async (req, res) => {
  try {
    const academicYearId = req.query.academic_year_id ? parseInt(req.query.academic_year_id, 10) : null;
    const hasYearFilter = academicYearId != null && !Number.isNaN(academicYearId);
    const yearWhere = hasYearFilter ? ' AND s.academic_year_id = $1' : '';
    const params = hasYearFilter ? [academicYearId] : [];

    const result = await query(
      `SELECT
        g.id,
        g.student_id,
        g.guardian_type,
        g.first_name,
        g.last_name,
        g.relation,
        g.occupation,
        g.phone,
        g.email,
        s.first_name as student_first_name,
        s.last_name as student_last_name,
        s.admission_number,
        s.roll_number,
        c.class_name,
        sec.section_name
      FROM guardians g
      LEFT JOIN students s ON g.student_id = s.id
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      WHERE s.is_active = true${yearWhere}
      ORDER BY s.first_name ASC, s.last_name ASC`,
      params
    );
    
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Guardians fetched successfully',
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching guardians:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch guardians',
    });
  }
};

// Get guardian by ID
const getGuardianById = async (req, res) => {
  try {
    const { canAccessStudent, parseId, isAdmin, getAuthContext } = require('../utils/accessControl');
    const gid = parseId(req.params.id);
    if (!gid) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid guardian ID' });
    }
    
    const result = await query(`
      SELECT
        g.id,
        g.student_id,
        g.guardian_type,
        g.first_name,
        g.last_name,
        g.relation,
        g.occupation,
        g.phone,
        g.email,
        s.first_name as student_first_name,
        s.last_name as student_last_name,
        s.admission_number,
        s.roll_number,
        c.class_name,
        sec.section_name
      FROM guardians g
      LEFT JOIN students s ON g.student_id = s.id
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      WHERE g.id = $1 AND s.is_active = true
    `, [gid]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Guardian not found'
      });
    }

    const ctx = getAuthContext(req);
    if (!isAdmin(ctx)) {
      const sid = result.rows[0]?.student_id;
      const access = await canAccessStudent(req, sid);
      if (!access.ok) {
        return res.status(access.status || 403).json({ status: 'ERROR', message: access.message || 'Access denied' });
      }
    }
    
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Guardian fetched successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching guardian:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch guardian',
    });
  }
};

// Get current logged-in guardian (by user email/phone from JWT)
// Matches guardians table by email or phone of the logged-in user
const getCurrentGuardian = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        status: 'ERROR',
        message: 'Not authenticated'
      });
    }

    // Get user email/phone to match guardian
    const userResult = await query(
      'SELECT email, phone FROM users WHERE id = $1 AND is_active = true',
      [userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'User not found'
      });
    }
    const user = userResult.rows[0];
    const userEmail = (user.email || '').toString().trim();
    const userPhone = (user.phone || '').toString().trim();

    if (!userEmail && !userPhone) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Guardian not found for this user'
      });
    }

    // Find guardian by email or phone
    const result = await query(`
      SELECT
        g.id,
        g.student_id,
        g.guardian_type,
        g.first_name,
        g.last_name,
        g.relation,
        g.occupation,
        g.phone,
        g.email,
        s.first_name as student_first_name,
        s.last_name as student_last_name,
        s.admission_number,
        s.roll_number,
        c.class_name,
        sec.section_name
      FROM guardians g
      LEFT JOIN students s ON g.student_id = s.id AND s.is_active = true
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      WHERE (LOWER(TRIM(g.email)) = LOWER($1) AND $1 != '')
         OR (TRIM(g.phone) = $2 AND $2 != '')
      ORDER BY s.first_name ASC NULLS LAST, s.last_name ASC NULLS LAST
    `, [userEmail, userPhone]);

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Guardian fetched successfully',
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching current guardian:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch guardian',
    });
  }
};

// Get guardian by student ID
const getGuardianByStudentId = async (req, res) => {
  try {
    const { canAccessStudent, parseId } = require('../utils/accessControl');
    const studentId = parseId(req.params.studentId);
    if (!studentId) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid student ID' });
    }

    const access = await canAccessStudent(req, studentId);
    if (!access.ok) {
      return res.status(access.status || 403).json({ status: 'ERROR', message: access.message || 'Access denied' });
    }
    
    const result = await query(`
      SELECT
        g.id,
        g.student_id,
        g.guardian_type,
        g.first_name,
        g.last_name,
        g.relation,
        g.occupation,
        g.phone,
        g.email,
        s.first_name as student_first_name,
        s.last_name as student_last_name,
        s.admission_number,
        s.roll_number,
        c.class_name,
        sec.section_name
      FROM guardians g
      LEFT JOIN students s ON g.student_id = s.id
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      WHERE g.student_id = $1 AND s.is_active = true
    `, [studentId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Guardian not found for this student'
      });
    }
    
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Guardian fetched successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching guardian by student ID:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch guardian',
    });
  }
};

module.exports = {
  createGuardian,
  updateGuardian,
  getAllGuardians,
  getCurrentGuardian,
  getGuardianById,
  getGuardianByStudentId
};
