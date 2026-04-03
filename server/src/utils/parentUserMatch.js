/**
 * Parent-user matching utility.
 * Links users (Parent role) to parents table when parents has no user_id.
 * Uses: 1) direct parents.user_id mapping
 *       2) username+@email.com (unique, disambiguates when multiple parents share same phone)
 *       3) email match (father_email/mother_email)
 *       4) phone match (father_phone/mother_phone)
 */
const { query } = require('../config/database');

/**
 * Get parent rows for the logged-in user (Parent role).
 * @param {number} userId - JWT user id
 * @returns {Promise<{ parents: Array, studentIds: number[] }>}
 */
async function getParentsForUser(userId) {
  const userResult = await query(
    'SELECT username, email, phone FROM users WHERE id = $1 AND is_active = true',
    [userId]
  );
  if (userResult.rows.length === 0) {
    return { parents: [], studentIds: [] };
  }
  const user = userResult.rows[0];
  const username = (user.username || '').toString().trim();
  const userEmail = (user.email || '').toString().trim();
  const userPhone = (user.phone || '').toString().trim();
  const usernameDerivedEmail = username ? `${username}@email.com` : '';

  const baseSelect = `
    SELECT
      p.id, p.user_id, p.student_id, p.father_name, p.father_email, p.father_phone,
      p.father_occupation, p.father_image_url, p.mother_name, p.mother_email,
      p.mother_phone, p.mother_occupation, p.mother_image_url, p.created_at, p.updated_at,
      s.first_name as student_first_name, s.last_name as student_last_name,
      s.admission_number, s.roll_number, c.class_name, sec.section_name
    FROM parents p
    LEFT JOIN students s ON p.student_id = s.id
    LEFT JOIN classes c ON s.class_id = c.id
    LEFT JOIN sections sec ON s.section_id = sec.id
    WHERE s.is_active = true
  `;

  // 1. Prefer exact user link created during parent onboarding.
  const directUserMatch = await query(
    `${baseSelect} AND p.user_id = $1
     ORDER BY s.first_name ASC, s.last_name ASC`,
    [userId]
  );
  if (directUserMatch.rows.length > 0) {
    const studentIds = directUserMatch.rows.map((row) => row.student_id).filter(Boolean);
    return { parents: directUserMatch.rows, studentIds };
  }

  // 2. Prefer username+@email.com (unique, disambiguates shared-phone parents)
  if (usernameDerivedEmail) {
    const r = await query(
      `${baseSelect} AND (
        (LOWER(TRIM(p.father_email)) = LOWER($1))
        OR (LOWER(TRIM(p.mother_email)) = LOWER($1))
      )
      ORDER BY s.first_name ASC, s.last_name ASC`,
      [usernameDerivedEmail]
    );
    if (r.rows.length > 0) {
      const studentIds = r.rows.map((row) => row.student_id).filter(Boolean);
      return { parents: r.rows, studentIds };
    }
  }

  // 3. Fallback: email match
  if (userEmail) {
    const r = await query(
      `${baseSelect} AND (
        (LOWER(TRIM(p.father_email)) = LOWER($1) AND $1 != '')
        OR (LOWER(TRIM(p.mother_email)) = LOWER($1) AND $1 != '')
      )
      ORDER BY s.first_name ASC, s.last_name ASC`,
      [userEmail]
    );
    if (r.rows.length > 0) {
      const studentIds = r.rows.map((row) => row.student_id).filter(Boolean);
      return { parents: r.rows, studentIds };
    }
  }

  // 4. Fallback: phone match (may return multiple if shared phone - data issue)
  if (userPhone) {
    const r = await query(
      `${baseSelect} AND (
        (TRIM(p.father_phone) = $1 AND $1 != '')
        OR (TRIM(p.mother_phone) = $1 AND $1 != '')
      )
      ORDER BY s.first_name ASC, s.last_name ASC`,
      [userPhone]
    );
    const studentIds = r.rows.map((row) => row.student_id).filter(Boolean);
    return { parents: r.rows, studentIds };
  }

  return { parents: [], studentIds: [] };
}

module.exports = { getParentsForUser };
