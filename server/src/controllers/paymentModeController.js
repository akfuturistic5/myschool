const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { getAuthContext, isAdmin } = require('../utils/accessControl');

/**
 * List all payment modes
 */
const listPaymentModes = async (req, res) => {
    try {
        const { activeOnly } = req.query;
        let sql = 'SELECT * FROM payment_modes';
        const params = [];

        if (activeOnly === 'true') {
            sql += ' WHERE is_active = true';
        }

        sql += ' ORDER BY name ASC';
        
        const result = await query(sql, params);
        return success(res, 200, 'Payment modes retrieved successfully', result.rows);
    } catch (error) {
        console.error('Error in listPaymentModes:', error);
        return errorResponse(res, 500, 'Internal server error');
    }
};

/**
 * Get single payment mode
 */
const getPaymentMode = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query('SELECT * FROM payment_modes WHERE id = $1', [id]);
        
        if (result.rowCount === 0) {
            return errorResponse(res, 404, 'Payment mode not found');
        }
        
        return success(res, 200, 'Payment mode retrieved successfully', result.rows[0]);
    } catch (error) {
        console.error('Error in getPaymentMode:', error);
        return errorResponse(res, 500, 'Internal server error');
    }
};

/**
 * Create payment mode
 */
const createPaymentMode = async (req, res) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) return errorResponse(res, 403, 'Access denied');

        const { name, is_active } = req.body;
        if (!name) return errorResponse(res, 400, 'Name is required');

        const result = await query(
            'INSERT INTO payment_modes (name, is_active) VALUES ($1, $2) RETURNING *',
            [name, is_active ?? true]
        );
        
        return success(res, 201, 'Payment mode created successfully', result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return errorResponse(res, 409, 'Payment mode with this name already exists');
        }
        console.error('Error in createPaymentMode:', error);
        return errorResponse(res, 500, 'Internal server error');
    }
};

/**
 * Update payment mode
 */
const updatePaymentMode = async (req, res) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) return errorResponse(res, 403, 'Access denied');

        const { id } = req.params;
        const { name, is_active } = req.body;

        const result = await query(
            `UPDATE payment_modes 
             SET name = COALESCE($1, name), 
                 is_active = COALESCE($2, is_active),
                 updated_at = NOW()
             WHERE id = $3 RETURNING *`,
            [name, is_active, id]
        );

        if (result.rowCount === 0) {
            return errorResponse(res, 404, 'Payment mode not found');
        }
        
        return success(res, 200, 'Payment mode updated successfully', result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return errorResponse(res, 409, 'Payment mode with this name already exists');
        }
        console.error('Error in updatePaymentMode:', error);
        return errorResponse(res, 500, 'Internal server error');
    }
};

/**
 * Delete payment mode
 */
const deletePaymentMode = async (req, res) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) return errorResponse(res, 403, 'Access denied');

        const { id } = req.params;
        
        // Optional: Check if used in transactions before deleting
        // For now, simple delete
        const result = await query('DELETE FROM payment_modes WHERE id = $1 RETURNING *', [id]);

        if (result.rowCount === 0) {
            return errorResponse(res, 404, 'Payment mode not found');
        }
        
        return success(res, 200, 'Payment mode deleted successfully');
    } catch (error) {
        if (error.code === '23503') {
            return errorResponse(res, 400, 'Cannot delete payment mode as it is referenced in transactions');
        }
        console.error('Error in deletePaymentMode:', error);
        return errorResponse(res, 500, 'Internal server error');
    }
};

module.exports = {
    listPaymentModes,
    getPaymentMode,
    createPaymentMode,
    updatePaymentMode,
    deletePaymentMode
};
