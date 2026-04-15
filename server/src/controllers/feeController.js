const { query } = require('../config/database');
const { getParentsForUser } = require('../utils/parentUserMatch');
const { ROLES } = require('../config/roles');
const { canAccessStudent, getAuthContext, isAdmin, parseId } = require('../utils/accessControl');

// Get fee collections list for Collect Fees page (students with fee summary)
// Optional query: academic_year_id - filter students by academic year
const getFeeCollectionsList = async (req, res) => {
  try {
    const ctx = getAuthContext(req);
    if (!isAdmin(ctx)) {
      return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
    }
    const academicYearId = req.query.academic_year_id ? parseInt(req.query.academic_year_id, 10) : null;
    const hasYearFilter = academicYearId != null && !Number.isNaN(academicYearId);
    const studentWhere = hasYearFilter ? ' AND s.academic_year_id = $1' : '';
    const params = hasYearFilter ? [academicYearId] : [];

    const result = await query(
      `WITH student_fee_summary AS (
        SELECT
          s.id AS student_id,
          s.admission_number,
          s.roll_number,
          s.first_name,
          s.last_name,
          s.photo_url AS student_photo_url,
          s.class_id,
          s.section_id,
          c.class_name,
          sec.section_name,
          COALESCE(SUM(fs.amount::numeric), 0) AS total_due,
          COALESCE((
            SELECT SUM(fc.amount_paid::numeric)
            FROM fee_collections fc
            WHERE fc.student_id = s.id AND fc.is_active = true
          ), 0) AS total_paid
        FROM students s
        LEFT JOIN classes c ON s.class_id = c.id
        LEFT JOIN sections sec ON s.section_id = sec.id
        LEFT JOIN fee_structures fs ON (fs.class_id IS NULL OR fs.class_id = s.class_id) AND COALESCE(fs.is_active, true) = true
        WHERE s.is_active = true${studentWhere}
        GROUP BY s.id, s.admission_number, s.roll_number, s.first_name, s.last_name, s.photo_url,
          s.class_id, s.section_id, c.class_name, sec.section_name
      )
      SELECT
        student_id AS id,
        admission_number AS adm_no,
        roll_number AS roll_no,
        first_name || ' ' || COALESCE(last_name, '') AS student_name,
        student_photo_url,
        class_name AS class,
        section_name AS section,
        total_due,
        total_paid,
        CASE WHEN total_paid >= total_due AND total_due > 0 THEN 'Paid' ELSE 'Unpaid' END AS status
      FROM student_fee_summary
      ORDER BY student_name ASC
    `,
      params
    );
    const rows = result.rows.map((r) => ({
      id: r.id,
      admNo: r.adm_no || '',
      rollNo: String(r.roll_no ?? ''),
      student: (r.student_name || '').trim(),
      studentImage: r.student_photo_url || null,
      class: r.class || '',
      section: r.section || '',
      amount: parseFloat(r.total_due || 0).toFixed(2),
      totalPaid: parseFloat(r.total_paid || 0),
      status: r.status || 'Unpaid',
    }));
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Fee collections list fetched successfully',
      data: rows,
    });
  } catch (error) {
    console.error('Error fetching fee collections list:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch fee collections list',
    });
  }
};

// Get fee details for a specific student (for Student Fees page, Parent view)
// Auth: Admin can get any; Student can get own; Parent can get children's; Guardian can get ward's
const getStudentFees = async (req, res) => {
  try {
    const studentId = parseId(req.params.studentId);
    if (!studentId) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid student ID' });
    }
    const access = await canAccessStudent(req, studentId);
    if (!access.ok) {
      return res.status(access.status || 403).json({ status: 'ERROR', message: access.message || 'Access denied' });
    }
    const result = await query(`
      WITH fee_due AS (
        SELECT
          fs.id AS fee_structure_id,
          fs.fee_name,
          fs.fee_type,
          fs.amount::numeric AS due_amount,
          fs.due_date,
          c.class_name
        FROM fee_structures fs
        LEFT JOIN classes c ON fs.class_id = c.id
        WHERE (
          (fs.class_id IS NULL OR fs.class_id = (SELECT class_id FROM students WHERE id = $1))
          OR fs.id IN (SELECT fee_structure_id FROM fee_collections WHERE student_id = $1 AND is_active = true)
        )
        AND COALESCE(fs.is_active, true) = true
      ),
      fee_paid AS (
        SELECT
          fc.fee_structure_id,
          fc.amount_paid::numeric,
          fc.payment_date,
          fc.payment_method,
          fc.transaction_id,
          fc.receipt_number
        FROM fee_collections fc
        WHERE fc.student_id = $1 AND fc.is_active = true
      )
      SELECT
        fd.fee_structure_id,
        fd.fee_name,
        fd.fee_type,
        fd.due_amount,
        fd.due_date,
        fd.class_name,
        COALESCE(SUM(fp.amount_paid), 0) AS paid_amount,
        fd.due_amount - COALESCE(SUM(fp.amount_paid), 0) AS outstanding
      FROM fee_due fd
      LEFT JOIN fee_paid fp ON fd.fee_structure_id = fp.fee_structure_id
      GROUP BY fd.fee_structure_id, fd.fee_name, fd.fee_type, fd.due_amount, fd.due_date, fd.class_name
      ORDER BY fd.due_date ASC NULLS LAST
    `, [studentId]);
    const collections = await query(`
      SELECT fc.id, fc.fee_structure_id, fc.amount_paid::numeric AS amount_paid,
        fc.payment_date, fc.payment_method, fc.transaction_id, fc.receipt_number,
        fs.fee_name, fs.fee_type
      FROM fee_collections fc
      INNER JOIN fee_structures fs ON fc.fee_structure_id = fs.id
      WHERE fc.student_id = $1 AND fc.is_active = true
      ORDER BY fc.payment_date DESC NULLS LAST
    `, [studentId]);
    const paymentMap = {};
    collections.rows.forEach((p) => {
      if (!paymentMap[p.fee_structure_id] || new Date(p.payment_date) > new Date(paymentMap[p.fee_structure_id].payment_date)) {
        paymentMap[p.fee_structure_id] = p;
      }
    });
    const structures = result.rows.map((r) => {
      const lastPay = paymentMap[r.fee_structure_id];
      return {
        feeStructureId: r.fee_structure_id,
        feeName: r.fee_name,
        feeType: r.fee_type,
        dueAmount: parseFloat(r.due_amount || 0),
        dueDate: r.due_date,
        className: r.class_name,
        paidAmount: parseFloat(r.paid_amount || 0),
        outstanding: parseFloat(r.outstanding || 0),
        status: parseFloat(r.paid_amount || 0) >= parseFloat(r.due_amount || 0) ? 'Paid' : 'Partial',
        lastPaymentDate: lastPay?.payment_date || null,
        lastPaymentMethod: lastPay?.payment_method || null,
        lastReceiptNumber: lastPay?.receipt_number || lastPay?.transaction_id || null,
      };
    });
    const payments = collections.rows.map((r) => ({
      id: r.id,
      feeStructureId: r.fee_structure_id,
      feeName: r.fee_name,
      feeType: r.fee_type,
      amountPaid: parseFloat(r.amount_paid || 0),
      paymentDate: r.payment_date,
      paymentMethod: r.payment_method || 'cash',
      transactionId: r.transaction_id,
      receiptNumber: r.receipt_number,
    }));
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Student fees fetched successfully',
      data: {
        structures,
        payments,
        totalDue: structures.reduce((sum, s) => sum + s.dueAmount, 0),
        totalPaid: structures.reduce((sum, s) => sum + s.paidAmount, 0),
        totalOutstanding: structures.reduce((sum, s) => sum + Math.max(0, s.outstanding), 0),
      },
    });
  } catch (error) {
    console.error('Error fetching student fees:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch student fees',
    });
  }
};

// Get fee structures list
const getFeeStructures = async (req, res) => {
  try {
    const result = await query(`
      SELECT fs.id, fs.fee_name, fs.fee_type, fs.amount::numeric, fs.due_date, fs.class_id,
        c.class_name, ay.year_name AS academic_year_name
      FROM fee_structures fs
      LEFT JOIN classes c ON fs.class_id = c.id
      LEFT JOIN academic_years ay ON fs.academic_year_id = ay.id
      WHERE COALESCE(fs.is_active, true) = true
      ORDER BY fs.due_date ASC NULLS LAST
    `);
    const data = result.rows.map((r) => ({
      id: r.id,
      feeName: r.fee_name,
      feeType: r.fee_type,
      amount: parseFloat(r.amount || 0),
      dueDate: r.due_date,
      classId: r.class_id,
      className: r.class_name,
      academicYearName: r.academic_year_name,
    }));
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Fee structures fetched successfully',
      data,
    });
  } catch (error) {
    console.error('Error fetching fee structures:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch fee structures',
    });
  }
};

// Create fee collection (student or parent pays fees - stored in fee_collections)
// fee_collections columns: id, student_id, fee_structure_id, amount_paid, payment_date,
// payment_method, transaction_id, receipt_number, is_active (and possibly notes, created_at)
const createFeeCollection = async (req, res) => {
  try {
    const ctx = getAuthContext(req);
    if (!isAdmin(ctx)) {
      return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
    }
    const {
      student_id,
      fee_structure_id,
      amount_paid,
      payment_date,
      payment_method = 'cash',
      transaction_id,
      receipt_number,
      remarks,
    } = req.body;

    if (!student_id || !fee_structure_id || amount_paid == null || amount_paid === '') {
      return res.status(400).json({
        status: 'ERROR',
        message: 'student_id, fee_structure_id and amount_paid are required',
      });
    }

    const studentId = parseId(student_id);
    const feeStructureId = parseId(fee_structure_id);
    const amount = parseFloat(amount_paid);
    const collectedBy = req.user?.id ? parseInt(req.user.id, 10) : null;
    const receiptNum = receipt_number ? String(receipt_number).trim() : null;
    const txnId = transaction_id ? String(transaction_id).trim() : receiptNum;
    const autoReceipt = receiptNum || `RCP-${Date.now()}`;

    if (!studentId || !feeStructureId || Number.isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Invalid student_id, fee_structure_id or amount_paid',
      });
    }

    // Ensure the student exists and is active inside this tenant
    const studExists = await query('SELECT id FROM students WHERE id = $1 AND is_active = true LIMIT 1', [studentId]);
    if (studExists.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Student not found' });
    }

    const paymentDate = payment_date
      ? new Date(payment_date).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const remarksVal = remarks ? String(remarks).trim() : null;
    const payMethod = (payment_method || 'cash').toString().trim() || 'cash';
    const finalTxnId = txnId || autoReceipt;
    const finalReceipt = receiptNum || autoReceipt;

    let result;
    try {
      result = await query(
        `INSERT INTO fee_collections (
          student_id, fee_structure_id, amount_paid, payment_date, payment_method,
          transaction_id, receipt_number, collected_by, remarks, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
        RETURNING id, student_id, fee_structure_id, amount_paid, payment_date, payment_method, transaction_id, receipt_number`,
        [studentId, feeStructureId, amount, paymentDate, payMethod, finalTxnId, finalReceipt, collectedBy, remarksVal]
      );
    } catch (colErr) {
      if (colErr.message && (colErr.message.includes('collected_by') || colErr.message.includes('remarks'))) {
        result = await query(
          `INSERT INTO fee_collections (
            student_id, fee_structure_id, amount_paid, payment_date, payment_method,
            transaction_id, receipt_number, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, true)
          RETURNING id, student_id, fee_structure_id, amount_paid, payment_date, payment_method, transaction_id, receipt_number`,
          [studentId, feeStructureId, amount, paymentDate, payMethod, finalTxnId, finalReceipt]
        );
      } else {
        throw colErr;
      }
    }

    const row = result.rows[0];
    res.status(201).json({
      status: 'SUCCESS',
      message: 'Fee collected successfully',
      data: {
        id: row.id,
        student_id: row.student_id,
        fee_structure_id: row.fee_structure_id,
        amount_paid: parseFloat(row.amount_paid),
        payment_date: row.payment_date,
        payment_method: row.payment_method,
        transaction_id: row.transaction_id,
        receipt_number: row.receipt_number,
      },
    });
  } catch (error) {
    console.error('Error creating fee collection:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to create fee collection',
    });
  }
};

module.exports = {
  getFeeCollectionsList,
  getStudentFees,
  getFeeStructures,
  createFeeCollection,
};
