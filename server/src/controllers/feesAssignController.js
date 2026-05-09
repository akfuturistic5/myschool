/**
 * Fees Assign Controller
 *
 * In the new schema, "assigning fees" means creating/managing the
 * fees_paids record for each student — the per-student ledger entry.
 *
 * fees_paids → one row per student per academic year (their fee summary)
 *
 * When a student is assigned fees, we:
 * 1. Look up the fee config (fees + fees_class_types) for their class & year
 * 2. Create (or update) their fees_paids row with total_payable
 */

const { query, executeTransaction } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { getAuthContext, isAdmin } = require('../utils/accessControl');

// ─── ASSIGN FEES TO STUDENTS ──────────────────────────────────────────────────
// Body: { student_ids: [1,2,3], academic_year_id: 1 }
// Looks up each student's current class from the lifecycle ledger,
// finds the fee config for that class+year, and upserts fees_paids.
const assignFees = async (req, res) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) {
            return errorResponse(res, 403, 'Access denied');
        }

        const { student_ids, academic_year_id } = req.body;
        if (!Array.isArray(student_ids) || student_ids.length === 0 || !academic_year_id) {
            return errorResponse(res, 400, 'student_ids (array) and academic_year_id are required');
        }

        const createdBy = req.user?.id || null;

        const result = await executeTransaction(async (client) => {
            const assigned = [];
            const skipped = [];

            for (const studentId of student_ids) {
                // 1. Get student's current class for this academic year via lifecycle ledger
                const enrollmentResult = await client.query(
                    `SELECT sll.to_class_id AS class_id
                     FROM student_lifecycle_ledger sll
                     WHERE sll.student_id = $1
                       AND sll.to_academic_year_id = $2
                       AND sll.event_type IN ('ADMISSION', 'PROMOTE', 'REJOIN')
                     ORDER BY sll.id DESC
                     LIMIT 1`,
                    [studentId, academic_year_id]
                );

                if (enrollmentResult.rowCount === 0) {
                    skipped.push({ studentId, reason: 'No enrollment found for this academic year' });
                    continue;
                }

                const { class_id } = enrollmentResult.rows[0];

                // 2. Find the fee configuration for this class + year
                const feeConfig = await client.query(
                    `SELECT f.id AS fee_id,
                            COALESCE(SUM(fct.amount) FILTER (WHERE fct.is_optional = false), 0) AS total_compulsory
                     FROM fees f
                     LEFT JOIN fees_class_types fct ON fct.fee_id = f.id
                         AND fct.class_id = f.class_id
                         AND fct.academic_year_id = f.academic_year_id
                     WHERE f.class_id = $1
                       AND f.academic_year_id = $2
                       AND f.deleted_at IS NULL
                     GROUP BY f.id`,
                    [class_id, academic_year_id]
                );

                if (feeConfig.rowCount === 0) {
                    skipped.push({ studentId, reason: `No fee configuration found for class ${class_id}` });
                    continue;
                }

                const { total_compulsory } = feeConfig.rows[0];
                const totalPayable = parseFloat(total_compulsory);

                // 3. Upsert the student's fees_paids ledger row
                const upsertResult = await client.query(
                    `INSERT INTO fees_paids
                        (student_id, class_id, academic_year_id, total_payable,
                         total_paid, balance_amount, status, created_by)
                     VALUES ($1, $2, $3, $4, 0, $4, 'pending', $5)
                     ON CONFLICT (student_id, academic_year_id)
                     DO UPDATE SET
                         total_payable = EXCLUDED.total_payable,
                         balance_amount = EXCLUDED.total_payable - fees_paids.total_paid,
                         status = CASE
                             WHEN fees_paids.total_paid >= EXCLUDED.total_payable THEN 'paid'
                             WHEN fees_paids.total_paid > 0 THEN 'partial'
                             ELSE 'pending'
                         END,
                         updated_at = NOW()
                     RETURNING *`,
                    [studentId, class_id, academic_year_id, totalPayable, createdBy]
                );

                assigned.push(upsertResult.rows[0]);
            }

            return { assigned, skipped };
        });

        return success(res, 200,
            `Fees assigned to ${result.assigned.length} student(s). ${result.skipped.length} skipped.`,
            result
        );
    } catch (error) {
        console.error('Error in assignFees:', error);
        return errorResponse(res, 500, error.message || 'Internal server error');
    }
};

// ─── LIST ASSIGNMENTS ─────────────────────────────────────────────────────────
// Returns all fees_paids rows for a given academic year with student details.
const getFeesAssignments = async (req, res) => {
    try {
        const { academic_year_id, class_id, status } = req.query;

        if (!academic_year_id) {
            return errorResponse(res, 400, 'academic_year_id is required');
        }

        let whereClause = 'WHERE fp.academic_year_id = $1';
        const params = [academic_year_id];

        if (class_id && class_id !== 'All') {
            whereClause += ` AND fp.class_id = $${params.length + 1}`;
            params.push(parseInt(class_id, 10));
        }

        if (status && status !== 'All') {
            whereClause += ` AND fp.status = $${params.length + 1}`;
            params.push(status.toLowerCase());
        }

        const result = await query(
            `SELECT
                fp.*,
                u.first_name || ' ' || COALESCE(u.last_name, '') AS student_name,
                u.avatar AS student_image,
                s.admission_number,
                c.class_name,
                -- Section from lifecycle ledger
                (
                    SELECT sec.section_name
                    FROM student_lifecycle_ledger sll
                    LEFT JOIN sections sec ON sll.to_section_id = sec.id
                    WHERE sll.student_id = fp.student_id
                      AND sll.to_academic_year_id = fp.academic_year_id
                      AND sll.event_type IN ('ADMISSION', 'PROMOTE', 'REJOIN')
                    ORDER BY sll.id DESC LIMIT 1
                ) AS section_name,
                u.gender,
                COALESCE(cast_t.cast_name, '-') AS category
             FROM fees_paids fp
             JOIN students s ON fp.student_id = s.id
             JOIN users u ON s.user_id = u.id
             JOIN classes c ON fp.class_id = c.id
             LEFT JOIN casts cast_t ON s.cast_id = cast_t.id
             ${whereClause}
             ORDER BY c.class_name ASC, u.first_name ASC`,
            params
        );

        return success(res, 200, 'Fee assignments retrieved successfully', result.rows);
    } catch (error) {
        console.error('Error in getFeesAssignments:', error);
        return errorResponse(res, 500, error.message || 'Internal server error');
    }
};

// ─── DELETE ASSIGNMENT ────────────────────────────────────────────────────────
const deleteFeesAssignment = async (req, res) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) {
            return errorResponse(res, 403, 'Access denied');
        }

        const { id } = req.params;

        // Block if any payments have been made
        const paymentCheck = await query(
            `SELECT 1 FROM fees_paids WHERE id = $1 AND total_paid > 0 LIMIT 1`,
            [id]
        );
        if (paymentCheck.rowCount > 0) {
            return errorResponse(res, 400, 'Cannot delete a fee assignment with payment history');
        }

        const result = await query(
            'DELETE FROM fees_paids WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rowCount === 0) {
            return errorResponse(res, 404, 'Fee assignment not found');
        }

        return success(res, 200, 'Fee assignment deleted successfully');
    } catch (error) {
        console.error('Error in deleteFeesAssignment:', error);
        return errorResponse(res, 500, error.message || 'Internal server error');
    }
};

module.exports = {
    assignFees,
    getFeesAssignments,
    deleteFeesAssignment
};
