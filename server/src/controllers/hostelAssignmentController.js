const { query, executeTransaction } = require('../config/database');
const { success, errorResponse } = require('../utils/responseHelper');

const pickUserGenderForStudent = async (studentId) => {
  const r = await query(
    `
    SELECT u.gender
    FROM students s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = $1 AND s.is_active = true
    LIMIT 1
    `,
    [studentId]
  );
  return r.rows[0]?.gender ?? null;
};

const pickUserGenderForStaff = async (staffId) => {
  const r = await query(
    `
    SELECT u.gender
    FROM staff s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = $1 AND s.deleted_at IS NULL
    LIMIT 1
    `,
    [staffId]
  );
  return r.rows[0]?.gender ?? null;
};

const validateHostelGender = (hostelGender, userGender) => {
  if (hostelGender === 'mixed') return true;
  if (!userGender) return false;
  const g = String(userGender).trim().toLowerCase();
  if (hostelGender === 'boys') return g === 'male';
  if (hostelGender === 'girls') return g === 'female';
  return false;
};

const normalizeAssignmentStatus = (value) => {
  const s = String(value ?? '').trim().toLowerCase();
  if (s === 'active' || s === 'completed' || s === 'cancelled') return s;
  return null;
};

const releaseAssignmentBedTx = async (client, bedId, roomId) => {
  await client.query(
    `
    UPDATE hostel_beds SET bed_status = 'available', updated_at = NOW()
    WHERE id = $1 AND deleted_at IS NULL
    `,
    [bedId]
  );
  const capQ = await client.query(
    `
    SELECT rt.sharing_capacity AS capacity_effective
    FROM hostel_rooms r
    JOIN hostel_room_types rt ON rt.id = r.hostel_room_type_id
    WHERE r.id = $1
    `,
    [roomId]
  );
  const cap = Math.max(1, Number(capQ.rows[0]?.capacity_effective) || 1);
  await client.query(
    `
    UPDATE hostel_rooms
    SET room_status = CASE
        WHEN (
          SELECT COUNT(*) FROM hostel_beds bx
          WHERE bx.room_id = $1 AND bx.deleted_at IS NULL
            AND bx.bed_status IN ('occupied', 'reserved')
        ) >= $2 THEN 'full'::character varying
        ELSE 'available'::character varying
      END,
      updated_at = NOW()
    WHERE id = $1
    `,
    [roomId, cap]
  );
};

const occupyAssignmentBedTx = async (client, bedId, roomId) => {
  const bedQ = await client.query(
    `SELECT bed_status FROM hostel_beds WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
    [bedId]
  );
  if (!bedQ.rows.length) {
    const err = new Error('Bed not found');
    err.statusCode = 400;
    throw err;
  }
  if (String(bedQ.rows[0].bed_status) !== 'available') {
    const err = new Error('Bed is not available');
    err.statusCode = 409;
    throw err;
  }
  await client.query(
    `
    UPDATE hostel_beds SET bed_status = 'occupied', updated_at = NOW()
    WHERE id = $1 AND deleted_at IS NULL
    `,
    [bedId]
  );
  const capQ = await client.query(
    `
    SELECT rt.sharing_capacity AS capacity_effective
    FROM hostel_rooms r
    JOIN hostel_room_types rt ON rt.id = r.hostel_room_type_id
    WHERE r.id = $1
    `,
    [roomId]
  );
  const cap = Math.max(1, Number(capQ.rows[0]?.capacity_effective) || 1);
  await client.query(
    `
    UPDATE hostel_rooms
    SET room_status = CASE
        WHEN (
          SELECT COUNT(*) FROM hostel_beds bx
          WHERE bx.room_id = $1 AND bx.deleted_at IS NULL
            AND bx.bed_status IN ('occupied', 'reserved')
        ) >= $2 THEN 'full'::character varying
        ELSE 'available'::character varying
      END,
      updated_at = NOW()
    WHERE id = $1
    `,
    [roomId, cap]
  );
};

const chainRow = async (hostelId, floorId, roomId, bedId) => {
  const r = await query(
    `
    SELECT
      h.id AS hostel_id,
      h.gender AS hostel_gender,
      hf.id AS floor_id,
      hf.hostel_id AS floor_hostel_id,
      r.id AS room_id,
      r.hostel_id AS room_hostel_id,
      r.floor_id AS room_floor_id,
      b.id AS bed_id,
      b.room_id AS bed_room_id,
      b.bed_status,
      rt.sharing_capacity,
      rt.sharing_capacity AS capacity_effective
    FROM hostels h
    JOIN hostel_floors hf ON hf.id = $2 AND hf.hostel_id = h.id AND hf.deleted_at IS NULL
    JOIN hostel_rooms r ON r.id = $3 AND r.floor_id = hf.id AND r.hostel_id = h.id AND r.deleted_at IS NULL
    JOIN hostel_beds b ON b.id = $4 AND b.room_id = r.id AND b.deleted_at IS NULL AND b.is_active = true
    JOIN hostel_room_types rt ON rt.id = r.hostel_room_type_id
    WHERE h.id = $1 AND h.deleted_at IS NULL AND h.is_active = true
    `,
    [hostelId, floorId, roomId, bedId]
  );
  return r.rows[0] ?? null;
};

const getHostelAssignments = async (req, res) => {
  try {
    const cond = [`ha.deleted_at IS NULL`];
    const params = [];
    let i = 0;
    const add = (clause, val) => {
      i += 1;
      params.push(val);
      cond.push(`${clause} $${i}`);
    };

    if (req.query.academic_year_id) {
      const y = Number(req.query.academic_year_id);
      if (!Number.isNaN(y)) add('ha.academic_year_id =', y);
    }
    if (req.query.hostel_id) {
      const h = Number(req.query.hostel_id);
      if (!Number.isNaN(h)) add('ha.hostel_id =', h);
    }
    if (req.query.student_id) {
      const s = Number(req.query.student_id);
      if (!Number.isNaN(s)) add('ha.student_id =', s);
    }
    if (req.query.status) {
      params.push(String(req.query.status));
      cond.push(`ha.assignment_status = $${params.length}`);
    }

    const sql = `
      SELECT
        ha.*,
        h.hostel_name,
        ay.year_name AS academic_year_name,
        r.room_number,
        b.bed_number
      FROM hostel_assignments ha
      JOIN hostels h ON h.id = ha.hostel_id
      JOIN academic_years ay ON ay.id = ha.academic_year_id
      JOIN hostel_rooms r ON r.id = ha.room_id
      JOIN hostel_beds b ON b.id = ha.bed_id
      WHERE ${cond.join(' AND ')}
      ORDER BY ha.assigned_date DESC, ha.id DESC
      LIMIT 500
    `;

    const result = await query(sql, params);
    return success(res, 200, 'Hostel assignments fetched successfully', result.rows, {
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error listing hostel assignments:', error);
    return errorResponse(res, 500, 'Failed to fetch hostel assignments');
  }
};

const getHostelAssignmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `
      SELECT
        ha.*,
        h.hostel_name,
        ay.year_name AS academic_year_name,
        r.room_number,
        b.bed_number
      FROM hostel_assignments ha
      JOIN hostels h ON h.id = ha.hostel_id
      JOIN academic_years ay ON ay.id = ha.academic_year_id
      JOIN hostel_rooms r ON r.id = ha.room_id
      JOIN hostel_beds b ON b.id = ha.bed_id
      WHERE ha.id = $1 AND ha.deleted_at IS NULL
      LIMIT 1
      `,
      [id]
    );
    if (!result.rows.length) {
      return errorResponse(res, 404, 'Hostel assignment not found');
    }
    return success(res, 200, 'Hostel assignment fetched successfully', result.rows[0]);
  } catch (error) {
    console.error('Error fetching hostel assignment:', error);
    return errorResponse(res, 500, 'Failed to fetch hostel assignment');
  }
};

const createHostelAssignment = async (req, res) => {
  try {
    const b = req.body || {};
    const {
      academic_year_id,
      user_type,
      student_id,
      staff_id,
      hostel_id,
      floor_id,
      room_id,
      bed_id,
      assigned_date,
      expected_checkout_date,
      checkout_date,
      security_deposit,
      remarks,
      assigned_by,
      assignment_status,
    } = b;

    const ut =
      user_type != null ? String(user_type).trim().toLowerCase() : '';
    if (ut !== 'student' && ut !== 'staff') {
      return errorResponse(res, 400, 'user_type must be student or staff');
    }

    let sid =
      ut === 'student' && student_id != null && student_id !== '' ? Number(student_id) : null;
    let stfid = ut === 'staff' && staff_id != null && staff_id !== '' ? Number(staff_id) : null;
    if (ut === 'student' && (sid === null || Number.isNaN(sid))) {
      return errorResponse(res, 400, 'student_id is required for student assignments');
    }
    if (ut === 'staff' && (stfid === null || Number.isNaN(stfid))) {
      return errorResponse(res, 400, 'staff_id is required for staff assignments');
    }

    const hid =
      hostel_id != null && hostel_id !== '' ? Number(hostel_id) : null;
    const fid =
      floor_id != null && floor_id !== '' ? Number(floor_id) : null;
    const rid = room_id != null && room_id !== '' ? Number(room_id) : null;
    const bid = bed_id != null && bed_id !== '' ? Number(bed_id) : null;
    if ([hid, fid, rid, bid].some((x) => x === null || Number.isNaN(x))) {
      return errorResponse(res, 400, 'hostel_id, floor_id, room_id, and bed_id are required integers');
    }

    const yr =
      academic_year_id != null && academic_year_id !== ''
        ? Number(academic_year_id)
        : null;
    if (yr === null || Number.isNaN(yr)) {
      return errorResponse(res, 400, 'academic_year_id is required');
    }

    const chain = await chainRow(hid, fid, rid, bid);
    if (!chain) {
      return errorResponse(
        res,
        400,
        'Hierarchy mismatch or inactive records (hostel, floor, room, bed)'
      );
    }

    let cOut =
      checkout_date != null && checkout_date !== '' ? String(checkout_date).trim() : null;
    if (cOut === '') cOut = null;

    if (
      assignment_status != null &&
      String(assignment_status).trim() !== '' &&
      cOut == null &&
      !normalizeAssignmentStatus(assignment_status)
    ) {
      return errorResponse(
        res,
        400,
        'assignment_status must be active, completed, or cancelled'
      );
    }

    let statusIns = normalizeAssignmentStatus(assignment_status) || 'active';
    if (cOut != null) {
      statusIns = 'completed';
    }
    const occupyBed = statusIns === 'active';
    const immediateComplete = statusIns === 'completed';

    if (occupyBed && String(chain.bed_status) !== 'available') {
      return errorResponse(res, 409, 'Bed is not available');
    }

    const occ = await query(
      `
      SELECT COUNT(*)::int AS c
      FROM hostel_beds bx
      WHERE bx.room_id = $1 AND bx.deleted_at IS NULL
        AND bx.bed_status IN ('occupied', 'reserved')
      `,
      [rid]
    );
    const cap =
      Number(chain.capacity_effective) > 0 ? Number(chain.capacity_effective) : 1;
    if (occupyBed && !immediateComplete && (occ.rows[0]?.c ?? 0) >= cap) {
      return errorResponse(res, 409, 'Room is at capacity; cannot assign another occupant');
    }

    if (occupyBed && ut === 'student') {
      const dup = await query(
        `
        SELECT id FROM hostel_assignments
        WHERE student_id = $1 AND assignment_status = 'active' AND deleted_at IS NULL
        LIMIT 1
        `,
        [sid]
      );
      if (dup.rows.length) {
        return errorResponse(res, 409, 'Student already has an active hostel assignment');
      }
      const userGender = await pickUserGenderForStudent(sid);
      if (!validateHostelGender(String(chain.hostel_gender).toLowerCase(), userGender)) {
        return errorResponse(res, 400, 'Student gender does not match hostel gender rule');
      }
    } else if (occupyBed && ut === 'staff') {
      const dup = await query(
        `
        SELECT id FROM hostel_assignments
        WHERE staff_id = $1 AND assignment_status = 'active' AND deleted_at IS NULL
        LIMIT 1
        `,
        [stfid]
      );
      if (dup.rows.length) {
        return errorResponse(res, 409, 'Staff member already has an active hostel assignment');
      }
      const userGender = await pickUserGenderForStaff(stfid);
      if (!validateHostelGender(String(chain.hostel_gender).toLowerCase(), userGender)) {
        return errorResponse(res, 400, 'Staff gender does not match hostel gender rule');
      }
    }

    let assignBy =
      assigned_by != null && assigned_by !== '' ? Number(assigned_by) : null;
    if (assignBy !== null && Number.isNaN(assignBy)) assignBy = null;
    if (assignBy !== null) {
      const u = await query(`SELECT id FROM users WHERE id = $1 LIMIT 1`, [assignBy]);
      if (!u.rows.length) assignBy = null;
    }

    const ad =
      assigned_date != null && assigned_date !== ''
        ? assigned_date
        : new Date().toISOString().slice(0, 10);

    let dep =
      security_deposit != null && security_deposit !== ''
        ? Number(security_deposit)
        : 0;
    if (dep !== dep || dep < 0) dep = 0;

    let expOut = expected_checkout_date != null ? expected_checkout_date : null;
    if (expOut === '') expOut = null;

    if (cOut != null && String(cOut) < String(ad)) {
      return errorResponse(res, 400, 'checkout_date must be on or after assigned_date');
    }

    const row = await executeTransaction(async (client) => {
      const checkoutIns = statusIns === 'completed' ? cOut || ad : null;

      const ins = await client.query(
        `
        INSERT INTO hostel_assignments (
          academic_year_id, user_type, student_id, staff_id,
          hostel_id, floor_id, room_id, bed_id,
          assigned_date, expected_checkout_date, checkout_date,
          security_deposit, remarks, assignment_status,
          assigned_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
        `,
        [
          yr,
          ut,
          ut === 'student' ? sid : null,
          ut === 'staff' ? stfid : null,
          hid,
          fid,
          rid,
          bid,
          ad,
          expOut,
          checkoutIns,
          dep,
          remarks != null ? String(remarks) : null,
          statusIns,
          assignBy,
        ]
      );

      if (occupyBed) {
        await client.query(
          `
          UPDATE hostel_beds SET bed_status = 'occupied', updated_at = NOW()
          WHERE id = $1 AND deleted_at IS NULL
          `,
          [bid]
        );
      }

      await client.query(
        `
        UPDATE hostel_rooms
        SET room_status = CASE
            WHEN (
              SELECT COUNT(*) FROM hostel_beds bx
              WHERE bx.room_id = $1 AND bx.deleted_at IS NULL AND bx.bed_status IN ('occupied', 'reserved')
            ) >= $2 THEN 'full'::character varying
            ELSE 'available'::character varying
          END,
          updated_at = NOW()
        WHERE id = $1
        `,
        [rid, cap]
      );

      return ins.rows[0];
    });

    return success(res, 201, 'Hostel assignment created successfully', row);
  } catch (error) {
    console.error('Error creating hostel assignment:', error);
    if (error.code === '23505') {
      return errorResponse(res, 409, 'Conflict: bed or occupant already assigned');
    }
    return errorResponse(res, 500, 'Failed to create hostel assignment');
  }
};

const checkoutHostelAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const b = req.body || {};
    let checkoutDt = b.checkout_date ?? null;
    if (checkoutDt === '') checkoutDt = null;

    await executeTransaction(async (client) => {
      const cur = await client.query(
        `
        SELECT * FROM hostel_assignments
        WHERE id = $1 AND deleted_at IS NULL AND assignment_status = 'active'
        FOR UPDATE
        `,
        [id]
      );
      if (cur.rows.length === 0) {
        const err = new Error('Active hostel assignment not found');
        err.statusCode = 404;
        throw err;
      }
      const a = cur.rows[0];

      await client.query(
        `
        UPDATE hostel_assignments
        SET assignment_status = 'completed',
            checkout_date = COALESCE($2::date, CURRENT_DATE),
            updated_at = NOW()
        WHERE id = $1
        `,
        [id, checkoutDt]
      );

      await client.query(
        `
        UPDATE hostel_beds SET bed_status = 'available', updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        `,
        [a.bed_id]
      );

      const capQ = await client.query(
        `
        SELECT rt.sharing_capacity AS capacity_effective
        FROM hostel_rooms r
        JOIN hostel_room_types rt ON rt.id = r.hostel_room_type_id
        WHERE r.id = $1
        `,
        [a.room_id]
      );
      const cap = Math.max(
        1,
        Number(capQ.rows[0]?.capacity_effective) || 1
      );

      await client.query(
        `
        UPDATE hostel_rooms
        SET room_status = CASE
            WHEN (
              SELECT COUNT(*) FROM hostel_beds bx
              WHERE bx.room_id = $1 AND bx.deleted_at IS NULL
                AND bx.bed_status IN ('occupied', 'reserved')
            ) >= $2 THEN 'full'::character varying
            ELSE 'available'::character varying
          END,
          updated_at = NOW()
        WHERE id = $1
        `,
        [a.room_id, cap]
      );
    });

    const fresh = await query(`SELECT * FROM hostel_assignments WHERE id = $1`, [id]);
    return success(res, 200, 'Checkout completed', fresh.rows[0]);
  } catch (error) {
    console.error('Error checking out hostel assignment:', error);
    if (error.statusCode === 404) {
      return errorResponse(res, 404, error.message);
    }
    return errorResponse(res, 500, 'Failed to complete checkout');
  }
};

const updateRoomCapacityStatusTx = async (client, roomId) => {
  const capQ = await client.query(
    `
    SELECT rt.sharing_capacity AS capacity_effective
    FROM hostel_rooms r
    JOIN hostel_room_types rt ON rt.id = r.hostel_room_type_id
    WHERE r.id = $1
    `,
    [roomId]
  );
  const cap = Math.max(1, Number(capQ.rows[0]?.capacity_effective) || 1);
  await client.query(
    `
    UPDATE hostel_rooms
    SET room_status = CASE
        WHEN (
          SELECT COUNT(*) FROM hostel_beds bx
          WHERE bx.room_id = $1 AND bx.deleted_at IS NULL
            AND bx.bed_status IN ('occupied', 'reserved')
        ) >= $2 THEN 'full'::character varying
        ELSE 'available'::character varying
      END,
      updated_at = NOW()
    WHERE id = $1
    `,
    [roomId, cap]
  );
};

const updateHostelAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const aid = Number(id);
    if (Number.isNaN(aid)) {
      return errorResponse(res, 400, 'Invalid assignment id');
    }
    const b = req.body || {};

    const row = await executeTransaction(async (client) => {
      const curQ = await client.query(
        `
        SELECT * FROM hostel_assignments
        WHERE id = $1 AND deleted_at IS NULL
        FOR UPDATE
        `,
        [aid]
      );
      if (!curQ.rows.length) {
        const err = new Error('Hostel assignment not found');
        err.statusCode = 404;
        throw err;
      }
      const a = curQ.rows[0];
      const prevStatus = String(a.assignment_status || '').toLowerCase();
      let nextStatus =
        b.assignment_status !== undefined &&
        b.assignment_status !== null &&
        String(b.assignment_status).trim() !== ''
          ? normalizeAssignmentStatus(b.assignment_status)
          : prevStatus;
      if (
        b.assignment_status !== undefined &&
        b.assignment_status !== null &&
        String(b.assignment_status).trim() !== '' &&
        !nextStatus
      ) {
        const err = new Error('assignment_status must be active, completed, or cancelled');
        err.statusCode = 400;
        throw err;
      }

      const toYmd = (v) => {
        if (v == null || v === '') return null;
        if (v instanceof Date) return v.toISOString().slice(0, 10);
        const s = String(v).trim();
        return s.length >= 10 ? s.slice(0, 10) : s || null;
      };

      if (prevStatus !== 'active') {
        let ad = toYmd(a.assigned_date);
        if (
          b.assigned_date !== undefined &&
          b.assigned_date !== null &&
          String(b.assigned_date).trim() !== ''
        ) {
          ad = toYmd(b.assigned_date);
        }
        if (!ad) {
          const err = new Error('assigned_date is required');
          err.statusCode = 400;
          throw err;
        }

        let expOut =
          b.expected_checkout_date !== undefined
            ? b.expected_checkout_date === '' || b.expected_checkout_date === null
              ? null
              : toYmd(b.expected_checkout_date)
            : toYmd(a.expected_checkout_date);

        let checkoutDt =
          b.checkout_date !== undefined
            ? b.checkout_date === '' || b.checkout_date === null
              ? null
              : toYmd(b.checkout_date)
            : toYmd(a.checkout_date);

        let dep =
          b.security_deposit !== undefined &&
          b.security_deposit !== null &&
          b.security_deposit !== ''
            ? Number(b.security_deposit)
            : Number(a.security_deposit);
        if (dep !== dep || dep < 0) dep = 0;

        let remarks =
          b.remarks !== undefined
            ? b.remarks === null || b.remarks === ''
              ? null
              : String(b.remarks)
            : a.remarks;

        if (expOut != null && String(expOut) < String(ad)) {
          const err = new Error('expected_checkout_date must be on or after assigned_date');
          err.statusCode = 400;
          throw err;
        }

        if (nextStatus === 'completed' && !checkoutDt) {
          checkoutDt = ad;
        }
        if (checkoutDt != null && String(checkoutDt) < String(ad)) {
          const err = new Error('checkout_date must be on or after assigned_date');
          err.statusCode = 400;
          throw err;
        }

        if (nextStatus === 'active') {
          await occupyAssignmentBedTx(client, Number(a.bed_id), Number(a.room_id));
        }

        const upd = await client.query(
          `
          UPDATE hostel_assignments
          SET
            assigned_date = $2::date,
            expected_checkout_date = $3::date,
            checkout_date = $4::date,
            security_deposit = $5,
            remarks = $6,
            assignment_status = $7,
            updated_at = NOW()
          WHERE id = $1
          RETURNING *
          `,
          [aid, ad, expOut, checkoutDt, dep, remarks, nextStatus]
        );
        return upd.rows[0];
      }

      const numOr = (v, fallback) => {
        if (v === undefined || v === null || v === '') return fallback;
        const n = Number(v);
        return Number.isNaN(n) ? fallback : n;
      };

      let hid = numOr(b.hostel_id, a.hostel_id);
      let fid = numOr(b.floor_id, a.floor_id);
      let rid = numOr(b.room_id, a.room_id);
      let bid = numOr(b.bed_id, a.bed_id);

      if (nextStatus !== 'active') {
        hid = Number(a.hostel_id);
        fid = Number(a.floor_id);
        rid = Number(a.room_id);
        bid = Number(a.bed_id);
      }

      const chain = await chainRow(hid, fid, rid, bid);
      if (!chain) {
        const err = new Error('Hierarchy mismatch or inactive records (hostel, floor, room, bed)');
        err.statusCode = 400;
        throw err;
      }

      const locChanged =
        hid !== Number(a.hostel_id) ||
        fid !== Number(a.floor_id) ||
        rid !== Number(a.room_id) ||
        bid !== Number(a.bed_id);

      if (locChanged && hid !== Number(a.hostel_id)) {
        const ut = String(a.user_type).toLowerCase();
        if (ut === 'student' && a.student_id != null) {
          const userGender = await pickUserGenderForStudent(a.student_id);
          if (!validateHostelGender(String(chain.hostel_gender).toLowerCase(), userGender)) {
            const err = new Error('Student gender does not match hostel gender rule');
            err.statusCode = 400;
            throw err;
          }
        } else if (ut === 'staff' && a.staff_id != null) {
          const userGender = await pickUserGenderForStaff(a.staff_id);
          if (!validateHostelGender(String(chain.hostel_gender).toLowerCase(), userGender)) {
            const err = new Error('Staff gender does not match hostel gender rule');
            err.statusCode = 400;
            throw err;
          }
        }
      }

      const oldRid = Number(a.room_id);
      const oldBid = Number(a.bed_id);

      if (locChanged && (rid !== oldRid || bid !== oldBid)) {
        if (String(chain.bed_status) !== 'available') {
          const err = new Error('Target bed is not available');
          err.statusCode = 409;
          throw err;
        }
        if (rid !== oldRid) {
          const occ = await client.query(
            `
            SELECT COUNT(*)::int AS c
            FROM hostel_beds bx
            WHERE bx.room_id = $1 AND bx.deleted_at IS NULL
              AND bx.bed_status IN ('occupied', 'reserved')
            `,
            [rid]
          );
          const cap =
            Number(chain.capacity_effective) > 0 ? Number(chain.capacity_effective) : 1;
          if ((occ.rows[0]?.c ?? 0) >= cap) {
            const err = new Error('Target room is at capacity');
            err.statusCode = 409;
            throw err;
          }
        }
      }

      let ad =
        b.assigned_date !== undefined && b.assigned_date !== null && String(b.assigned_date).trim() !== ''
          ? toYmd(b.assigned_date)
          : toYmd(a.assigned_date);
      if (!ad) {
        const err = new Error('assigned_date is required');
        err.statusCode = 400;
        throw err;
      }

      let expOut =
        b.expected_checkout_date !== undefined
          ? b.expected_checkout_date === '' || b.expected_checkout_date === null
            ? null
            : toYmd(b.expected_checkout_date)
          : toYmd(a.expected_checkout_date);

      let dep =
        b.security_deposit !== undefined && b.security_deposit !== null && b.security_deposit !== ''
          ? Number(b.security_deposit)
          : Number(a.security_deposit);
      if (dep !== dep || dep < 0) dep = 0;

      let remarks =
        b.remarks !== undefined
          ? b.remarks === null || b.remarks === ''
            ? null
            : String(b.remarks)
          : a.remarks;

      if (expOut != null && String(expOut) < String(ad)) {
        const err = new Error('expected_checkout_date must be on or after assigned_date');
        err.statusCode = 400;
        throw err;
      }

      let checkoutDt =
        b.checkout_date !== undefined
          ? b.checkout_date === '' || b.checkout_date === null
            ? null
            : toYmd(b.checkout_date)
          : toYmd(a.checkout_date);
      if (nextStatus === 'completed' && !checkoutDt) {
        checkoutDt = ad;
      }
      if (checkoutDt != null && String(checkoutDt) < String(ad)) {
        const err = new Error('checkout_date must be on or after assigned_date');
        err.statusCode = 400;
        throw err;
      }

      if (prevStatus === 'active' && nextStatus !== 'active') {
        await releaseAssignmentBedTx(client, oldBid, oldRid);
      }

      if (locChanged && (rid !== oldRid || bid !== oldBid)) {
        await client.query(
          `
          UPDATE hostel_beds SET bed_status = 'available', updated_at = NOW()
          WHERE id = $1 AND deleted_at IS NULL
          `,
          [oldBid]
        );
        await updateRoomCapacityStatusTx(client, oldRid);

        await client.query(
          `
          UPDATE hostel_beds SET bed_status = 'occupied', updated_at = NOW()
          WHERE id = $1 AND deleted_at IS NULL
          `,
          [bid]
        );
        await updateRoomCapacityStatusTx(client, rid);
      }

      const upd = await client.query(
        `
        UPDATE hostel_assignments
        SET
          hostel_id = $2,
          floor_id = $3,
          room_id = $4,
          bed_id = $5,
          assigned_date = $6::date,
          expected_checkout_date = $7::date,
          checkout_date = $8::date,
          security_deposit = $9,
          remarks = $10,
          assignment_status = $11,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [aid, hid, fid, rid, bid, ad, expOut, checkoutDt, dep, remarks, nextStatus]
      );
      return upd.rows[0];
    });

    const enriched = await query(
      `
      SELECT
        ha.*,
        h.hostel_name,
        ay.year_name AS academic_year_name,
        r.room_number,
        b.bed_number
      FROM hostel_assignments ha
      JOIN hostels h ON h.id = ha.hostel_id
      JOIN academic_years ay ON ay.id = ha.academic_year_id
      JOIN hostel_rooms r ON r.id = ha.room_id
      JOIN hostel_beds b ON b.id = ha.bed_id
      WHERE ha.id = $1 AND ha.deleted_at IS NULL
      LIMIT 1
      `,
      [aid]
    );
    return success(res, 200, 'Hostel assignment updated successfully', enriched.rows[0] || row);
  } catch (error) {
    console.error('Error updating hostel assignment:', error);
    if (error.statusCode === 404) {
      return errorResponse(res, 404, error.message);
    }
    if (error.statusCode === 400) {
      return errorResponse(res, 400, error.message);
    }
    if (error.statusCode === 409) {
      return errorResponse(res, 409, error.message);
    }
    if (error.code === '23505') {
      return errorResponse(res, 409, 'Conflict: bed or occupant already assigned');
    }
    return errorResponse(res, 500, 'Failed to update hostel assignment');
  }
};

const cancelHostelAssignment = async (req, res) => {
  try {
    const { id } = req.params;

    await executeTransaction(async (client) => {
      const cur = await client.query(
        `
        SELECT * FROM hostel_assignments
        WHERE id = $1 AND deleted_at IS NULL AND assignment_status = 'active'
        FOR UPDATE
        `,
        [id]
      );
      if (cur.rows.length === 0) {
        const err = new Error('Active hostel assignment not found');
        err.statusCode = 404;
        throw err;
      }
      const a = cur.rows[0];

      await client.query(
        `
        UPDATE hostel_assignments
        SET assignment_status = 'cancelled',
            updated_at = NOW()
        WHERE id = $1
        `,
        [id]
      );

      await client.query(
        `
        UPDATE hostel_beds SET bed_status = 'available', updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        `,
        [a.bed_id]
      );

      const capQ = await client.query(
        `
        SELECT rt.sharing_capacity AS capacity_effective
        FROM hostel_rooms r
        JOIN hostel_room_types rt ON rt.id = r.hostel_room_type_id
        WHERE r.id = $1
        `,
        [a.room_id]
      );
      const cap = Math.max(1, Number(capQ.rows[0]?.capacity_effective) || 1);

      await client.query(
        `
        UPDATE hostel_rooms
        SET room_status = CASE
            WHEN (
              SELECT COUNT(*) FROM hostel_beds bx
              WHERE bx.room_id = $1 AND bx.deleted_at IS NULL
                AND bx.bed_status IN ('occupied', 'reserved')
            ) >= $2 THEN 'full'::character varying
            ELSE 'available'::character varying
          END,
          updated_at = NOW()
        WHERE id = $1
        `,
        [a.room_id, cap]
      );
    });

    const fresh = await query(`SELECT * FROM hostel_assignments WHERE id = $1`, [id]);
    return success(res, 200, 'Assignment cancelled', fresh.rows[0]);
  } catch (error) {
    console.error('Error cancelling hostel assignment:', error);
    if (error.statusCode === 404) {
      return errorResponse(res, 404, error.message);
    }
    return errorResponse(res, 500, 'Failed to cancel assignment');
  }
};

module.exports = {
  getHostelAssignments,
  getHostelAssignmentById,
  createHostelAssignment,
  updateHostelAssignment,
  checkoutHostelAssignment,
  cancelHostelAssignment,
};
