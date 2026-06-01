/**
 * Fees Collect Controller
 *
 * In the new schema, collecting fees means:
 * 1. Inserting into `compulsory_fees` (or `optional_fees`) — the transaction record
 * 2. Updating `fees_paids` — the student's running ledger
 * 3. Handling `fees_advance` — if the student has credit to apply
 *
 * Receipt numbering: RCPT-{year}-{00001}
 */

const { query, getClient, executeTransaction } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { getAuthContext, isAdmin } = require('../utils/accessControl');

/** Sum of all configured fee line items for class+year (matches Student Fees breakdown). */
const getLiveClassFeeTotalSql = `
    SELECT COALESCE(SUM(fct.amount), 0) AS live_total
    FROM fees f
    JOIN fees_class_types fct ON fct.fee_id = f.id
        AND fct.class_id = f.class_id
        AND fct.academic_year_id = f.academic_year_id
    WHERE f.class_id = $1 AND f.academic_year_id = $2 AND f.deleted_at IS NULL`;

const fetchLiveClassFeeTotal = async (db, classId, academicYearId) => {
    const res = await db.query(getLiveClassFeeTotalSql, [classId, academicYearId]);
    return parseFloat(res.rows[0]?.live_total || 0);
};

// ─── RECEIPT NUMBER ───────────────────────────────────────────────────────────
const generateReceiptNo = async (academicYearId, client) => {
    const yearResult = await client.query(
        'SELECT year_name FROM academic_years WHERE id = $1', [academicYearId]
    );
    if (yearResult.rowCount === 0) throw new Error('Invalid academic year');

    const yearLabel = yearResult.rows[0].year_name.split('-')[0]; // e.g. "2024"

    // Count existing compulsory_fees records for this year to determine increment
    const countResult = await client.query(
        `SELECT COUNT(*) AS cnt FROM compulsory_fees WHERE academic_year_id = $1`,
        [academicYearId]
    );
    const increment = parseInt(countResult.rows[0].cnt, 10) + 1;
    return `RCPT-${yearLabel}-${String(increment).padStart(5, '0')}`;
};

// ─── COLLECT FEES ─────────────────────────────────────────────────────────────
// Body: {
//   student_id, academic_year_id, payment_date?, payment_mode?, remarks?,
//   payments: [
//     { fee_id?, fee_installment_id?, amount_paid, fine_paid? }
//   ],
//   advance_amount_used?: 0   // pull from fees_advance credit bucket
// }
const collectFees = async (req, res) => {
    const client = await getClient();
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) {
            client.release();
            return errorResponse(res, 403, 'Access denied');
        }

        const {
            student_id,
            academic_year_id,
            payment_date,
            payment_mode,
            remarks,
            payments,
            fee_items,
            advance_amount_used
        } = req.body;

        const effectivePayments = payments || fee_items;

        if (!student_id || !academic_year_id || !Array.isArray(effectivePayments) || effectivePayments.length === 0) {
            client.release();
            return errorResponse(res, 400, 'student_id, academic_year_id and payments[] are required');
        }

        await client.query('BEGIN');

        // 1. Lock the student's ledger row
        const ledgerResult = await client.query(
            `SELECT * FROM fees_paids
             WHERE student_id = $1 AND academic_year_id = $2
             FOR UPDATE`,
            [student_id, academic_year_id]
        );

        if (ledgerResult.rowCount === 0) {
            throw Object.assign(
                new Error('No fee assignment found for this student in this academic year. Please assign fees first.'),
                { statusCode: 400 }
            );
        }

        const ledger = ledgerResult.rows[0];
        let totalNewPayment = 0;
        let totalFinePaid = 0;
        const receiptNo = await generateReceiptNo(academic_year_id, client);
        const createdBy = req.user?.id || null;

        // 2. Insert each payment line into compulsory_fees
        for (const payment of effectivePayments) {
            let { fee_id, fee_installment_id, fees_assign_details_id, amount_paid, amount_to_pay, fine_paid } = payment;
            
            const payAmt = parseFloat(amount_paid || amount_to_pay || 0);
            const fineAmt = parseFloat(fine_paid || 0);

            // If fees_assign_details_id (fct.id) is provided, find parent context
            let db_fee_type_id = null;
            if (fees_assign_details_id) {
                const fctRes = await client.query('SELECT fee_id, fee_type_id FROM fees_class_types WHERE id = $1', [fees_assign_details_id]);
                if (fctRes.rowCount > 0) {
                    if (!fee_id) fee_id = fctRes.rows[0].fee_id;
                    db_fee_type_id = fctRes.rows[0].fee_type_id;
                }
            }

            if (!fee_id && !fee_installment_id) {
                throw Object.assign(
                    new Error('Each payment must reference a fee_id, fee_installment_id, or fees_assign_details_id'),
                    { statusCode: 400 }
                );
            }

            if (payAmt <= 0) {
                throw Object.assign(new Error('Payment amount must be greater than zero'), { statusCode: 400 });
            }

            await client.query(
                `INSERT INTO compulsory_fees
                    (student_id, academic_year_id, fee_id, fee_installment_id, fee_type_id,
                     amount_paid, advance_amount_used, fine_paid,
                     payment_date, payment_mode, transaction_id, remarks, created_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                [
                    student_id,
                    academic_year_id,
                    fee_id || null,
                    fee_installment_id || null,
                    db_fee_type_id || null,
                    payAmt,
                    0, // advance_amount_used handled separately below
                    fineAmt,
                    payment_date || new Date(),
                    payment_mode || 'Cash',
                    receiptNo,
                    remarks || null,
                    createdBy
                ]
            );

            totalNewPayment += payAmt;
            totalFinePaid += fineAmt;
        }

        // 3. Apply advance credit if requested
        const advanceUsed = parseFloat(advance_amount_used || 0);
        if (advanceUsed > 0) {
            const advanceRow = await client.query(
                `SELECT id, amount FROM fees_advance
                 WHERE student_id = $1 AND academic_year_id = $2
                 FOR UPDATE`,
                [student_id, academic_year_id]
            );

            if (advanceRow.rowCount === 0 || parseFloat(advanceRow.rows[0].amount) < advanceUsed) {
                throw Object.assign(
                    new Error('Insufficient advance balance'),
                    { statusCode: 400 }
                );
            }

            await client.query(
                `UPDATE fees_advance SET amount = amount - $1, updated_at = NOW()
                 WHERE id = $2`,
                [advanceUsed, advanceRow.rows[0].id]
            );

            totalNewPayment += advanceUsed;
        }

        // 4. Update fees_paids ledger (balance vs live class fee total, not stale total_payable)
        const liveTotal = await fetchLiveClassFeeTotal(client, ledger.class_id, academic_year_id);
        const newTotalPaid = parseFloat(ledger.total_paid) + totalNewPayment;
        const newBalance = liveTotal - newTotalPaid;
        const newStatus = newBalance <= 0 ? 'paid' : newTotalPaid > 0 ? 'partial' : 'pending';

        await client.query(
            `UPDATE fees_paids SET
                total_paid = $1,
                balance_amount = $2,
                status = $3,
                updated_at = NOW()
             WHERE student_id = $4 AND academic_year_id = $5`,
            [newTotalPaid, Math.max(0, newBalance), newStatus, student_id, academic_year_id]
        );

        await client.query('COMMIT');

        return success(res, 200, 'Payment recorded successfully', {
            receipt_no: receiptNo,
            amount_paid: totalNewPayment,
            fine_paid: totalFinePaid,
            advance_used: advanceUsed,
            new_balance: Math.max(0, newBalance),
            status: newStatus
        });

    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Error in collectFees:', error);
        if (error.statusCode === 400) {
            return errorResponse(res, 400, error.message);
        }
        return errorResponse(res, 500, error.message || 'Internal server error');
    } finally {
        client.release();
    }
};

// ─── MARK AS UNPAID (Reversal) ────────────────────────────────────────────────
// If a payment was marked by mistake, delete the compulsory_fees record
// and revert the fees_paids ledger.
const reversePayment = async (req, res) => {
    const client = await getClient();
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) {
            client.release();
            return errorResponse(res, 403, 'Access denied');
        }

        const { id } = req.params; // compulsory_fees.id

        await client.query('BEGIN');

        // Fetch the payment record
        const paymentResult = await client.query(
            `SELECT * FROM compulsory_fees WHERE id = $1 FOR UPDATE`,
            [id]
        );

        if (paymentResult.rowCount === 0) {
            throw Object.assign(new Error('Payment record not found'), { statusCode: 404 });
        }

        const payment = paymentResult.rows[0];

        // Delete the payment record
        await client.query('DELETE FROM compulsory_fees WHERE id = $1', [id]);

        // Revert the ledger
        const revertAmount = parseFloat(payment.amount_paid) + parseFloat(payment.advance_amount_used || 0);

        const ledger = await client.query(
            `SELECT * FROM fees_paids
             WHERE student_id = $1 AND academic_year_id = $2
             FOR UPDATE`,
            [payment.student_id, payment.academic_year_id]
        );

        if (ledger.rowCount > 0) {
            const ledgerRow = ledger.rows[0];
            const liveTotal = await fetchLiveClassFeeTotal(
                client,
                ledgerRow.class_id,
                payment.academic_year_id
            );
            const newTotalPaid = Math.max(0, parseFloat(ledgerRow.total_paid) - revertAmount);
            const newBalance = liveTotal - newTotalPaid;
            const newStatus = newBalance <= 0 ? 'paid' : newTotalPaid > 0 ? 'partial' : 'pending';

            await client.query(
                `UPDATE fees_paids SET
                    total_paid = $1,
                    balance_amount = $2,
                    status = $3,
                    updated_at = NOW()
                 WHERE student_id = $4 AND academic_year_id = $5`,
                [newTotalPaid, Math.max(0, newBalance), newStatus,
                 payment.student_id, payment.academic_year_id]
            );
        }

        await client.query('COMMIT');

        return success(res, 200, 'Payment reversed successfully');

    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Error in reversePayment:', error);
        if (error.statusCode === 404) return errorResponse(res, 404, error.message);
        return errorResponse(res, 500, error.message || 'Internal server error');
    } finally {
        client.release();
    }
};

// ─── GET STUDENT FEE STATUS ───────────────────────────────────────────────────
const getStudentFeeStatus = async (req, res) => {
    try {
        const roleId = Number(req.user?.role_id);
        if (roleId === 2) {
            return errorResponse(res, 403, 'Teachers are not authorized to view student fee transactions');
        }
        const { studentId, academicYearId } = req.params;

        // 1. Ledger summary + Optional total for the class
        const ledgerRes = await query(
            `SELECT fp.*, c.class_name,
               (SELECT COALESCE(SUM(fct.amount), 0)
                FROM fees f
                JOIN fees_class_types fct ON fct.fee_id = f.id
                WHERE f.class_id = fp.class_id
                  AND f.academic_year_id = fp.academic_year_id
                  AND fct.is_optional = true
                  AND f.deleted_at IS NULL) as optional_payable
             FROM fees_paids fp
             JOIN classes c ON fp.class_id = c.id
             WHERE fp.student_id = $1 AND fp.academic_year_id = $2`,
            [studentId, academicYearId]
        );

        if (ledgerRes.rowCount === 0) {
            return success(res, 200, 'No fee assignment found', []);
        }

        const ledger = ledgerRes.rows[0];

        // 2. Fee breakdown (Configuration items)
        const breakdownRes = await query(
            `SELECT
                fct.id AS fees_assign_details_id,
                CASE WHEN fct.is_optional THEN 'Optional' ELSE 'Compulsory' END AS fee_group,
                ft.name AS fee_type,
                fct.amount AS total_amount,
                fct.is_optional
             FROM fees f
             JOIN fees_class_types fct ON fct.fee_id = f.id
             JOIN fees_types ft ON fct.fee_type_id = ft.id
             WHERE f.class_id = $1 
               AND f.academic_year_id = $2
               AND f.deleted_at IS NULL
             ORDER BY fct.is_optional ASC, fct.id ASC`,
            [ledger.class_id, ledger.academic_year_id]
        );


        // 3. Advance balance
        const advanceRes = await query(
            `SELECT amount FROM fees_advance
             WHERE student_id = $1 AND academic_year_id = $2`,
            [studentId, academicYearId]
        );
        const advanceBal = parseFloat(advanceRes.rows[0]?.amount || 0);

        // 4. Virtualize payments across items
        const totalPayableWithOptional = parseFloat(ledger.total_payable || 0) + parseFloat(ledger.optional_payable || 0);
        const totalPaid = parseFloat(ledger.total_paid || 0);
        let remainingPaid = totalPaid;
        const finalData = breakdownRes.rows.map(item => {
            const total = parseFloat(item.total_amount || 0);
            let paid = 0;
            paid = Math.min(total, remainingPaid);
            remainingPaid -= paid;
            return {
                ...item,
                fee_group: item.fee_group,
                paid_amount: paid,
                pending_amount: total - paid,
                discount_amount: 0,
                fine_amount: 0,
                // Include summary info on each row for frontend compatibility
                total_payable: totalPayableWithOptional,
                total_paid: totalPaid,
                balance_amount: Math.max(0, totalPayableWithOptional - totalPaid),
                advance_balance: advanceBal
            };
        });


        // Add a hidden property to the array itself for hooks that expect it
        Object.defineProperty(finalData, 'advance_balance', { value: advanceBal, enumerable: true });

        return success(res, 200, 'Student fee status retrieved successfully', finalData);
    } catch (error) {
        console.error('Error in getStudentFeeStatus:', error);
        return errorResponse(res, 500, error.message || 'Internal server error');
    }
};

// ─── FEE COLLECTIONS LIST (all students summary) ──────────────────────────────
const getFeeCollectionsList = async (req, res) => {
    try {
        const { academic_year_id } = req.query;
        if (!academic_year_id) {
            return errorResponse(res, 400, 'academic_year_id is required');
        }

        const result = await query(
            `SELECT
                s.id,
                s.admission_number AS "admNo",
                s.roll_number AS "rollNo",
                u.first_name || ' ' || COALESCE(u.last_name, '') AS student,
                u.avatar AS "studentImage",
                curr.class_name AS class,
                curr.section_name AS section,
                -- Live class fee total (all line items). Stale fees_paids.total_payable is not
                -- updated when new fees are added after partial/full payment (see autoAssignFeesToStudents).
                COALESCE(flive.live_total, 0) AS amount,
                COALESCE(fp.total_paid, 0) AS paid,
                GREATEST(0, COALESCE(flive.live_total, 0) - COALESCE(fp.total_paid, 0)) AS balance,
                CASE 
                    WHEN GREATEST(0, COALESCE(flive.live_total, 0) - COALESCE(fp.total_paid, 0)) <= 0 
                         AND COALESCE(flive.live_total, 0) > 0 THEN 'paid'
                    WHEN COALESCE(fp.total_paid, 0) > 0
                         AND GREATEST(0, COALESCE(flive.live_total, 0) - COALESCE(fp.total_paid, 0)) > 0 THEN 'partial'
                    ELSE 'unpaid'
                END AS status,
                (
                    SELECT MAX(pay_date) FROM (
                        SELECT payment_date AS pay_date FROM compulsory_fees 
                        WHERE student_id = s.id AND academic_year_id = $1
                        UNION ALL
                        SELECT payment_date AS pay_date FROM optional_fees 
                        WHERE student_id = s.id AND academic_year_id = $1
                    ) AS all_pays
                ) AS last_payment_date,
                (
                    SELECT MIN(due_date)
                    FROM fees
                    WHERE class_id = curr.class_id
                      AND academic_year_id = $1
                      AND deleted_at IS NULL
                ) AS due_date
             FROM students s
             JOIN users u ON s.user_id = u.id
             LEFT JOIN LATERAL (
                SELECT cl.id AS class_id, cl.class_name, sec.section_name
                FROM student_lifecycle_ledger sll
                LEFT JOIN classes cl ON sll.to_class_id = cl.id
                LEFT JOIN sections sec ON sll.to_section_id = sec.id
                WHERE sll.student_id = s.id
                  AND sll.to_academic_year_id = $1
                  AND sll.event_type IN ('ADMISSION', 'PROMOTE', 'REJOIN')
                ORDER BY sll.id DESC LIMIT 1
             ) curr ON TRUE
             LEFT JOIN fees_paids fp ON fp.student_id = s.id AND fp.academic_year_id = $1
             LEFT JOIN LATERAL (
                SELECT COALESCE(SUM(fct.amount), 0) AS live_total
                FROM fees f
                JOIN fees_class_types fct ON fct.fee_id = f.id
                    AND fct.class_id = f.class_id
                    AND fct.academic_year_id = f.academic_year_id
                WHERE f.class_id = COALESCE(fp.class_id, curr.class_id)
                  AND f.academic_year_id = $1
                  AND f.deleted_at IS NULL
             ) flive ON TRUE
             WHERE s.status = 'Active'
             ORDER BY curr.class_name ASC NULLS LAST, u.first_name ASC`,
            [academic_year_id]
        );

        return success(res, 200, 'Fee collections list retrieved successfully', result.rows);
    } catch (error) {
        console.error('Error in getFeeCollectionsList:', error);
        return errorResponse(res, 500, error.message || 'Internal server error');
    }
};

// ─── PAYMENT HISTORY ─────────────────────────────────────────────────────────
const getPaymentHistory = async (req, res) => {
    try {
        const roleId = Number(req.user?.role_id);
        if (roleId === 2) {
            return errorResponse(res, 403, 'Teachers are not authorized to view student fee transactions');
        }
        const { studentId, academicYearId } = req.params;

        const result = await query(
            `SELECT
                cf.*,
                f.due_date AS fee_due_date,
                fi.installment_name,
                fi.due_date AS installment_due_date,
                ft.name AS fee_type_name
             FROM compulsory_fees cf
             LEFT JOIN fees f ON cf.fee_id = f.id
             LEFT JOIN fees_installments fi ON cf.fee_installment_id = fi.id
             LEFT JOIN fees_types ft ON cf.fee_type_id = ft.id
             WHERE cf.student_id = $1 AND cf.academic_year_id = $2
             ORDER BY cf.payment_date DESC, cf.id DESC`,
            [studentId, academicYearId]
        );

        return success(res, 200, 'Payment history retrieved successfully', result.rows);
    } catch (error) {
        console.error('Error in getPaymentHistory:', error);
        return errorResponse(res, 500, error.message || 'Internal server error');
    }
};

module.exports = {
    collectFees,
    reversePayment,
    getStudentFeeStatus,
    getFeeCollectionsList,
    getPaymentHistory
};
