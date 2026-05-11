/**
 * Fees Type Controller
 *
 * fees_types is a global master table (no academic_year_id).
 * Columns: id, name, code, description, is_active, created_at, updated_at, created_by, updated_by
 */

const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { getAuthContext, isAdmin } = require('../utils/accessControl');

// ─── LIST ─────────────────────────────────────────────────────────────────────
const getFeesTypes = async (req, res) => {
    try {
        const { include_inactive } = req.query;

        const whereClause = include_inactive === 'true' ? '' : 'WHERE ft.is_active = true';

        const result = await query(`
            SELECT
                ft.*,
                -- How many fee configurations use this type
                COUNT(DISTINCT fct.id) AS usage_count
            FROM fees_types ft
            LEFT JOIN fees_class_types fct ON fct.fee_type_id = ft.id
            ${whereClause}
            GROUP BY ft.id
            ORDER BY ft.name ASC
        `);

        return success(res, 200, 'Fee types retrieved successfully', result.rows);
    } catch (error) {
        console.error('Error in getFeesTypes:', error);
        return errorResponse(res, 500, error.message || 'Internal server error');
    }
};

// ─── CREATE ───────────────────────────────────────────────────────────────────
const createFeesType = async (req, res) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) {
            return errorResponse(res, 403, 'Access denied');
        }

        const { name, code, description, is_active } = req.body;
        if (!name) {
            return errorResponse(res, 400, 'Name is required');
        }

        const createdBy = req.user?.id || null;

        const result = await query(
            `INSERT INTO fees_types (name, code, description, is_active, created_by)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [name, code || null, description || null, is_active !== false, createdBy]
        );

        return success(res, 201, 'Fee type created successfully', result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return errorResponse(res, 409, 'A fee type with this name or code already exists');
        }
        console.error('Error in createFeesType:', error);
        return errorResponse(res, 500, error.message || 'Internal server error');
    }
};

// ─── UPDATE ───────────────────────────────────────────────────────────────────
const updateFeesType = async (req, res) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) {
            return errorResponse(res, 403, 'Access denied');
        }

        const { id } = req.params;
        const { name, code, description, is_active } = req.body;

        const updatedBy = req.user?.id || null;

        const result = await query(
            `UPDATE fees_types SET
                name = COALESCE($1, name),
                code = COALESCE($2, code),
                description = COALESCE($3, description),
                is_active = COALESCE($4, is_active),
                updated_at = NOW(),
                updated_by = $5
             WHERE id = $6
             RETURNING *`,
            [name || null, code || null, description || null,
             is_active != null ? is_active : null, updatedBy, id]
        );

        if (result.rowCount === 0) {
            return errorResponse(res, 404, 'Fee type not found');
        }

        return success(res, 200, 'Fee type updated successfully', result.rows[0]);
    } catch (error) {
        console.error('Error in updateFeesType:', error);
        return errorResponse(res, 500, error.message || 'Internal server error');
    }
};

// ─── DELETE ───────────────────────────────────────────────────────────────────
const deleteFeesType = async (req, res) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) {
            return errorResponse(res, 403, 'Access denied');
        }

        const { id } = req.params;

        // Block if type is used in any fee configuration
        const usageCheck = await query(
            'SELECT 1 FROM fees_class_types WHERE fee_type_id = $1 LIMIT 1',
            [id]
        );
        if (usageCheck.rowCount > 0) {
            return errorResponse(res, 400, 'Cannot delete a fee type that is used in fee configurations');
        }

        const result = await query('DELETE FROM fees_types WHERE id = $1 RETURNING *', [id]);

        if (result.rowCount === 0) {
            return errorResponse(res, 404, 'Fee type not found');
        }

        return success(res, 200, 'Fee type deleted successfully');
    } catch (error) {
        console.error('Error in deleteFeesType:', error);
        return errorResponse(res, 500, error.message || 'Internal server error');
    }
};

module.exports = {
    getFeesTypes,
    createFeesType,
    updateFeesType,
    deleteFeesType
};
