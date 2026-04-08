const { query } = require('../config/database');
const { toYmd, todayLocalYmd } = require('../utils/dateOnly');
const { resolveAcademicYearIdFromQuery, getDefaultAcademicYearId } = require('../utils/libraryAcademicYear');

/**
 * List members with joined names/emails from students or staff.
 * Expects 002_library_module.sql applied (library_members table).
 */
const listMembers = async (req, res) => {
  try {
    const yearId = await resolveAcademicYearIdFromQuery(req);
    const search = req.query.search ? String(req.query.search).trim() : '';
    const memberType = req.query.member_type ? String(req.query.member_type).toLowerCase().trim() : '';
    const memberId = req.query.member_id ? String(req.query.member_id).trim() : '';
    const dateFrom = req.query.date_from ? String(req.query.date_from).trim().slice(0, 10) : '';
    const dateTo = req.query.date_to ? String(req.query.date_to).trim().slice(0, 10) : '';

    const params = [];
    let where = 'WHERE COALESCE(m.is_active, true) = true';
    if (yearId != null) {
      params.push(yearId);
      where += ` AND m.academic_year_id = $${params.length}`;
    }
    if (memberType === 'student' || memberType === 'staff') {
      params.push(memberType);
      where += ` AND m.member_type = $${params.length}`;
    }
    if (memberId && /^\d+$/.test(memberId)) {
      params.push(parseInt(memberId, 10));
      where += ` AND m.id = $${params.length}`;
    }
    if (search) {
      const p = `%${search}%`;
      params.push(p);
      const i = params.length;
      where += ` AND (
        m.card_number ILIKE $${i}
        OR TRIM(CONCAT(s.first_name, ' ', s.last_name)) ILIKE $${i}
        OR TRIM(CONCAT(st.first_name, ' ', st.last_name)) ILIKE $${i}
        OR COALESCE(s.email, '') ILIKE $${i}
        OR COALESCE(st.email, '') ILIKE $${i}
      )`;
    }
    if (dateFrom) {
      params.push(dateFrom);
      where += ` AND m.date_joined::date >= $${params.length}::date`;
    }
    if (dateTo) {
      params.push(dateTo);
      where += ` AND m.date_joined::date <= $${params.length}::date`;
    }

    const r = await query(
      `SELECT
         m.id,
         m.academic_year_id,
         m.member_type,
         m.student_id,
         m.staff_id,
         m.card_number,
         to_char(m.date_joined::date, 'YYYY-MM-DD') AS date_joined,
         m.is_active,
         m.created_at,
         m.modified_at,
         CASE WHEN m.member_type = 'student' THEN TRIM(CONCAT(s.first_name, ' ', s.last_name)) ELSE TRIM(CONCAT(st.first_name, ' ', st.last_name)) END AS member_name,
         CASE WHEN m.member_type = 'student' THEN s.email ELSE st.email END AS email,
         CASE WHEN m.member_type = 'student' THEN s.phone ELSE st.phone END AS phone,
         CASE WHEN m.member_type = 'student' THEN s.photo_url ELSE st.photo_url END AS photo_url
       FROM library_members m
       LEFT JOIN students s ON m.student_id = s.id
       LEFT JOIN staff st ON m.staff_id = st.id
       ${where}
       ORDER BY m.date_joined DESC NULLS LAST, m.id DESC`,
      params
    );
    const data = r.rows.map((row) => ({
      ...row,
      id: String(row.id),
      name: row.member_name || '',
      cardNo: row.card_number || '',
      dateofJoin: row.date_joined ? String(row.date_joined).slice(0, 10) : '',
      mobile: row.phone || '',
      img: row.photo_url || 'assets/img/profiles/avatar-01.jpg',
    }));
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Members fetched',
      data,
      count: data.length,
    });
  } catch (e) {
    if (e.message && e.message.includes('library_members')) {
      return res.status(503).json({
        status: 'ERROR',
        message:
          'Library members table is missing. Run server migrations (002_library_module.sql) on this database.',
      });
    }
    console.error('library members list', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to list members' });
  }
};

const getMember = async (req, res) => {
  try {
    const { id } = req.params;
    const r = await query(
      `SELECT m.id, m.academic_year_id, m.member_type, m.student_id, m.staff_id, m.card_number,
              to_char(m.date_joined::date, 'YYYY-MM-DD') AS date_joined,
              m.is_active, m.created_at, m.created_by, m.modified_at,
         CASE WHEN m.member_type = 'student' THEN TRIM(CONCAT(s.first_name, ' ', s.last_name)) ELSE TRIM(CONCAT(st.first_name, ' ', st.last_name)) END AS member_name,
         CASE WHEN m.member_type = 'student' THEN s.email ELSE st.email END AS email,
         CASE WHEN m.member_type = 'student' THEN s.phone ELSE st.phone END AS phone
       FROM library_members m
       LEFT JOIN students s ON m.student_id = s.id
       LEFT JOIN staff st ON m.staff_id = st.id
       WHERE m.id = $1`,
      [id]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Member not found' });
    }
    res.status(200).json({ status: 'SUCCESS', message: 'OK', data: r.rows[0] });
  } catch (e) {
    console.error('library member get', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to get member' });
  }
};

const createMember = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const { member_type, student_id, staff_id, card_number, date_joined, academic_year_id } = req.body;
    const mt = String(member_type || '').toLowerCase();
    if (mt !== 'student' && mt !== 'staff') {
      return res.status(400).json({ status: 'ERROR', message: 'member_type must be student or staff' });
    }
    const sid = mt === 'student' ? parseInt(student_id, 10) : null;
    const tid = mt === 'staff' ? parseInt(staff_id, 10) : null;
    if (mt === 'student' && !Number.isFinite(sid)) {
      return res.status(400).json({ status: 'ERROR', message: 'student_id is required' });
    }
    if (mt === 'staff' && !Number.isFinite(tid)) {
      return res.status(400).json({ status: 'ERROR', message: 'staff_id is required' });
    }
    const card = String(card_number || '').trim();
    if (!card) {
      return res.status(400).json({ status: 'ERROR', message: 'card_number is required' });
    }
    const dj =
      date_joined && String(date_joined).trim()
        ? String(date_joined).trim().slice(0, 10)
        : todayLocalYmd();

    let ay =
      academic_year_id != null && academic_year_id !== ''
        ? parseInt(String(academic_year_id), 10)
        : null;
    if (!Number.isFinite(ay)) {
      ay = await getDefaultAcademicYearId();
    }

    const r = await query(
      `INSERT INTO library_members (member_type, student_id, staff_id, card_number, date_joined, academic_year_id, is_active, created_by, created_at, modified_at)
       VALUES ($1, $2, $3, $4, $5::date, $6, true, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [mt, sid, tid, card, dj, ay, userId]
    );
    const created = r.rows[0];
    res.status(201).json({
      status: 'SUCCESS',
      message: 'Member created',
      data: {
        ...created,
        date_joined: created.date_joined ? toYmd(created.date_joined) : created.date_joined,
      },
    });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({
        status: 'ERROR',
        message: 'Duplicate card number or member already registered',
      });
    }
    if (e.message && e.message.includes('library_members')) {
      return res.status(503).json({
        status: 'ERROR',
        message: 'Run migration 002_library_module.sql on this database.',
      });
    }
    console.error('library member create', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to create member' });
  }
};

const updateMember = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await query(`SELECT * FROM library_members WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Member not found' });
    }
    const ex = existing.rows[0];
    const body = req.body || {};
    const card_number =
      body.card_number !== undefined ? String(body.card_number).trim() : ex.card_number;
    const date_joined =
      body.date_joined !== undefined
        ? body.date_joined == null || body.date_joined === ''
          ? ex.date_joined
          : String(body.date_joined).trim().slice(0, 10)
        : ex.date_joined;
    const is_active = typeof body.is_active === 'boolean' ? body.is_active : ex.is_active;

    let academic_year_id = ex.academic_year_id;
    if (body.academic_year_id !== undefined) {
      academic_year_id =
        body.academic_year_id == null || body.academic_year_id === ''
          ? null
          : parseInt(String(body.academic_year_id), 10);
      if (!Number.isFinite(academic_year_id)) academic_year_id = ex.academic_year_id;
    }

    const r = await query(
      `UPDATE library_members SET
         card_number = $2,
         date_joined = $3::date,
         is_active = $4,
         academic_year_id = $5,
         modified_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, card_number, date_joined, is_active, academic_year_id]
    );
    const updated = r.rows[0];
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Member updated',
      data: {
        ...updated,
        date_joined: updated.date_joined ? toYmd(updated.date_joined) : updated.date_joined,
      },
    });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ status: 'ERROR', message: 'Duplicate card number' });
    }
    console.error('library member update', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to update member' });
  }
};

const deleteMember = async (req, res) => {
  try {
    const { id } = req.params;
    const r = await query(`DELETE FROM library_members WHERE id = $1 RETURNING id`, [id]);
    if (r.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Member not found' });
    }
    res.status(200).json({ status: 'SUCCESS', message: 'Member deleted', data: { id: Number(id) } });
  } catch (e) {
    console.error('library member delete', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to delete member' });
  }
};

module.exports = {
  listMembers,
  getMember,
  createMember,
  updateMember,
  deleteMember,
};
