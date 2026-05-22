const { query, executeTransaction } = require('../config/database');
const { createGuardianUser } = require('../utils/createPersonUser');
const { guardiansIsSlimSchema } = require('../utils/studentContactSync');
const { deleteFileIfExist } = require('../utils/fileDeleteHelper');
const { lateralCurrentEnrollment } = require('../utils/studentEnrollmentSql');
const { getAuthContext, isAdmin, parseId, canAccessStudent } = require('../utils/accessControl');
const { ROLES } = require('../config/roles');

const guardianSelectBase = `
        g.id,
        sgl.student_id,
        g.user_id,
        sgl.relation AS guardian_type,
        u.first_name,
        u.last_name,
        sgl.relation,
        u.occupation,
        u.phone,
        u.email,
        u.avatar,
        student_u.first_name as student_first_name,
        student_u.last_name as student_last_name,
        student_u.avatar as student_image_url,
        s.admission_number,
        s.roll_number,
        c.class_name,
        sec.section_name`;

const guardianJoins = `
      FROM student_guardian_links sgl
      JOIN guardians g ON g.id = sgl.guardian_id
      INNER JOIN users u ON u.id = g.user_id
      LEFT JOIN students s ON sgl.student_id = s.id
      LEFT JOIN users student_u ON s.user_id = student_u.id
      ${lateralCurrentEnrollment('s.id')}
      LEFT JOIN classes c ON enr.class_id = c.id
      LEFT JOIN sections sec ON enr.section_id = sec.id`;

const createGuardian = async (req, res) => {
  try {
    const {
      student_id, guardian_type, first_name, last_name, relation, occupation,
      phone, email, is_primary_contact, is_emergency_contact, avatar,
    } = req.body;

    if (!first_name || !last_name || !phone) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'First name, last name, and phone are required',
      });
    }

    if (!student_id) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Student ID is required',
      });
    }

    const guardianRow = await executeTransaction(async (client) => {
      const slim = await guardiansIsSlimSchema(client);
      if (!slim) {
        const err = new Error('Database not migrated: run npm run db:migrate:unify');
        err.statusCode = 503;
        throw err;
      }

      const studentCheck = await client.query(
        "SELECT id FROM students WHERE id = $1 AND status = 'Active' LIMIT 1",
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
          `SELECT sgl.id FROM student_guardian_links sgl
           JOIN guardians g ON g.id = sgl.guardian_id
           INNER JOIN users u ON u.id = g.user_id
           WHERE sgl.student_id = $1
             AND (
               ($2 <> '' AND COALESCE(LOWER(TRIM(u.email)), '') = LOWER(TRIM($2)))
               OR
               ($3 <> '' AND COALESCE(TRIM(u.phone), '') = TRIM($3))
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

      const guardianUserId = await createGuardianUser(client, {
        first_name,
        last_name,
        phone,
        email: email || null,
      });
      if (!guardianUserId) {
        const err = new Error('Could not create guardian user (email or phone required)');
        err.statusCode = 400;
        throw err;
      }

      if (occupation || avatar !== undefined) {
        await client.query(
          `UPDATE users SET 
            occupation = COALESCE($1, occupation),
            avatar = COALESCE($2, avatar),
            updated_at = NOW() 
           WHERE id = $3`,
          [occupation || null, avatar || null, guardianUserId]
        );
      }

      const result = await client.query(
        `INSERT INTO guardians (
          user_id, relation,
          is_active, created_at, updated_at
        ) VALUES ($1, $2, true, NOW(), NOW())
        RETURNING *`,
        [
          guardianUserId,
          relation || null,
        ]
      );
      const row = result.rows[0];

      await client.query(
        `INSERT INTO student_guardian_links (
          student_id, guardian_id, relation, is_primary_contact, is_emergency_contact, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [
          student_id,
          row.id,
          relation || null,
          is_primary_contact === true || is_primary_contact === 'true',
          is_emergency_contact === true || is_emergency_contact === 'true',
        ]
      );

      await client.query('UPDATE students SET guardian_id = $1, updated_at = NOW() WHERE id = $2', [
        row.id,
        student_id,
      ]);
      await client.query(
        'UPDATE student_guardian_links SET is_primary_contact = (guardian_id = $1), updated_at = NOW() WHERE student_id = $2',
        [row.id, student_id]
      );

      const full = await client.query(
        `SELECT ${guardianSelectBase} ${guardianJoins} WHERE g.id = $1`,
        [row.id]
      );
      return full.rows[0] || row;
    });

    res.status(201).json({
      status: 'SUCCESS',
      message: 'Guardian created successfully',
      data: guardianRow,
    });
  } catch (error) {
    console.error('Error creating guardian:', error);
    if (error.statusCode === 400) {
      return res.status(400).json({ status: 'ERROR', message: error.message });
    }
    if (error.statusCode === 503) {
      return res.status(503).json({ status: 'ERROR', message: error.message });
    }
    if (error.statusCode === 409 || error.code === 'EMAIL_IN_USE_BY_DIFFERENT_ROLE') {
      return res.status(409).json({ status: 'ERROR', message: error.message || 'Guardian could not be linked due to account conflict' });
    }
    res.status(500).json({
      status: 'ERROR',
      message: error.message || 'Failed to create guardian',
    });
  }
};

const updateGuardian = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      student_id, guardian_type, first_name, last_name, relation, occupation,
      phone, email, is_primary_contact, is_emergency_contact, avatar,
    } = req.body;

    if (!first_name || !last_name || !phone) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'First name, last name, and phone are required',
      });
    }

    const result = await executeTransaction(async (client) => {
      const slim = await guardiansIsSlimSchema(client);
      if (!slim) {
        const err = new Error('Database not migrated: run npm run db:migrate:unify');
        err.statusCode = 503;
        throw err;
      }

      const existingRes = await client.query(
        'SELECT g.id, sgl.student_id, g.user_id, u.avatar FROM student_guardian_links sgl JOIN guardians g ON g.id = sgl.guardian_id INNER JOIN users u ON u.id = g.user_id WHERE g.id = $1 LIMIT 1',
        [id]
      );
      if (existingRes.rows.length === 0) {
        const err = new Error('Guardian not found');
        err.statusCode = 404;
        throw err;
      }
      const existing = existingRes.rows[0];
      const oldAvatar = existing.avatar;
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
          `SELECT sgl.id FROM student_guardian_links sgl
           JOIN guardians g ON g.id = sgl.guardian_id
           INNER JOIN users u ON u.id = g.user_id
           WHERE sgl.student_id = $1 AND g.id <> $2
             AND (
               ($3 <> '' AND COALESCE(LOWER(TRIM(u.email)), '') = LOWER(TRIM($3)))
               OR
               ($4 <> '' AND COALESCE(TRIM(u.phone), '') = TRIM($4))
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

      await client.query(
        `UPDATE users SET
          first_name = $1,
          last_name = $2,
          phone = $3,
          email = $4,
          occupation = $5,
          avatar = CASE WHEN $6 = true THEN $7 ELSE avatar END,
          updated_at = NOW()
        WHERE id = $8`,
        [
          first_name,
          last_name || '',
          phone,
          email || null,
          occupation || null,
          avatar !== undefined,
          avatar || '',
          existing.user_id
        ]
      );

      const updated = await client.query(
        `UPDATE student_guardian_links SET
          student_id = COALESCE($1, student_id),
          relation = COALESCE($2, relation),
          is_primary_contact = $3,
          is_emergency_contact = $4,
          updated_at = NOW()
        WHERE guardian_id = $5
        RETURNING *`,
        [
          student_id || null,
          relation || null,
          is_primary_contact === true || is_primary_contact === 'true',
          is_emergency_contact === true || is_emergency_contact === 'true',
          id,
        ]
      );

      const row = updated.rows[0];
      if (row.is_primary_contact) {
        await client.query(
          'UPDATE student_guardian_links SET is_primary_contact = false, updated_at = NOW() WHERE student_id = $1 AND guardian_id <> $2',
          [row.student_id, row.guardian_id]
        );
      }

      const full = await client.query(
        `SELECT ${guardianSelectBase} ${guardianJoins} WHERE g.id = $1`,
        [row.id]
      );

      if (avatar !== undefined && oldAvatar && oldAvatar !== avatar) {
        await deleteFileIfExist(oldAvatar);
      }

      return full.rows[0] || row;
    });

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Guardian updated successfully',
      data: result,
    });
  } catch (error) {
    console.error('Error updating guardian:', error);
    if (error.statusCode === 404) {
      return res.status(404).json({ status: 'ERROR', message: error.message });
    }
    if (error.statusCode === 400) {
      return res.status(400).json({ status: 'ERROR', message: error.message });
    }
    if (error.statusCode === 503) {
      return res.status(503).json({ status: 'ERROR', message: error.message });
    }
    if (error.statusCode === 409 || error.code === 'EMAIL_IN_USE_BY_DIFFERENT_ROLE') {
      return res.status(409).json({ status: 'ERROR', message: error.message || 'Guardian could not be linked due to account conflict' });
    }
    res.status(500).json({
      status: 'ERROR',
      message: error.message || 'Failed to update guardian',
    });
  }
};

const getAllGuardians = async (req, res) => {
  try {
    const academicYearId = req.query.academic_year_id ? parseInt(req.query.academic_year_id, 10) : null;
    const hasYearFilter = academicYearId != null && !Number.isNaN(academicYearId);
    
    const ctx = getAuthContext(req);
    const isTeacher = ctx.roleId === ROLES.TEACHER || ctx.roleName === 'teacher';
    const isAdm = isAdmin(ctx);

    if (!isTeacher && !isAdm) {
      return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
    }

    let scopingSql = '';
    let queryParams = [];

    if (isTeacher) {
      const teacherCheck = await query(
        `SELECT st.id AS staff_id FROM staff st WHERE st.user_id = $1 AND st.status = 'Active'`,
        [ctx.userId]
      );
      const teacherStaffIds = [...new Set(teacherCheck.rows.map((row) => parseId(row.staff_id)).filter(Boolean))];
      if (!teacherStaffIds.length) {
        return res.status(403).json({ status: 'ERROR', message: 'Access denied. User is not an active teacher.' });
      }
      queryParams = [teacherStaffIds];
      scopingSql = `
        AND EXISTS (
          SELECT 1 FROM class_teachers ct
          LEFT JOIN class_sections csec2 ON csec2.id = ct.class_section_id
          WHERE ct.staff_id = ANY($1::int[])
            AND ct.class_id = enr.class_id
            AND (ct.class_section_id IS NULL OR csec2.section_id = enr.section_id)
            AND ct.deleted_at IS NULL
        )`;
    }

    const yearIdx = queryParams.length + 1;
    const yearWhere = hasYearFilter ? ` AND enr.academic_year_id = $${yearIdx}` : '';
    const listParams = hasYearFilter ? [...queryParams, academicYearId] : queryParams;

    const result = await query(
      `SELECT ${guardianSelectBase}
      ${guardianJoins}
      WHERE s.status = 'Active' ${scopingSql}${yearWhere}
        AND LOWER(COALESCE(sgl.relation::text, '')) NOT IN ('father', 'mother')
      ORDER BY student_u.first_name ASC, student_u.last_name ASC`,
      listParams
    );

    const rows = result.rows;
    const grouped = [];
    const guardianMap = new Map();

    for (const row of rows) {
      const key = row.id; // Guardian ID is unique per guardian record
      if (guardianMap.has(key)) {
        const existing = guardianMap.get(key);
        // Add student if not already in list
        const alreadyIn = existing.all_children.some(c => String(c.id) === String(row.student_id));
        if (!alreadyIn) {
          existing.all_children.push({
            id: row.student_id,
            name: `${row.student_first_name} ${row.student_last_name}`.trim(),
            admission_number: row.admission_number,
            class_name: row.class_name,
            section_name: row.section_name,
            photo_url: row.student_image_url
          });
        }
      } else {
        const entry = {
          ...row,
          all_children: [
            {
              id: row.student_id,
              name: `${row.student_first_name} ${row.student_last_name}`.trim(),
              admission_number: row.admission_number,
              class_name: row.class_name,
              section_name: row.section_name,
              photo_url: row.student_image_url
            }
          ]
        };
        guardianMap.set(key, entry);
        grouped.push(entry);
      }
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Guardians fetched successfully',
      data: grouped,
      count: grouped.length,
    });
  } catch (error) {
    console.error('Error fetching guardians:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch guardians',
      error: error.message,
    });
  }
};

const getGuardianById = async (req, res) => {
  try {
    const gid = parseId(req.params.id);
    if (!gid) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid guardian ID' });
    }

    const result = await query(
      `SELECT ${guardianSelectBase}
      ${guardianJoins}
      WHERE g.id = $1 AND s.status = 'Active'`,
      [gid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Guardian not found',
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
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching guardian:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch guardian',
    });
  }
};

const getCurrentGuardian = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        status: 'ERROR',
        message: 'Not authenticated',
      });
    }

    const userResult = await query('SELECT id FROM users WHERE id = $1 AND is_active = true', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'User not found',
      });
    }

    const result = await query(
      `SELECT ${guardianSelectBase}
      ${guardianJoins}
      WHERE g.user_id = $1 AND (s.status IS NULL OR s.status = 'Active')
      ORDER BY sgl.is_primary_contact DESC, student_u.first_name ASC NULLS LAST, student_u.last_name ASC NULLS LAST`,
      [userId]
    );

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Guardian fetched successfully',
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching current guardian:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch guardian',
    });
  }
};

const getGuardianByStudentId = async (req, res) => {
  try {
    const studentId = parseId(req.params.studentId);
    if (!studentId) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid student ID' });
    }

    const access = await canAccessStudent(req, studentId);
    if (!access.ok) {
      return res.status(access.status || 403).json({ status: 'ERROR', message: access.message || 'Access denied' });
    }

    const result = await query(
      `SELECT ${guardianSelectBase}
      ${guardianJoins}
      WHERE sgl.student_id = $1 AND s.status = 'Active'
      ORDER BY sgl.is_primary_contact DESC, g.updated_at DESC, g.id DESC`,
      [studentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Guardian not found for this student',
      });
    }

    const rows = result.rows;
    let primaryGuardian = rows[0];
    if (rows.length > 1) {
      const primary = await query(
        `SELECT guardian_id
         FROM students 
         WHERE id = $1
         LIMIT 1`,
        [studentId]
      );
      if (primary.rows.length > 0) {
        const byId = rows.find((r) => Number(r.id) === Number(primary.rows[0].guardian_id));
        if (byId) primaryGuardian = byId;
      }
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Guardian fetched successfully',
      data: primaryGuardian,
      guardians: rows,
      count: rows.length,
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
  getGuardianByStudentId,
};
