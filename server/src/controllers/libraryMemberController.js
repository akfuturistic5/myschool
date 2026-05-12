const { query } = require('../config/database');
const { resolveAcademicYearIdFromQuery, getDefaultAcademicYearId } = require('../utils/libraryAcademicYear');

const listMembers = async (req, res) => {
  try {
    let yearId = await resolveAcademicYearIdFromQuery(req);
    if (yearId == null) {
      yearId = await getDefaultAcademicYearId();
    }
    const search = req.query.search ? String(req.query.search).trim() : '';
    const memberType = req.query.member_type ? String(req.query.member_type).toLowerCase().trim() : '';
    const memberId = req.query.member_id ? String(req.query.member_id).trim() : '';
    const status = req.query.status ? String(req.query.status).toLowerCase().trim() : '';

    const params = [];
    let where = 'WHERE 1=1';
    if (yearId != null) {
      params.push(yearId);
      where += ` AND m.academic_year_id = $${params.length}`;
    }
    if (memberType === 'student' || memberType === 'staff') {
      where += memberType === 'student' ? ` AND m.student_id IS NOT NULL` : ` AND m.staff_id IS NOT NULL`;
    }
    if (memberId && /^\d+$/.test(memberId)) {
      params.push(parseInt(memberId, 10));
      where += ` AND m.id = $${params.length}`;
    }
    if (status) {
      const normalizedStatus = status === 'active' ? 'active' : 'inactive';
      params.push(normalizedStatus);
      where += ` AND LOWER(TRIM(COALESCE(m.status, 'active'))) = $${params.length}`;
    }
    if (search) {
      const p = `%${search}%`;
      params.push(p);
      const i = params.length;
      where += ` AND (
        m.card_number ILIKE $${i}
        OR TRIM(CONCAT(su.first_name, ' ', su.last_name)) ILIKE $${i}
        OR TRIM(CONCAT(stu.first_name, ' ', stu.last_name)) ILIKE $${i}
        OR COALESCE(su.email, '') ILIKE $${i}
        OR COALESCE(stu.email, '') ILIKE $${i}
      )`;
    }

    const r = await query(
      `SELECT
         m.id,
         m.academic_year_id,
         m.student_id,
         m.staff_id,
         m.card_number,
         COALESCE(LOWER(TRIM(m.status)), 'active') AS status,
         m.remarks,
         m.created_at,
         m.updated_at,
         CASE WHEN m.student_id IS NOT NULL THEN 'student' ELSE 'staff' END AS member_type,
         CASE WHEN m.student_id IS NOT NULL THEN TRIM(CONCAT(su.first_name, ' ', su.last_name)) ELSE TRIM(CONCAT(stu.first_name, ' ', stu.last_name)) END AS member_name,
         CASE WHEN m.student_id IS NOT NULL THEN COALESCE(NULLIF(TRIM(su.email), ''), NULLIF(TRIM(stu.email), ''), '') ELSE COALESCE(NULLIF(TRIM(stu.email), ''), NULLIF(TRIM(su.email), ''), '') END AS email,
         CASE WHEN m.student_id IS NOT NULL THEN COALESCE(NULLIF(TRIM(su.phone), ''), NULLIF(TRIM(stu.phone), ''), NULLIF(TRIM(st.emergency_contact_phone), ''), '') ELSE COALESCE(NULLIF(TRIM(stu.phone), ''), NULLIF(TRIM(st.emergency_contact_phone), ''), NULLIF(TRIM(su.phone), ''), '') END AS phone,
         CASE
           WHEN m.student_id IS NOT NULL THEN NULLIF(su.avatar, '')
           ELSE st.photo_url
         END AS photo_url
       FROM library_members m
       LEFT JOIN students s ON m.student_id = s.id
       LEFT JOIN users su ON s.user_id = su.id
       LEFT JOIN staff st ON m.staff_id = st.id
       LEFT JOIN users stu ON st.user_id = stu.id
       ${where}
       ORDER BY m.id DESC`,
      params
    );
    const data = r.rows.map((row) => ({
      ...row,
      id: String(row.id),
      name: row.member_name || '',
      cardNo: row.card_number || '',
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
    console.error('library members list', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to list members' });
  }
};

const getMember = async (req, res) => {
  try {
    const { id } = req.params;
    const r = await query(
      `SELECT
         m.id,
         m.academic_year_id,
         m.student_id,
         m.staff_id,
         m.card_number,
         COALESCE(LOWER(TRIM(m.status)), 'active') AS status,
         m.remarks,
         m.created_at,
         m.updated_at,
         CASE WHEN m.student_id IS NOT NULL THEN 'student' ELSE 'staff' END AS member_type,
         CASE WHEN m.student_id IS NOT NULL THEN TRIM(CONCAT(su.first_name, ' ', su.last_name)) ELSE TRIM(CONCAT(stu.first_name, ' ', stu.last_name)) END AS member_name,
         CASE WHEN m.student_id IS NOT NULL THEN su.email ELSE stu.email END AS email,
         CASE WHEN m.student_id IS NOT NULL THEN su.phone ELSE stu.phone END AS phone
       FROM library_members m
       LEFT JOIN students s ON m.student_id = s.id
       LEFT JOIN users su ON s.user_id = su.id
       LEFT JOIN staff st ON m.staff_id = st.id
       LEFT JOIN users stu ON st.user_id = stu.id
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
    const body = req.body || {};
    const card = String(body.card_number || '').trim();
    if (!card) {
      return res.status(400).json({ status: 'ERROR', message: 'card_number is required' });
    }

    const sid = body.student_id != null && body.student_id !== '' ? parseInt(String(body.student_id), 10) : null;
    const tid = body.staff_id != null && body.staff_id !== '' ? parseInt(String(body.staff_id), 10) : null;
    if (!Number.isFinite(sid) && !Number.isFinite(tid)) {
      return res.status(400).json({ status: 'ERROR', message: 'student_id or staff_id is required' });
    }
    if (Number.isFinite(sid) && Number.isFinite(tid)) {
      return res.status(400).json({ status: 'ERROR', message: 'Provide either student_id or staff_id (not both)' });
    }

    let ay =
      body.academic_year_id != null && body.academic_year_id !== ''
        ? parseInt(String(body.academic_year_id), 10)
        : null;
    if (!Number.isFinite(ay)) {
      ay = await getDefaultAcademicYearId();
    }

    const status = body.status && String(body.status).toLowerCase().trim() === 'active' ? 'active' : 'inactive';
    const remarks = body.remarks != null && String(body.remarks).trim() ? String(body.remarks).trim() : null;

    const r = await query(
      `INSERT INTO library_members (card_number, student_id, staff_id, academic_year_id, status, remarks, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [card, Number.isFinite(sid) ? sid : null, Number.isFinite(tid) ? tid : null, ay, status, remarks]
    );
    const created = r.rows[0];
    res.status(201).json({
      status: 'SUCCESS',
      message: 'Member created',
      data: created,
    });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({
        status: 'ERROR',
        message: 'Duplicate card number or member already registered',
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
    const status =
      body.status !== undefined
        ? String(body.status).toLowerCase().trim() === 'active'
          ? 'active'
          : 'inactive'
        : ex.status;
    const remarks = body.remarks !== undefined ? (body.remarks == null || body.remarks === '' ? null : String(body.remarks).trim()) : ex.remarks;

    const r = await query(
      `UPDATE library_members SET
         card_number = $2,
         status = $3,
         remarks = $4,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, card_number, status, remarks]
    );
    const updated = r.rows[0];
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Member updated',
      data: updated,
    });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ status: 'ERROR', message: 'Duplicate card number' });
    }
    console.error('library member update', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to update member' });
  }
};

/** Next serial card in form LIB-00001 … LIB-99999 (based on existing LIB-nnnnn cards). */
const suggestNextCardNumber = async (req, res) => {
  try {
    const r = await query(
      `SELECT card_number FROM library_members WHERE card_number ~* '^LIB-[0-9]+$'`
    );
    let maxSeq = 0;
    for (const row of r.rows) {
      const m = /^LIB-(\d+)$/i.exec(String(row.card_number || '').trim());
      if (m) {
        const n = parseInt(m[1], 10);
        if (Number.isFinite(n)) maxSeq = Math.max(maxSeq, n);
      }
    }
    const next = maxSeq + 1;
    const card_number = `LIB-${String(next).padStart(5, '0')}`;
    res.status(200).json({ status: 'SUCCESS', message: 'OK', data: { card_number } });
  } catch (e) {
    console.error('library member next card', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to suggest card number' });
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
  suggestNextCardNumber,
  createMember,
  updateMember,
  deleteMember,
};
