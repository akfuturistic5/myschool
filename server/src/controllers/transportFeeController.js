const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { resolveAcademicYearId, toPositiveInt } = require('../utils/academicYear');
const { hasColumn } = require('../utils/schemaInspector');

function normalizeStatus(status) {
  if (typeof status !== 'string') return 'Active';
  const lowered = status.trim().toLowerCase();
  return lowered === 'inactive' ? 'Inactive' : 'Active';
}

const getAllTransportFees = async (req, res) => {
  try {
    const hasAcademicYearId = await hasColumn('transport_fee_master', 'academic_year_id');
    const {
      page = 1,
      limit = 10,
      search = '',
      pickup_point_id,
      status,
      academic_year_id,
      sortField = 'id',
      sortOrder = 'ASC',
    } = req.query;
    const scopedAcademicYearId = hasAcademicYearId ? await resolveAcademicYearId(academic_year_id) : null;

    const offset = (Number(page) - 1) * Number(limit);
    const allowedSort = ['id', 'plan_name', 'duration_days', 'amount', 'staff_amount', 'status', 'created_at'];
    const orderBy = allowedSort.includes(sortField) ? `tfm.${sortField}` : 'tfm.id';
    const direction = String(sortOrder).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const params = [];
    let whereClause = 'WHERE 1=1';

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (tfm.plan_name ILIKE $${params.length} OR pp.point_name ILIKE $${params.length})`;
    }
    if (pickup_point_id && pickup_point_id !== 'all') {
      params.push(Number(pickup_point_id));
      whereClause += ` AND tfm.pickup_point_id = $${params.length}`;
    }
    if (status && status !== 'all') {
      params.push(normalizeStatus(status));
      whereClause += ` AND tfm.status = $${params.length}`;
    }
    if (hasAcademicYearId && scopedAcademicYearId) {
      params.push(scopedAcademicYearId);
      whereClause += ` AND tfm.academic_year_id = $${params.length}`;
    }

    const countResult = await query(
      `SELECT COUNT(*)
       FROM transport_fee_master tfm
       JOIN pickup_points pp ON pp.id = tfm.pickup_point_id
       ${whereClause}`,
      params
    );
    const totalCount = Number(countResult.rows[0]?.count || 0);

    const dataResult = await query(
      `SELECT tfm.*, pp.point_name
       FROM transport_fee_master tfm
       JOIN pickup_points pp ON pp.id = tfm.pickup_point_id
       ${whereClause}
       ORDER BY ${orderBy} ${direction}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, Number(limit), offset]
    );

    return success(res, 200, 'Transport fee plans fetched successfully', dataResult.rows, {
      totalCount,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(totalCount / Number(limit)),
    });
  } catch (err) {
    console.error('Error fetching transport fee plans:', err);
    return errorResponse(res, 500, 'Failed to fetch transport fee plans');
  }
};

const createTransportFee = async (req, res) => {
  try {
    const hasAcademicYearId = await hasColumn('transport_fee_master', 'academic_year_id');
    const { pickup_point_id, plan_name, duration_days = null, amount, staff_amount, status, academic_year_id } = req.body;
    if (
      !pickup_point_id ||
      !plan_name ||
      amount === undefined ||
      amount === null ||
      staff_amount === undefined ||
      staff_amount === null
    ) {
      return errorResponse(res, 400, 'pickup_point_id, plan_name, student amount and staff amount are required');
    }

    const scopedAcademicYearId = hasAcademicYearId
      ? await resolveAcademicYearId(academic_year_id || req.query?.academic_year_id)
      : null;

    const result = hasAcademicYearId
      ? await query(
          `INSERT INTO transport_fee_master (pickup_point_id, plan_name, duration_days, amount, staff_amount, status, academic_year_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            Number(pickup_point_id),
            String(plan_name).trim(),
            duration_days == null || duration_days === '' ? null : Number(duration_days),
            Number(amount),
            Number(staff_amount),
            normalizeStatus(status),
            scopedAcademicYearId,
          ]
        )
      : await query(
          `INSERT INTO transport_fee_master (pickup_point_id, plan_name, duration_days, amount, staff_amount, status)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            Number(pickup_point_id),
            String(plan_name).trim(),
            duration_days == null || duration_days === '' ? null : Number(duration_days),
            Number(amount),
            Number(staff_amount),
            normalizeStatus(status),
          ]
        );

    return success(res, 201, 'Transport fee plan created successfully', result.rows[0]);
  } catch (err) {
    console.error('Error creating transport fee plan:', err);
    if (err.code === '23505') {
      return errorResponse(res, 400, 'A fee plan with the same pickup point, name and duration already exists');
    }
    return errorResponse(res, 500, 'Failed to create transport fee plan');
  }
};

const updateTransportFee = async (req, res) => {
  try {
    const hasAcademicYearId = await hasColumn('transport_fee_master', 'academic_year_id');
    const feeId = Number(req.params.id);
    if (Number.isNaN(feeId)) {
      return errorResponse(res, 400, 'Invalid transport fee ID');
    }

    const { pickup_point_id, plan_name, duration_days, amount, staff_amount, status, academic_year_id } = req.body;
    const updates = [];
    const values = [];
    let i = 1;

    if (pickup_point_id !== undefined) {
      updates.push(`pickup_point_id = $${i++}`);
      values.push(Number(pickup_point_id));
    }
    if (plan_name !== undefined) {
      updates.push(`plan_name = $${i++}`);
      values.push(String(plan_name).trim());
    }
    if (duration_days !== undefined) {
      updates.push(`duration_days = $${i++}`);
      values.push(duration_days == null || duration_days === '' ? null : Number(duration_days));
    }
    if (amount !== undefined) {
      updates.push(`amount = $${i++}`);
      values.push(Number(amount));
    }
    if (staff_amount !== undefined) {
      updates.push(`staff_amount = $${i++}`);
      values.push(Number(staff_amount));
    }
    if (status !== undefined) {
      updates.push(`status = $${i++}`);
      values.push(normalizeStatus(status));
    }
    if (hasAcademicYearId && academic_year_id !== undefined) {
      updates.push(`academic_year_id = $${i++}`);
      values.push(toPositiveInt(academic_year_id));
    }

    if (!updates.length) {
      return errorResponse(res, 400, 'No fields to update');
    }

    values.push(feeId);
    const result = await query(
      `UPDATE transport_fee_master
       SET ${updates.join(', ')}
       WHERE id = $${i}
       RETURNING *`,
      values
    );

    if (!result.rows.length) {
      return errorResponse(res, 404, 'Transport fee plan not found');
    }

    return success(res, 200, 'Transport fee plan updated successfully', result.rows[0]);
  } catch (err) {
    console.error('Error updating transport fee plan:', err);
    if (err.code === '23505') {
      return errorResponse(res, 400, 'A fee plan with the same pickup point, name and duration already exists');
    }
    return errorResponse(res, 500, 'Failed to update transport fee plan');
  }
};

const deleteTransportFee = async (req, res) => {
  try {
    const feeId = Number(req.params.id);
    if (Number.isNaN(feeId)) {
      return errorResponse(res, 400, 'Invalid transport fee ID');
    }

    const usage = await query(
      `SELECT id
       FROM transport_allocations
       WHERE assigned_fee_id = $1
       LIMIT 1`,
      [feeId]
    );
    if (usage.rows.length > 0) {
      return errorResponse(res, 400, 'Cannot delete fee plan that is already used in allocations');
    }

    const result = await query(
      `DELETE FROM transport_fee_master
       WHERE id = $1
       RETURNING id`,
      [feeId]
    );

    if (!result.rows.length) {
      return errorResponse(res, 404, 'Transport fee plan not found');
    }
    return success(res, 200, 'Transport fee plan deleted successfully');
  } catch (err) {
    console.error('Error deleting transport fee plan:', err);
    return errorResponse(res, 500, 'Failed to delete transport fee plan');
  }
};

module.exports = {
  getAllTransportFees,
  createTransportFee,
  updateTransportFee,
  deleteTransportFee,
};
