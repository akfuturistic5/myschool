const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');

const listPayslips = async (req, res) => {
  try {
    const { month, year, status, staff_id } = req.query;
    
    let sql = `
      SELECT 
        p.*,
        u.first_name || ' ' || u.last_name AS name,
        s.employee_code,
        u.phone,
        d.department_name AS department,
        des.designation_name AS designation,
        p.net_amount AS net_salary
      FROM staff_payslips p
      JOIN staff s ON s.id = p.staff_id
      JOIN users u ON u.id = s.user_id
      LEFT JOIN departments d ON d.id = s.department_id
      LEFT JOIN designations des ON des.id = s.designation_id
      WHERE s.deleted_at IS NULL
    `;
    const params = [];
    let idx = 1;

    if (month) {
      sql += ` AND EXTRACT(MONTH FROM lower(p.salary_period)) = $${idx++}`;
      params.push(month);
    }
    if (year) {
      sql += ` AND EXTRACT(YEAR FROM lower(p.salary_period)) = $${idx++}`;
      params.push(year);
    }
    if (status) {
      sql += ` AND p.status = $${idx++}`;
      params.push(status);
    }
    if (staff_id) {
      sql += ` AND p.staff_id = $${idx++}`;
      params.push(staff_id);
    }

    sql += ` ORDER BY lower(p.salary_period) DESC, u.first_name ASC`;

    const result = await query(sql, params);
    return success(res, 200, 'Payslips fetched successfully', result.rows);
  } catch (error) {
    console.error('Error fetching payslips:', error);
    return errorResponse(res, 500, 'Failed to fetch payslips', error.message);
  }
};

const getPayslipById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT p.*, u.first_name, u.last_name, s.employee_code
       FROM staff_payslips p
       JOIN staff s ON s.id = p.staff_id
       JOIN users u ON u.id = s.user_id
       WHERE p.id = $1`,
      [id]
    );
    if (result.rows.length === 0) return errorResponse(res, 404, 'Payslip not found');
    return success(res, 200, 'Payslip fetched successfully', result.rows[0]);
  } catch (error) {
    console.error('Error fetching payslip:', error);
    return errorResponse(res, 500, 'Failed to fetch payslip', error.message);
  }
};

const generatePayroll = async (req, res) => {
  try {
    const { month, year: targetYear } = req.body;
    const currentYear = targetYear || new Date().getFullYear();
    const targetMonth = month || (new Date().getMonth() + 1);

    // 1. Define the period
    const startDate = `${currentYear}-${String(targetMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(currentYear, targetMonth, 0).getDate();
    const endDate = `${currentYear}-${String(targetMonth).padStart(2, '0')}-${lastDay}`;
    const period = `[${startDate}, ${endDate}]`;

    // 2. Fetch active staff with their active salary assignments for this period
    const staffWithAssignments = await query(`
      SELECT DISTINCT ON (s.id)
        s.id AS staff_id,
        sa.id AS assignment_id,
        sa.basic_salary,
        sa.valid_period,
        s.status as staff_status
      FROM staff s
      JOIN staff_salary_assignments sa ON sa.staff_id = s.id
      WHERE s.deleted_at IS NULL 
        AND s.status = 'Active'
        AND lower(sa.valid_period) <= $1::date
      ORDER BY s.id, sa.valid_period @> $1::date DESC, lower(sa.valid_period) DESC
    `, [startDate]);

    console.log(`Generating payroll for period ${period}. Found ${staffWithAssignments.rows.length} staff with assignments.`);

    if (staffWithAssignments.rows.length === 0) {
      return errorResponse(res, 404, `No active staff found with salary settings starting on or before ${startDate}. Please ensure staff have an active Salary Assignment in their profile.`);
    }

    const createdPayslips = [];

    for (const row of staffWithAssignments.rows) {
      // Check if payslip already exists for this period
      const existing = await query(`
        SELECT id FROM staff_payslips 
        WHERE staff_id = $1 AND salary_period = $2::daterange AND status != 'Cancelled'
      `, [row.staff_id, period]);

      if (existing.rows.length > 0) continue;

      // Fetch components
      const components = await query(`
        SELECT 
          c.component_name,
          c.type,
          cv.amount
        FROM staff_salary_component_values cv
        JOIN salary_components c ON c.id = cv.component_id
        WHERE cv.salary_assignment_id = $1
      `, [row.assignment_id]);

      const allowances = components.rows.filter(c => c.type === 'allowance');
      const deductions = components.rows.filter(c => c.type === 'deduction');

      const gross = parseFloat(row.basic_salary) + allowances.reduce((acc, c) => acc + parseFloat(c.amount), 0);
      const net = gross - deductions.reduce((acc, c) => acc + parseFloat(c.amount), 0);

      const payslip = await query(`
        INSERT INTO staff_payslips (
          staff_id, salary_assignment_id, salary_period, 
          basic_salary_snapshot, allowances_snapshot, deductions_snapshot,
          gross_amount, net_amount, status
        ) VALUES ($1, $2, $3::daterange, $4, $5, $6, $7, $8, 'Draft')
        RETURNING *
      `, [
        row.staff_id, row.assignment_id, period,
        row.basic_salary, JSON.stringify(allowances), JSON.stringify(deductions),
        gross, net
      ]);

      createdPayslips.push(payslip.rows[0]);
    }

    return success(res, 201, `${createdPayslips.length} payslips generated successfully`, createdPayslips);
  } catch (error) {
    console.error('Error generating payroll:', error);
    return errorResponse(res, 500, 'Failed to generate payroll', error.message);
  }
};

const updatePayslipStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const result = await query(
      'UPDATE staff_payslips SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );
    if (result.rows.length === 0) return errorResponse(res, 404, 'Payslip not found');
    return success(res, 200, 'Payslip status updated', result.rows[0]);
  } catch (error) {
    console.error('Error updating payslip status:', error);
    return errorResponse(res, 500, 'Failed to update payslip status', error.message);
  }
};

const deletePayslip = async (req, res) => {
  try {
    const { id } = req.params;
    const check = await query('SELECT status FROM staff_payslips WHERE id = $1', [id]);
    if (check.rows.length === 0) return errorResponse(res, 404, 'Payslip not found');
    if (check.rows[0].status === 'Paid') return errorResponse(res, 400, 'Cannot delete a paid payslip');

    await query('DELETE FROM staff_payslips WHERE id = $1', [id]);
    return success(res, 200, 'Payslip deleted successfully');
  } catch (error) {
    console.error('Error deleting payslip:', error);
    return errorResponse(res, 500, 'Failed to delete payslip', error.message);
  }
};

const bulkDeletePayslips = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !ids.length) return errorResponse(res, 400, 'No IDs provided');
    const result = await query('DELETE FROM staff_payslips WHERE id = ANY($1) AND status != \'Paid\' RETURNING id', [ids]);
    return success(res, 200, `${result.rows.length} payslips deleted successfully`);
  } catch (error) {
    console.error('Error bulk deleting payslips:', error);
    return errorResponse(res, 500, 'Failed to bulk delete payslips', error.message);
  }
};

const bulkUpdatePayslipStatus = async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!ids || !ids.length) return errorResponse(res, 400, 'No IDs provided');
    const result = await query('UPDATE staff_payslips SET status = $1, updated_at = NOW() WHERE id = ANY($2) RETURNING id', [status, ids]);
    return success(res, 200, `${result.rows.length} payslips updated successfully`);
  } catch (error) {
    console.error('Error bulk updating payslips:', error);
    return errorResponse(res, 500, 'Failed to bulk update payslips', error.message);
  }
};

module.exports = {
  listPayslips,
  getPayslipById,
  generatePayroll,
  updatePayslipStatus,
  deletePayslip,
  bulkDeletePayslips,
  bulkUpdatePayslipStatus,
};
