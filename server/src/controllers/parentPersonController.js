const { query } = require('../config/database');
const { parseId } = require('../utils/accessControl');
const { ROLES } = require('../config/roles');

/**
 * GET /parent-persons/search?q=...&limit=20&role=father|mother|guardian|any
 * Typeahead: users with Parent or Guardian roles (contact accounts).
 */
const searchParentPersons = async (req, res) => {
  try {
    const raw = req.query.q ?? req.query.query ?? '';
    const q = String(raw).trim();
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
    const roleRaw = String(req.query.role || 'any').toLowerCase();
    const role = ['father', 'mother', 'guardian', 'any'].includes(roleRaw) ? roleRaw : 'any';

    if (!q) {
      return res.status(200).json({
        status: 'SUCCESS',
        data: [],
      });
    }

    const digits = q.replace(/\D/g, '');
    const likeLower = `%${q.toLowerCase().replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;

    let roleIds;
    if (role === 'guardian') {
      roleIds = [ROLES.GUARDIAN];
    } else if (role === 'father' || role === 'mother') {
      roleIds = [ROLES.PARENT];
    } else {
      roleIds = [ROLES.PARENT, ROLES.GUARDIAN];
    }

    let result;
    if (digits.length >= 4) {
      result = await query(
        `SELECT u.id,
                TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))) AS full_name,
                u.phone, u.email, u.current_address AS address, u.occupation,
                u.created_at, u.modified_at AS updated_at
         FROM users u
         WHERE u.is_active = true
           AND u.role_id = ANY($1::int[])
           AND (
             regexp_replace(COALESCE(u.phone, ''), '[^0-9]', '', 'g') LIKE $2
             OR LOWER(TRIM(COALESCE(u.email, ''))) LIKE $3
             OR LOWER(TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,'')))) LIKE $3
           )
         ORDER BY full_name ASC NULLS LAST
         LIMIT $4`,
        [roleIds, `%${digits}%`, likeLower, limit]
      );
    } else {
      result = await query(
        `SELECT u.id,
                TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))) AS full_name,
                u.phone, u.email, u.current_address AS address, u.occupation,
                u.created_at, u.modified_at AS updated_at
         FROM users u
         WHERE u.is_active = true
           AND u.role_id = ANY($1::int[])
           AND (
             LOWER(TRIM(COALESCE(u.email, ''))) LIKE $2
             OR LOWER(TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,'')))) LIKE $2
           )
         ORDER BY full_name ASC NULLS LAST
         LIMIT $3`,
        [roleIds, likeLower, limit]
      );
    }

    const data = result.rows.map((r) => ({
      id: r.id,
      full_name: r.full_name,
      phone: r.phone,
      email: r.email,
      address: r.address,
      occupation: r.occupation,
      created_at: r.created_at,
      updated_at: r.updated_at,
      legacy_from_student_records: false,
    }));

    res.status(200).json({
      status: 'SUCCESS',
      data,
    });
  } catch (error) {
    console.error('searchParentPersons:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to search parent persons',
    });
  }
};

/**
 * GET /parent-persons/:id — users.id for Parent or Guardian role.
 */
const getParentPersonById = async (req, res) => {
  try {
    const pid = parseId(req.params.id);
    if (!pid) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid id' });
    }
    const result = await query(
      `SELECT u.id,
              TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))) AS full_name,
              u.phone, u.email, u.current_address AS address, u.occupation,
              u.created_at, u.modified_at AS updated_at
       FROM users u
       WHERE u.id = $1 AND u.is_active = true
         AND u.role_id IN ($2, $3)
       LIMIT 1`,
      [pid, ROLES.PARENT, ROLES.GUARDIAN]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Not found' });
    }
    res.status(200).json({
      status: 'SUCCESS',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('getParentPersonById:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to load parent person',
    });
  }
};

module.exports = {
  searchParentPersons,
  getParentPersonById,
};
