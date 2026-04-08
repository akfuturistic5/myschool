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
      const studentCheck = await client.query(
        'SELECT id FROM students WHERE id = $1 AND is_active = true LIMIT 1',
        [student_id]
      );
      if (studentCheck.rows.length === 0) {
        const err = new Error('Invalid student ID');
        err.statusCode = 400;
        throw err;
      }

      const emailNorm = (email || '').toString().trim();
      const phoneNorm = (phone || '').toString().trim();
      if (emailNorm || phoneNorm) {
        const dupCheck = await client.query(
          `SELECT id FROM guardians
           WHERE student_id = $1
             AND (
               ($2 <> '' AND COALESCE(LOWER(TRIM(email)), '') = LOWER(TRIM($2)))
               OR
               ($3 <> '' AND COALESCE(TRIM(phone), '') = TRIM($3))
             )
           LIMIT 1`,
          [student_id, emailNorm, phoneNorm]
        );
        if (dupCheck.rows.length > 0) {
          const err = new Error('Guardian already exists for this student with same email or phone');
          err.statusCode = 409;
          throw err;
        }
      }

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
      const guardianUserId = await createGuardianUser(client, {
        first_name, last_name, phone, email: email || null
      });
      if (guardianUserId) {
        await client.query('UPDATE guardians SET user_id = $1, modified_at = NOW() WHERE id = $2', [guardianUserId, row.id]);
        row.user_id = guardianUserId;
      }

      // Keep student.guardian_id in sync with latest explicit assignment from registry.
      await client.query(
        'UPDATE students SET guardian_id = $1, modified_at = NOW() WHERE id = $2',
        [row.id, student_id]
      );
      await client.query(
        'UPDATE guardians SET is_primary_contact = (id = $1), modified_at = NOW() WHERE student_id = $2',
        [row.id, student_id]
      );
      row.is_primary = true;
      row.primary_for_student_id = student_id;

      return row;
    });

    res.status(201).json({
      status: 'SUCCESS',
      message: 'Guardian created successfully',
      data: guardianRow
    });
  } catch (error) {
    console.error('Error creating guardian:', error);
    if (error.statusCode === 400) {
      return res.status(400).json({ status: 'ERROR', message: error.message });
    }
    if (error.statusCode === 409 || error.code === 'EMAIL_IN_USE_BY_DIFFERENT_ROLE') {
      return res.status(409).json({ status: 'ERROR', message: error.message || 'Guardian could not be linked due to account conflict' });
    }
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

    const result = await executeTransaction(async (client) => {
      const existingRes = await client.query(
        'SELECT id, student_id, user_id FROM guardians WHERE id = $1 LIMIT 1',
        [id]
      );
      if (existingRes.rows.length === 0) {
        const err = new Error('Guardian not found');
        err.statusCode = 404;
        throw err;
      }
      const existing = existingRes.rows[0];
      const targetStudentId = student_id || existing.student_id;
      if (!targetStudentId) {
        const err = new Error('Student ID is required');
        err.statusCode = 400;
        throw err;
      }
      const emailNorm = (email || '').toString().trim();
      const phoneNorm = (phone || '').toString().trim();
      if (emailNorm || phoneNorm) {
        const dupCheck = await client.query(
          `SELECT id FROM guardians
           WHERE student_id = $1 AND id <> $2
             AND (
               ($3 <> '' AND COALESCE(LOWER(TRIM(email)), '') = LOWER(TRIM($3)))
               OR
               ($4 <> '' AND COALESCE(TRIM(phone), '') = TRIM($4))
             )
           LIMIT 1`,
          [targetStudentId, id, emailNorm, phoneNorm]
        );
        if (dupCheck.rows.length > 0) {
          const err = new Error('Guardian already exists for this student with same email or phone');
          err.statusCode = 409;
          throw err;
        }
      }

      const updated = await client.query(`
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

      const row = updated.rows[0];
      if (!row.user_id && ((email || '').toString().trim() || (phone || '').toString().trim())) {
        const guardianUserId = await createGuardianUser(client, {
          first_name: row.first_name,
          last_name: row.last_name,
          phone: row.phone,
          email: row.email,
        });
        if (guardianUserId) {
          await client.query(
            'UPDATE guardians SET user_id = $1, modified_at = NOW() WHERE id = $2',
            [guardianUserId, row.id]
          );
          row.user_id = guardianUserId;
        }
      }

      await client.query(
        'UPDATE students SET guardian_id = $1, modified_at = NOW() WHERE id = $2',
        [row.id, row.student_id]
      );
      await client.query(
        'UPDATE guardians SET is_primary_contact = (id = $1), modified_at = NOW() WHERE student_id = $2',
        [row.id, row.student_id]
      );
      return row;
    });

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Guardian updated successfully',
      data: result
    });
  } catch (error) {
    console.error('Error updating guardian:', error);
    if (error.statusCode === 404) {
      return res.status(404).json({ status: 'ERROR', message: error.message });
    }
    if (error.statusCode === 400) {
      return res.status(400).json({ status: 'ERROR', message: error.message });
    }
    if (error.statusCode === 409 || error.code === 'EMAIL_IN_USE_BY_DIFFERENT_ROLE') {
      return res.status(409).json({ status: 'ERROR', message: error.message || 'Guardian could not be linked due to account conflict' });
    }
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

    const userResult = await query('SELECT id FROM users WHERE id = $1 AND is_active = true', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'User not found'
      });
    }
    // Find guardian by stable FK link only.
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
      WHERE g.user_id = $1
      ORDER BY g.is_primary_contact DESC, s.first_name ASC NULLS LAST, s.last_name ASC NULLS LAST
    `, [userId]);

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
      ORDER BY g.is_primary_contact DESC, g.modified_at DESC, g.id DESC
    `, [studentId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Guardian not found for this student'
      });
    }
    
    const rows = result.rows;
    let primaryGuardian = rows[0];
    if (rows.length > 1) {
      const primary = await query(
        `SELECT g.*
         FROM students s
         INNER JOIN guardians g ON g.id = s.guardian_id
         WHERE s.id = $1
         LIMIT 1`,
        [studentId]
      );
      if (primary.rows.length > 0) {
        const byId = rows.find((r) => Number(r.id) === Number(primary.rows[0].id));
        if (byId) primaryGuardian = byId;
      }
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Guardian fetched successfully',
      data: primaryGuardian,
      guardians: rows,
      count: rows.length
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
