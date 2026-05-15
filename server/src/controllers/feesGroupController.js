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

// Dedupe payload by fee_type_id (first occurrence wins). Empty array allowed for brand-new header + no lines.
const normalizeFeeItemsPayload = (fee_items) => {
    if (!Array.isArray(fee_items) || fee_items.length === 0) {
        return [];
    }
    const seen = new Set();
    const out = [];
    for (const item of fee_items) {
        if (item == null || item.fee_type_id == null || item.amount == null) continue;
        const ftId =
            typeof item.fee_type_id === 'number' ? item.fee_type_id : parseInt(item.fee_type_id, 10);
        const amt = parseFloat(item.amount);
        if (!Number.isInteger(ftId) || ftId < 1) continue;
        if (Number.isNaN(amt) || amt < 0) {
            throw Object.assign(new Error('Fee amount cannot be negative'), { statusCode: 400 });
        }
        if (seen.has(ftId)) continue;
        seen.add(ftId);
        out.push({
            fee_type_id: ftId,
            amount: amt,
            is_optional: item.is_optional ?? false,
        });
    }
    return out;
};

// Append fee types to an existing fees header (same class + year). Skips types already on that config.
const mergeFeeLineItemsIntoExistingFee = async (client, fee, normalizedItems, createdBy) => {
    if (!normalizedItems.length) {
        throw Object.assign(
            new Error(
                'Add at least one fee item with a type and amount to attach to this class configuration.'
            ),
            { statusCode: 400 }
        );
    }

    const existingTypesRes = await client.query(
        `SELECT fee_type_id FROM fees_class_types
         WHERE fee_id = $1 AND class_id = $2 AND academic_year_id = $3`,
        [fee.id, fee.class_id, fee.academic_year_id]
    );
    const taken = new Set(existingTypesRes.rows.map((r) => r.fee_type_id));

    const insertedRows = [];
    let skippedDuplicateType = 0;
    for (const item of normalizedItems) {
        if (taken.has(item.fee_type_id)) {
            skippedDuplicateType += 1;
            continue;
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
                item.amount,
                item.is_optional ?? false,
                createdBy,
            ]
        );
        insertedRows.push(itemResult.rows[0]);
        taken.add(item.fee_type_id);
    }

    const assignedCount = await autoAssignFeesToStudents(
        client,
        fee.id,
        fee.class_id,
        fee.academic_year_id
    );

    const allLinesRes = await client.query(
        `SELECT fct.id,
                fct.fee_type_id,
                fct.amount,
                fct.is_optional,
                ft.name AS fee_type_name,
                ft.code AS fee_type_code
         FROM fees_class_types fct
         JOIN fees_types ft ON fct.fee_type_id = ft.id
         WHERE fct.fee_id = $1 AND fct.class_id = $2 AND fct.academic_year_id = $3
         ORDER BY ft.name ASC`,
        [fee.id, fee.class_id, fee.academic_year_id]
    );

    return {
        ...fee,
        fee_items: allLinesRes.rows.map((r) => ({
            id: r.id,
            fee_type_id: r.fee_type_id,
            fee_type_name: r.fee_type_name,
            fee_type_code: r.fee_type_code,
            amount: r.amount,
            is_optional: r.is_optional,
        })),
        auto_assigned_count: assignedCount,
        mode: 'merged',
        merge: true,
        lines_added: insertedRows.length,
        lines_skipped_duplicate_type: skippedDuplicateType,
    };
};

// Insert one fees header + line items inside an open transaction client.
const createFeeConfigWithClient = async (
    client,
    {
        class_id,
        academic_year_id,
        due_date,
        late_fee_type,
        late_fee_charge,
        late_fee_frequency,
        description,
        fee_items,
        createdBy
    }
) => {
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

    const assignedCount = await autoAssignFeesToStudents(
        client, fee.id, fee.class_id, fee.academic_year_id
    );

    return {
        ...fee,
        fee_items: insertedItems,
        auto_assigned_count: assignedCount,
        mode: 'created',
        merge: false,
        lines_added: insertedItems.length,
        lines_skipped_duplicate_type: 0,
    };
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
// Creates fee header(s) (fees) + line items (fees_class_types) per selected class.
// Body supports:
//   - Legacy: class_id + academic_year_id
//   - Multi: class_ids: number[] OR apply_to_all_classes: true (+ academic_year_id)
// NOTE: class_id is INTEGER FK to classes; multi-class is modeled as one fee config per class
// (multiple rows), not a CSV/string in fees_class_types.class_id — that would violate the schema.
const createFeesGroup = async (req, res) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) {
            return errorResponse(res, 403, 'Access denied');
        }

        const {
            class_id,
            class_ids,
            apply_to_all_classes,
            academic_year_id,
            due_date,
            late_fee_type,
            late_fee_charge,
            late_fee_frequency,
            description,
            fee_items
        } = req.body;

        if (!academic_year_id) {
            return errorResponse(res, 400, 'academic_year_id is required');
        }

        const applyAll =
            apply_to_all_classes === true ||
            apply_to_all_classes === 'true' ||
            apply_to_all_classes === 1 ||
            apply_to_all_classes === '1';

        let targetClassIds = [];

        if (applyAll) {
            const clsRes = await query(
                `SELECT id FROM classes
                 WHERE deleted_at IS NULL AND COALESCE(is_active, true) = true
                 ORDER BY class_name ASC`
            );
            targetClassIds = clsRes.rows.map((row) => row.id);
            if (targetClassIds.length === 0) {
                return errorResponse(res, 400, 'No active classes are available.');
            }
        } else if (Array.isArray(class_ids) && class_ids.length > 0) {
            const seen = new Set();
            for (const raw of class_ids) {
                const n = typeof raw === 'number' ? raw : parseInt(raw, 10);
                if (Number.isInteger(n) && n > 0 && !seen.has(n)) {
                    seen.add(n);
                    targetClassIds.push(n);
                }
            }
        } else if (class_id != null && class_id !== '') {
            const n = typeof class_id === 'number' ? class_id : parseInt(class_id, 10);
            if (Number.isInteger(n) && n > 0) {
                targetClassIds = [n];
            }
        }

        if (targetClassIds.length === 0) {
            return errorResponse(
                res,
                400,
                'Select at least one class, pass class_ids, or set apply_to_all_classes.'
            );
        }

        const MAX_CLASSES = 200;
        if (targetClassIds.length > MAX_CLASSES) {
            return errorResponse(res, 400, `At most ${MAX_CLASSES} classes can be created in one request.`);
        }

        const chk = await query(
            `SELECT id FROM classes WHERE deleted_at IS NULL AND id = ANY($1::int[])`,
            [targetClassIds]
        );
        if (chk.rows.length !== targetClassIds.length) {
            const ok = new Set(chk.rows.map((r) => r.id));
            const missing = targetClassIds.filter((id) => !ok.has(id));
            return errorResponse(res, 400, `Invalid or inactive class id(s): ${missing.join(', ')}`);
        }

        let itemsNorm;
        try {
            itemsNorm = normalizeFeeItemsPayload(fee_items);
        } catch (normErr) {
            if (normErr.statusCode === 400) {
                return errorResponse(res, 400, normErr.message);
            }
            throw normErr;
        }

        const createdBy = req.user?.id || null;

        const baseArgs = {
            academic_year_id,
            due_date,
            late_fee_type,
            late_fee_charge,
            late_fee_frequency,
            description,
            fee_items: itemsNorm,
            createdBy
        };

        const runOne = async (cid) =>
            executeTransaction(async (client) => {
                const existingRes = await client.query(
                    `SELECT * FROM fees
                     WHERE class_id = $1 AND academic_year_id = $2 AND deleted_at IS NULL
                     LIMIT 1
                     FOR UPDATE`,
                    [cid, academic_year_id]
                );
                if (existingRes.rowCount > 0) {
                    return mergeFeeLineItemsIntoExistingFee(
                        client,
                        existingRes.rows[0],
                        itemsNorm,
                        createdBy
                    );
                }
                return createFeeConfigWithClient(client, { ...baseArgs, class_id: cid });
            });

        // Single-class: 201=new header; 200=extended existing (added or duplicate types skipped)
        if (targetClassIds.length === 1) {
            const result = await runOne(targetClassIds[0]);
            const merged = result.mode === 'merged';
            const http = merged ? 200 : 201;
            let message = merged
                ? result.lines_added > 0
                    ? result.lines_skipped_duplicate_type > 0
                        ? `Added ${result.lines_added} fee type(s); ${result.lines_skipped_duplicate_type} type(s) were already configured for this class.`
                        : `Added ${result.lines_added} fee type(s) to the existing fee configuration for this class.`
                    : 'All selected fee types are already configured for this class.'
                : 'Fee configuration created successfully';
            return success(res, http, message, result);
        }

        const results = [];
        const skippedRace = []; // duplicate header insert (rare concurrency)
        const failed = [];

        /* eslint-disable no-await-in-loop */
        for (const cid of targetClassIds) {
            try {
                const row = await runOne(cid);
                results.push({ class_id: cid, ...row });
            } catch (err) {
                if (err.code === '23505') {
                    skippedRace.push({
                        class_id: cid,
                        reason: 'Concurrent create conflict; retry if needed.'
                    });
                } else if (err.statusCode === 400) {
                    failed.push({ class_id: cid, message: err.message });
                } else {
                    failed.push({
                        class_id: cid,
                        message: err.message || 'Unexpected error creating fee configuration.'
                    });
                }
            }
        }
        /* eslint-enable no-await-in-loop */

        if (results.length === 0) {
            if (skippedRace.length === targetClassIds.length) {
                return errorResponse(
                    res,
                    409,
                    'Could not update fee configurations due to concurrent changes. Refresh and try again.'
                );
            }
            return errorResponse(
                res,
                500,
                failed.map((f) => `Class ${f.class_id}: ${f.message}`).join(' ')
            );
        }

        const newHeaders = results.filter((r) => r.mode === 'created').length;
        const mergedCfgs = results.filter((r) => r.mode === 'merged').length;
        const linesAdded = results.reduce((s, r) => s + (r.lines_added || 0), 0);
        const typesSkippedDup = results.reduce((s, r) => s + (r.lines_skipped_duplicate_type || 0), 0);

        const msgParts = [`Processed ${results.length} class(es): ${newHeaders} new fee config(s), ${mergedCfgs} existing updated.`];
        if (linesAdded) msgParts.push(`${linesAdded} new fee line(s) added.`);
        if (typesSkippedDup) msgParts.push(`${typesSkippedDup} type(s) skipped (already on that class).`);

        return success(res, 200, msgParts.join(' '), {
            results,
            skippedRace,
            failed,
            summary: {
                requested: targetClassIds.length,
                succeeded_count: results.length,
                new_fee_headers: newHeaders,
                merged_existing: mergedCfgs,
                lines_added: linesAdded,
                duplicate_types_skipped: typesSkippedDup,
                skipped_race_count: skippedRace.length,
                failed_count: failed.length,
            },
            resolved_class_ids: targetClassIds
        });
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
// Removes line items & installments from DB, then soft-deletes the fee header.
// (Soft-delete on `fees` alone left orphan rows in `fees_class_types`; CASCADE only runs on hard DELETE.)
// Blocks when any compulsory or optional payments reference this configuration.
const deleteFeesGroup = async (req, res) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) {
            return errorResponse(res, 403, 'Access denied');
        }

        const { id } = req.params;
        const feeId = parseInt(id, 10);
        if (!Number.isInteger(feeId) || feeId < 1) {
            return errorResponse(res, 400, 'Invalid fee configuration id');
        }

        const paymentCheck = await query(
            `SELECT (
                EXISTS (SELECT 1 FROM compulsory_fees WHERE fee_id = $1)
                OR EXISTS (
                    SELECT 1 FROM compulsory_fees cf
                    INNER JOIN fees_installments fi ON cf.fee_installment_id = fi.id
                    WHERE fi.fee_id = $1
                )
                OR EXISTS (
                    SELECT 1 FROM optional_fees o
                    INNER JOIN fees_class_types fct ON o.fee_class_type_id = fct.id
                    WHERE fct.fee_id = $1
                )
            ) AS blocked`,
            [feeId]
        );
        const blocked = paymentCheck.rows[0]?.blocked === true;
        if (blocked) {
            return errorResponse(
                res,
                400,
                'Cannot delete a fee configuration that has payment records (compulsory or optional). Remove or reconcile payments first.'
            );
        }

        const result = await executeTransaction(async (client) => {
            const head = await client.query(
                'SELECT id FROM fees WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
                [feeId]
            );
            if (head.rowCount === 0) {
                throw Object.assign(new Error('Fee configuration not found'), { statusCode: 404 });
            }

            await client.query('DELETE FROM fees_class_types WHERE fee_id = $1', [feeId]);
            await client.query('DELETE FROM fees_installments WHERE fee_id = $1', [feeId]);

            const soft = await client.query(
                'UPDATE fees SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
                [feeId]
            );
            if (soft.rowCount === 0) {
                throw Object.assign(new Error('Fee configuration not found'), { statusCode: 404 });
            }

            return soft.rows[0];
        });

        return success(res, 200, 'Fee configuration deleted successfully', result);
    } catch (error) {
        if (error.statusCode === 404) {
            return errorResponse(res, 404, error.message);
        }
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
