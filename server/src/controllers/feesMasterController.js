/**
 * Fees Master Controller → now maps to fees_class_types + fees_installments
 *
 * In the new schema there is no standalone "fees_master" table.
 * The equivalent is:
 *   fees_class_types  → defines what fees (type + amount) belong to a class/year fee config
 *   fees_installments → defines the payment schedule for a fee config
 *
 * This controller manages both.
 */

const { query, executeTransaction } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { getAuthContext, isAdmin } = require('../utils/accessControl');

// ─── LIST FEE ITEMS (fees_class_types) ───────────────────────────────────────
const getFeesMaster = async (req, res) => {
    try {
        const { academic_year_id, class_id, fee_id } = req.query;

        if (!academic_year_id) {
            return errorResponse(res, 400, 'academic_year_id is required');
        }

        let whereClause = 'WHERE fct.academic_year_id = $1';
        const params = [academic_year_id];

        if (class_id) {
            whereClause += ` AND fct.class_id = $${params.length + 1}`;
            params.push(class_id);
        }
        if (fee_id) {
            whereClause += ` AND fct.fee_id = $${params.length + 1}`;
            params.push(fee_id);
        }

        const result = await query(
            `SELECT
                fct.*,
                ft.name AS fee_type_name,
                ft.code AS fee_type_code,
                c.class_name,
                f.due_date AS fee_due_date,
                f.late_fee_type,
                f.late_fee_charge,
                f.late_fee_frequency
             FROM fees_class_types fct
             JOIN fees_types ft ON fct.fee_type_id = ft.id
             JOIN classes c ON fct.class_id = c.id
             JOIN fees f ON fct.fee_id = f.id AND f.deleted_at IS NULL
             ${whereClause}
             ORDER BY c.class_name ASC, ft.name ASC`,
            params
        );

        return success(res, 200, 'Fee items retrieved successfully', result.rows);
    } catch (error) {
        console.error('Error in getFeesMaster:', error);
        return errorResponse(res, 500, error.message || 'Internal server error');
    }
};

// ─── ADD FEE ITEM to an existing fee config ───────────────────────────────────
const createFeesMaster = async (req, res) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) {
            return errorResponse(res, 403, 'Access denied');
        }

        const { fee_id, fee_type_id, amount, is_optional } = req.body;

        if (!fee_id || !fee_type_id || amount == null) {
            return errorResponse(res, 400, 'fee_id, fee_type_id, and amount are required');
        }

        if (parseFloat(amount) < 0) {
            return errorResponse(res, 400, 'Amount cannot be negative');
        }

        const createdBy = req.user?.id || null;

        // Get fee header to extract class_id and academic_year_id for triple-key
        const feeHeader = await query(
            'SELECT id, class_id, academic_year_id FROM fees WHERE id = $1 AND deleted_at IS NULL',
            [fee_id]
        );
        if (feeHeader.rowCount === 0) {
            return errorResponse(res, 404, 'Fee configuration not found');
        }

        const { class_id, academic_year_id } = feeHeader.rows[0];

        const result = await query(
            `INSERT INTO fees_class_types
                (fee_id, class_id, academic_year_id, fee_type_id, amount, is_optional, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [fee_id, class_id, academic_year_id, fee_type_id, parseFloat(amount), is_optional ?? false, createdBy]
        );

        return success(res, 201, 'Fee item added successfully', result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return errorResponse(res, 409, 'This fee type is already added to this fee configuration');
        }
        console.error('Error in createFeesMaster:', error);
        return errorResponse(res, 500, error.message || 'Internal server error');
    }
};

// ─── UPDATE FEE ITEM ──────────────────────────────────────────────────────────
const updateFeesMaster = async (req, res) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) {
            return errorResponse(res, 403, 'Access denied');
        }

        const { id } = req.params;
        const { amount, is_optional } = req.body;

        if (amount != null && parseFloat(amount) < 0) {
            return errorResponse(res, 400, 'Amount cannot be negative');
        }

        const updatedBy = req.user?.id || null;

        const result = await query(
            `UPDATE fees_class_types SET
                amount = COALESCE($1, amount),
                is_optional = COALESCE($2, is_optional),
                updated_at = NOW(),
                updated_by = $3
             WHERE id = $4
             RETURNING *`,
            [amount != null ? parseFloat(amount) : null, is_optional ?? null, updatedBy, id]
        );

        if (result.rowCount === 0) {
            return errorResponse(res, 404, 'Fee item not found');
        }

        return success(res, 200, 'Fee item updated successfully', result.rows[0]);
    } catch (error) {
        console.error('Error in updateFeesMaster:', error);
        return errorResponse(res, 500, error.message || 'Internal server error');
    }
};

// ─── DELETE FEE ITEM ─────────────────────────────────────────────────────────
const deleteFeesMaster = async (req, res) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) {
            return errorResponse(res, 403, 'Access denied');
        }

        const { id } = req.params;

        // Block if any payment exists for this fee type
        const paymentCheck = await query(
            `SELECT 1 FROM compulsory_fees cf
             JOIN fees f ON cf.fee_id = f.id
             JOIN fees_class_types fct ON fct.fee_id = f.id AND fct.id = $1
             LIMIT 1`,
            [id]
        );
        if (paymentCheck.rowCount > 0) {
            return errorResponse(res, 400, 'Cannot delete a fee item that has payment records');
        }

        const result = await query(
            'DELETE FROM fees_class_types WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rowCount === 0) {
            return errorResponse(res, 404, 'Fee item not found');
        }

        return success(res, 200, 'Fee item deleted successfully');
    } catch (error) {
        console.error('Error in deleteFeesMaster:', error);
        return errorResponse(res, 500, error.message || 'Internal server error');
    }
};

// ─── BULK DELETE ──────────────────────────────────────────────────────────────
const bulkDeleteFeesMaster = async (req, res) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) {
            return errorResponse(res, 403, 'Access denied');
        }

        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return errorResponse(res, 400, 'ids array is required');
        }

        const result = await query(
            'DELETE FROM fees_class_types WHERE id = ANY($1) RETURNING id',
            [ids]
        );

        return success(res, 200, `${result.rowCount} fee item(s) deleted successfully`);
    } catch (error) {
        console.error('Error in bulkDeleteFeesMaster:', error);
        return errorResponse(res, 500, error.message || 'Internal server error');
    }
};

// ─── INSTALLMENTS ─────────────────────────────────────────────────────────────
const getInstallments = async (req, res) => {
    try {
        const { fee_id } = req.params;

        const result = await query(
            `SELECT fi.*
             FROM fees_installments fi
             JOIN fees f ON fi.fee_id = f.id AND f.deleted_at IS NULL
             WHERE fi.fee_id = $1
             ORDER BY fi.due_date ASC`,
            [fee_id]
        );

        return success(res, 200, 'Installments retrieved successfully', result.rows);
    } catch (error) {
        console.error('Error in getInstallments:', error);
        return errorResponse(res, 500, error.message || 'Internal server error');
    }
};

const createInstallment = async (req, res) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) {
            return errorResponse(res, 403, 'Access denied');
        }

        const { fee_id } = req.params;
        const { installment_name, due_date, amount, late_fee_type, late_fee_charge, late_fee_frequency } = req.body;

        if (!installment_name || !due_date || amount == null) {
            return errorResponse(res, 400, 'installment_name, due_date, and amount are required');
        }

        if (parseFloat(amount) < 0) {
            return errorResponse(res, 400, 'Amount cannot be negative');
        }

        const feeHeader = await query(
            'SELECT id, class_id, academic_year_id FROM fees WHERE id = $1 AND deleted_at IS NULL',
            [fee_id]
        );
        if (feeHeader.rowCount === 0) {
            return errorResponse(res, 404, 'Fee configuration not found');
        }

        const { class_id, academic_year_id } = feeHeader.rows[0];
        const createdBy = req.user?.id || null;

        const result = await query(
            `INSERT INTO fees_installments
                (fee_id, class_id, academic_year_id, installment_name, due_date, amount,
                 late_fee_type, late_fee_charge, late_fee_frequency, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [
                fee_id, class_id, academic_year_id, installment_name, due_date,
                parseFloat(amount),
                late_fee_type || 'fixed',
                late_fee_charge || 0,
                late_fee_frequency || 'once',
                createdBy
            ]
        );

        return success(res, 201, 'Installment created successfully', result.rows[0]);
    } catch (error) {
        console.error('Error in createInstallment:', error);
        return errorResponse(res, 500, error.message || 'Internal server error');
    }
};

const deleteInstallment = async (req, res) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) {
            return errorResponse(res, 403, 'Access denied');
        }

        const { id } = req.params;

        // Block if payments reference this installment
        const paymentCheck = await query(
            'SELECT 1 FROM compulsory_fees WHERE fee_installment_id = $1 LIMIT 1',
            [id]
        );
        if (paymentCheck.rowCount > 0) {
            return errorResponse(res, 400, 'Cannot delete an installment that has payment records');
        }

        const result = await query(
            'DELETE FROM fees_installments WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rowCount === 0) {
            return errorResponse(res, 404, 'Installment not found');
        }

        return success(res, 200, 'Installment deleted successfully');
    } catch (error) {
        console.error('Error in deleteInstallment:', error);
        return errorResponse(res, 500, error.message || 'Internal server error');
    }
};

module.exports = {
    getFeesMaster,
    createFeesMaster,
    updateFeesMaster,
    deleteFeesMaster,
    bulkDeleteFeesMaster,
    getInstallments,
    createInstallment,
    deleteInstallment
};
