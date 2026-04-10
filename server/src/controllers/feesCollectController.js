const { query, pool } = require('../config/database');
const { getAuthContext, isAdmin } = require('../utils/accessControl');

// Helper to generate receipt number: RCPT-{year}-{increment}
const generateReceiptNo = async (academicYearId, client) => {
    const yearResult = await client.query('SELECT year_name FROM academic_years WHERE id = $1', [academicYearId]);
    const yearName = yearResult.rows[0].year_name.split('-')[0]; // Get e.g. "2023" from "2023-24"
    
    const lastReceiptResult = await client.query(
        `SELECT receipt_no FROM fees_collect 
         WHERE academic_year_id = $1 
         ORDER BY id DESC LIMIT 1`,
        [academicYearId]
    );

    let increment = 1;
    if (lastReceiptResult.rowCount > 0) {
        const lastNo = lastReceiptResult.rows[0].receipt_no;
        const parts = lastNo.split('-');
        const lastIncrement = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastIncrement)) {
            increment = lastIncrement + 1;
        }
    }

    return `RCPT-${yearName}-${String(increment).padStart(5, '0')}`;
};

const collectFees = async (req, res) => {
    const client = await pool.connect();
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx)) {
            return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
        }

        const {
            student_id,
            academic_year_id,
            payment_date,
            payment_mode,
            remarks,
            fee_items // Array of { fees_assign_details_id, amount_to_pay }
        } = req.body;

        if (!student_id || !academic_year_id || !fee_items || !Array.isArray(fee_items) || fee_items.length === 0) {
            return res.status(400).json({ status: 'ERROR', message: 'student_id, academic_year_id and fee_items are required' });
        }

        await client.query('BEGIN');

        let totalPaid = 0;
        const processedItems = [];

        for (const item of fee_items) {
            const { fees_assign_details_id, amount_to_pay } = item;
            const payAmount = parseFloat(amount_to_pay);

            if (isNaN(payAmount) || payAmount <= 0) continue;

            // 1. SELECT FOR UPDATE to lock the row and get latest status
            const assignDetailResult = await client.query(
                `SELECT fad.*, 
                    COALESCE((SELECT SUM(paid_amount) FROM fees_collect_details WHERE fees_assign_details_id = fad.id), 0) as currently_paid
                 FROM fees_assign_details fad
                 WHERE fad.id = $1 AND fad.fees_assign_id IN (SELECT id FROM fees_assign WHERE student_id = $2)
                 FOR UPDATE`,
                [fees_assign_details_id, student_id]
            );

            if (assignDetailResult.rowCount === 0) {
                throw new Error(`Fee assignment detail ${fees_assign_details_id} not found for this student`);
            }

            const detail = assignDetailResult.rows[0];
            const pending = parseFloat(detail.amount) - parseFloat(detail.currently_paid);

            if (payAmount > pending + 0.01) { // Small epsilon for float
                throw new Error(`Overpayment detected for fee item. Pending: ${pending}, Attempted: ${payAmount}`);
            }

            totalPaid += payAmount;
            processedItems.push({
                fees_assign_details_id,
                paid_amount: payAmount
            });
        }

        if (processedItems.length === 0) {
            throw new Error('No valid fee items to process');
        }

        // 2. Generate Receipt No
        const receiptNo = await generateReceiptNo(academic_year_id, client);

        // 3. Create Header
        const headerResult = await client.query(
            `INSERT INTO fees_collect (student_id, total_paid, receipt_no, academic_year_id, payment_date, payment_mode, remarks)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [
                student_id, 
                totalPaid, 
                receiptNo, 
                academic_year_id, 
                payment_date || new Date(), 
                payment_mode || 'Cash', 
                remarks
            ]
        );
        const collectHeaderId = headerResult.rows[0].id;

        // 4. Create Details
        for (const item of processedItems) {
            await client.query(
                `INSERT INTO fees_collect_details (fees_collect_id, fees_assign_details_id, paid_amount)
                 VALUES ($1, $2, $3)`,
                [collectHeaderId, item.fees_assign_details_id, item.paid_amount]
            );
        }

        await client.query('COMMIT');

        res.status(200).json({
            status: 'SUCCESS',
            message: 'Fees collected successfully',
            data: {
                receipt_no: receiptNo,
                total_paid: totalPaid,
                collect_id: collectHeaderId
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error in collectFees:', error);
        res.status(error.message.includes('not found') || error.message.includes('Overpayment') ? 400 : 500).json({ 
            status: 'ERROR', 
            message: error.message || 'Internal server error' 
        });
    } finally {
        client.release();
    }
};

const getStudentFeeStatus = async (req, res) => {
    try {
        const { studentId, academicYearId } = req.params;
        
        // Get breakdown per fee type
        const result = await query(
            `SELECT 
                fad.id as fees_assign_details_id,
                ft.name as fee_type,
                fg.name as fee_group,
                fad.amount as total_amount,
                COALESCE((SELECT SUM(fcd.paid_amount) FROM fees_collect_details fcd WHERE fcd.fees_assign_details_id = fad.id), 0) as paid_amount
             FROM fees_assign_details fad
             JOIN fees_assign fa ON fad.fees_assign_id = fa.id
             JOIN fees_master fm ON fad.fees_master_id = fm.id
             JOIN fees_types ft ON fm.fees_type_id = ft.id
             JOIN fees_groups fg ON fm.fees_group_id = fg.id
             WHERE fa.student_id = $1 AND fa.academic_year_id = $2`,
            [studentId, academicYearId]
        );

        const rows = result.rows.map(r => ({
            ...r,
            total_amount: parseFloat(r.total_amount),
            paid_amount: parseFloat(r.paid_amount),
            pending_amount: parseFloat(r.total_amount) - parseFloat(r.paid_amount),
            discount_amount: parseFloat(r.discount_amount || 0),
            fine_amount: parseFloat(r.fine_amount || 0)
        }));

        res.status(200).json({
            status: 'SUCCESS',
            data: rows
        });
    } catch (error) {
        console.error('Error in getStudentFeeStatus:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
};

const getFeeCollectionsList = async (req, res) => {
    try {
        const academicYearId = parseInt(req.query.academic_year_id, 10);
        if (isNaN(academicYearId)) {
            return res.status(400).json({ status: 'ERROR', message: 'academic_year_id is required' });
        }

        const result = await query(
            `SELECT 
                s.id, s.admission_number as "admNo", s.roll_number as "rollNo", 
                s.first_name || ' ' || COALESCE(s.last_name, '') as student,
                c.class_name as class, sec.section_name as section,
                s.photo_url as "studentImage",
                COALESCE(SUM(DISTINCT fad.amount), 0) as total_assigned,
                COALESCE((
                    SELECT SUM(fcd.paid_amount) 
                    FROM fees_collect_details fcd
                    JOIN fees_assign_details fad2 ON fcd.fees_assign_details_id = fad2.id
                    JOIN fees_assign fa2 ON fad2.fees_assign_id = fa2.id
                    WHERE fa2.student_id = s.id AND fa2.academic_year_id = $1
                ), 0) as total_paid,
                (
                    SELECT MAX(payment_date)
                    FROM fees_collect
                    WHERE student_id = s.id AND academic_year_id = $1
                ) as last_payment_date
             FROM students s
             LEFT JOIN classes c ON s.class_id = c.id
             LEFT JOIN sections sec ON s.section_id = sec.id
             LEFT JOIN fees_assign fa ON s.id = fa.student_id AND fa.academic_year_id = $1
             LEFT JOIN fees_assign_details fad ON fa.id = fad.fees_assign_id
             WHERE s.is_active = true
             GROUP BY s.id, c.class_name, sec.section_name
             ORDER BY c.class_name ASC, s.first_name ASC`,
            [academicYearId]
        );

        const rows = result.rows.map(r => {
            const assigned = parseFloat(r.total_assigned);
            const paid = parseFloat(r.total_paid);
            let status = 'Unpaid';
            if (assigned > 0) {
                if (paid >= assigned) status = 'Paid';
                else if (paid > 0) status = 'Partial';
            } else {
                status = 'No Fees';
            }

            return {
                ...r,
                amount: assigned.toString(),
                paid: paid.toString(),
                status: status
            };
        });

        res.status(200).json({
            status: 'SUCCESS',
            data: rows
        });
    } catch (error) {
        console.error('Error in getFeeCollectionsList:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
};

const getPaymentHistory = async (req, res) => {
    try {
        const { studentId, academicYearId } = req.params;
        
        const result = await query(
            `SELECT fc.*, 
                (SELECT JSON_AGG(d) FROM (
                    SELECT fcd.*, ft.name as fee_type
                    FROM fees_collect_details fcd
                    JOIN fees_assign_details fad ON fcd.fees_assign_details_id = fad.id
                    JOIN fees_master fm ON fad.fees_master_id = fm.id
                    JOIN fees_types ft ON fm.fees_type_id = ft.id
                    WHERE fcd.fees_collect_id = fc.id
                ) d) as details
             FROM fees_collect fc
             WHERE fc.student_id = $1 AND fc.academic_year_id = $2
             ORDER BY fc.payment_date DESC, fc.id DESC`,
            [studentId, academicYearId]
        );

        res.status(200).json({
            status: 'SUCCESS',
            data: result.rows
        });
    } catch (error) {
        console.error('Error in getPaymentHistory:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
};

module.exports = {
    collectFees,
    getStudentFeeStatus,
    getPaymentHistory,
    getFeeCollectionsList
};
