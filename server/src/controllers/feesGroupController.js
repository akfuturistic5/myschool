/**
 * Fees Group Controller
 *
 * In the new schema, a "fee group" maps to the `fees` table:
 * one fee configuration per class per academic year.
 *
 * fees            → the header (class + year + late fee config)
 * fees_class_types → the line items (fee_type_id + amount per fee header)
 * fees_types      → global master of fee type names (Tuition, Library, etc.)
 */

const { query, executeTransaction } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { getAuthContext, isAdmin } = require('../utils/accessControl');

// ─── AUTO-ASSIGN HELPER ───────────────────────────────────────────────────────
// Called inside a transaction after creating/updating a fee config.
// Looks up all actively enrolled students for the class+year and upserts
// a fees_paids ledger row for each one (skip if already paid anything).
const autoAssignFeesToStudents = async (client, feeId, classId, academicYearId) => {
    // Total compulsory amount for this fee config
    const amtRes = await client.query(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM fees_class_types
         WHERE fee_id = $1 AND is_optional = false`,
        [feeId]
    );
    const totalPayable = parseFloat(amtRes.rows[0].total) || 0;

    // All students currently enrolled in this class for this academic year
    const studentsRes = await client.query(
        `SELECT DISTINCT student_id
         FROM student_lifecycle_ledger
         WHERE to_class_id = $1
           AND to_academic_year_id = $2
           AND event_type IN ('ADMISSION', 'PROMOTE', 'DETAIN', 'REJOIN')`,
        [classId, academicYearId]
    );

    let assigned = 0;
    for (const row of studentsRes.rows) {
        // Upsert: only set total_payable if no payments recorded yet
        await client.query(
            `INSERT INTO fees_paids
                 (student_id, class_id, academic_year_id, total_payable, total_paid, balance_amount)
             VALUES ($1, $2, $3, $4, 0, $4)
             ON CONFLICT (student_id, academic_year_id)
             DO UPDATE SET
                 total_payable  = EXCLUDED.total_payable,
                 balance_amount = EXCLUDED.total_payable - fees_paids.total_paid,
                 updated_at     = NOW()
             WHERE fees_paids.total_paid = 0`,
            [row.student_id, classId, academicYearId, totalPayable]
        );
        assigned++;
    }
    return assigned;
};

// ─── LIST ────────────────────────────────────────────────────────────────────
// Returns all fee configurations for a given academic year,
// with their line-item details aggregated.
const getFeesGroups = async (req, res) => {
    try {
        const { academic_year_id } = req.query;
        if (!academic_year_id) {
            return errorResponse(res, 400, 'academic_year_id is required');
        }

        const result = await query(
            `SELECT
                f.id,
                f.class_id,
                c.class_name,
                f.academic_year_id,
                f.due_date,
                f.late_fee_type,
                f.late_fee_charge,
                f.late_fee_frequency,
                f.description,
                f.created_at,
                f.updated_at,
                -- Aggregate the line items
                COALESCE(
                    JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'id', fct.id,
                            'fee_type_id', fct.fee_type_id,
                            'fee_type_name', ft.name,
                            'fee_type_code', ft.code,
                            'amount', fct.amount,
                            'is_optional', fct.is_optional
                        )
                        ORDER BY ft.name
                    ) FILTER (WHERE fct.id IS NOT NULL),
                    '[]'
                ) AS fee_items,
                COALESCE(SUM(fct.amount) FILTER (WHERE fct.is_optional = false), 0) AS total_compulsory,
                COALESCE(SUM(fct.amount) FILTER (WHERE fct.is_optional = true), 0) AS total_optional,
                COALESCE(SUM(fct.amount), 0) AS total_amount
             FROM fees f
             JOIN classes c ON f.class_id = c.id
             LEFT JOIN fees_class_types fct ON fct.fee_id = f.id
                 AND fct.class_id = f.class_id
                 AND fct.academic_year_id = f.academic_year_id
             LEFT JOIN fees_types ft ON fct.fee_type_id = ft.id
             WHERE f.academic_year_id = $1
               AND f.deleted_at IS NULL
             GROUP BY f.id, c.class_name
             ORDER BY c.class_name ASC`,
            [academic_year_id]
        );

        return success(res, 200, 'Fee configurations retrieved successfully', result.rows);
    } catch (error) {
        console.error('Error in getFeesGroups:', error);
        return errorResponse(res, 500, error.message || 'Internal server error');
    }
};

// ─── GET SINGLE ──────────────────────────────────────────────────────────────
const getFeesGroupById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `SELECT
                f.*,
                c.class_name,
                COALESCE(
                    JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'id', fct.id,
                            'fee_type_id', fct.fee_type_id,
                            'fee_type_name', ft.name,
                            'fee_type_code', ft.code,
                            'amount', fct.amount,
                            'is_optional', fct.is_optional
                        )
                        ORDER BY ft.name
                    ) FILTER (WHERE fct.id IS NOT NULL),
                    '[]'
                ) AS fee_items
             FROM fees f
             JOIN classes c ON f.class_id = c.id
             LEFT JOIN fees_class_types fct ON fct.fee_id = f.id
                 AND fct.class_id = f.class_id
                 AND fct.academic_year_id = f.academic_year_id
             LEFT JOIN fees_types ft ON fct.fee_type_id = ft.id
             WHERE f.id = $1 AND f.deleted_at IS NULL
             GROUP BY f.id, c.class_name`,
            [id]
        );

        if (result.rowCount === 0) {
            return errorResponse(res, 404, 'Fee configuration not found');
        }

        return success(res, 200, 'Fee configuration retrieved successfully', result.rows[0]);
    } catch (error) {
        console.error('Error in getFeesGroupById:', error);
        return errorResponse(res, 500, error.message || 'Internal server error');
    }
};

// ─── CREATE ───────────────────────────────────────────────────────────────────
// Creates a fee header (fees) and its line items (fees_class_types) atomically.
// Body: { class_id, academic_year_id, due_date?, late_fee_type?, late_fee_charge?,
//         late_fee_frequency?, description?, fee_items: [{ fee_type_id, amount, is_optional? }] }
const createFeesGroup = async (req, res) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) {
            return errorResponse(res, 403, 'Access denied');
        }

        const {
            class_id,
            academic_year_id,
            due_date,
            late_fee_type,
            late_fee_charge,
            late_fee_frequency,
            description,
            fee_items // Array of { fee_type_id, amount, is_optional }
        } = req.body;

        if (!class_id || !academic_year_id) {
            return errorResponse(res, 400, 'class_id and academic_year_id are required');
        }

        const createdBy = req.user?.id || null;

        const result = await executeTransaction(async (client) => {
            // 1. Insert the fee header
            const feeHeader = await client.query(
                `INSERT INTO fees
                    (class_id, academic_year_id, due_date, late_fee_type,
                     late_fee_charge, late_fee_frequency, description, created_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING *`,
                [
                    class_id,
                    academic_year_id,
                    due_date || null,
                    late_fee_type || 'fixed',
                    late_fee_charge || 0,
                    late_fee_frequency || 'once',
                    description || null,
                    createdBy
                ]
            );

            const fee = feeHeader.rows[0];

            // 2. Insert line items if provided
            const insertedItems = [];
            if (Array.isArray(fee_items) && fee_items.length > 0) {
                for (const item of fee_items) {
                    if (!item.fee_type_id || item.amount == null) continue;
                    if (parseFloat(item.amount) < 0) {
                        throw Object.assign(new Error('Fee amount cannot be negative'), { statusCode: 400 });
                    }

                    const itemResult = await client.query(
                        `INSERT INTO fees_class_types
                            (fee_id, class_id, academic_year_id, fee_type_id, amount, is_optional, created_by)
                         VALUES ($1, $2, $3, $4, $5, $6, $7)
                         RETURNING *`,
                        [
                            fee.id,
                            fee.class_id,
                            fee.academic_year_id,
                            item.fee_type_id,
                            parseFloat(item.amount),
                            item.is_optional ?? false,
                            createdBy
                        ]
                    );
                    insertedItems.push(itemResult.rows[0]);
                }
            }

            // 3. Auto-assign to all enrolled students in this class
            const assignedCount = await autoAssignFeesToStudents(
                client, fee.id, fee.class_id, fee.academic_year_id
            );

            return { ...fee, fee_items: insertedItems, auto_assigned_count: assignedCount };
        });

        return success(res, 201, 'Fee configuration created successfully', result);
    } catch (error) {
        if (error.code === '23505') {
            return errorResponse(res, 409, 'A fee configuration already exists for this class and academic year');
        }
        if (error.statusCode === 400) {
            return errorResponse(res, 400, error.message);
        }
        console.error('Error in createFeesGroup:', error);
        return errorResponse(res, 500, error.message || 'Internal server error');
    }
};

// ─── UPDATE ───────────────────────────────────────────────────────────────────
// Updates the fee header and replaces all line items atomically.
const updateFeesGroup = async (req, res) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) {
            return errorResponse(res, 403, 'Access denied');
        }

        const { id } = req.params;
        const {
            due_date,
            late_fee_type,
            late_fee_charge,
            late_fee_frequency,
            description,
            fee_items
        } = req.body;

        const updatedBy = req.user?.id || null;

        const result = await executeTransaction(async (client) => {
            // 1. Update header
            const feeHeader = await client.query(
                `UPDATE fees SET
                    due_date = COALESCE($1, due_date),
                    late_fee_type = COALESCE($2, late_fee_type),
                    late_fee_charge = COALESCE($3, late_fee_charge),
                    late_fee_frequency = COALESCE($4, late_fee_frequency),
                    description = COALESCE($5, description),
                    updated_at = NOW(),
                    updated_by = $6
                 WHERE id = $7 AND deleted_at IS NULL
                 RETURNING *`,
                [
                    due_date || null,
                    late_fee_type || null,
                    late_fee_charge ?? null,
                    late_fee_frequency || null,
                    description || null,
                    updatedBy,
                    id
                ]
            );

            if (feeHeader.rowCount === 0) {
                throw Object.assign(new Error('Fee configuration not found'), { statusCode: 404 });
            }

            const fee = feeHeader.rows[0];

            // 2. If fee_items provided, delete existing lines and re-insert
            let insertedItems = [];
            if (Array.isArray(fee_items)) {
                await client.query(
                    'DELETE FROM fees_class_types WHERE fee_id = $1',
                    [fee.id]
                );

                for (const item of fee_items) {
                    if (!item.fee_type_id || item.amount == null) continue;
                    if (parseFloat(item.amount) < 0) {
                        throw Object.assign(new Error('Fee amount cannot be negative'), { statusCode: 400 });
                    }

                    const itemResult = await client.query(
                        `INSERT INTO fees_class_types
                            (fee_id, class_id, academic_year_id, fee_type_id, amount, is_optional, updated_by)
                         VALUES ($1, $2, $3, $4, $5, $6, $7)
                         RETURNING *`,
                        [
                            fee.id,
                            fee.class_id,
                            fee.academic_year_id,
                            item.fee_type_id,
                            parseFloat(item.amount),
                            item.is_optional ?? false,
                            updatedBy
                        ]
                    );
                    insertedItems.push(itemResult.rows[0]);
                }
            }

            // 3. Re-sync fees_paids for all enrolled students
            //    (safe — only updates rows with zero payments)
            const assignedCount = await autoAssignFeesToStudents(
                client, fee.id, fee.class_id, fee.academic_year_id
            );

            return { ...fee, fee_items: insertedItems, auto_assigned_count: assignedCount };
        });

        return success(res, 200, 'Fee configuration updated successfully', result);
    } catch (error) {
        if (error.statusCode === 404) return errorResponse(res, 404, error.message);
        if (error.statusCode === 400) return errorResponse(res, 400, error.message);
        console.error('Error in updateFeesGroup:', error);
        return errorResponse(res, 500, error.message || 'Internal server error');
    }
};

// ─── DELETE ───────────────────────────────────────────────────────────────────
// Soft-deletes the fee header. Blocks if student payments exist.
const deleteFeesGroup = async (req, res) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) {
            return errorResponse(res, 403, 'Access denied');
        }

        const { id } = req.params;

        // Check if any student has paid against this fee configuration
        const paymentCheck = await query(
            `SELECT 1 FROM compulsory_fees WHERE fee_id = $1 LIMIT 1`,
            [id]
        );
        if (paymentCheck.rowCount > 0) {
            return errorResponse(res, 400, 'Cannot delete a fee configuration that has payment records. Deactivate it instead.');
        }

        const result = await query(
            `UPDATE fees SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
            [id]
        );

        if (result.rowCount === 0) {
            return errorResponse(res, 404, 'Fee configuration not found');
        }

        return success(res, 200, 'Fee configuration deleted successfully');
    } catch (error) {
        console.error('Error in deleteFeesGroup:', error);
        return errorResponse(res, 500, error.message || 'Internal server error');
    }
};

module.exports = {
    getFeesGroups,
    getFeesGroupById,
    createFeesGroup,
    updateFeesGroup,
    deleteFeesGroup,
    autoAssignFeesToStudents
};
