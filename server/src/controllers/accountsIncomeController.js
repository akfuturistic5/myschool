const { query, executeTransaction } = require('../config/database');
const { resolveAcademicYearIdFromQuery } = require('../utils/libraryAcademicYear');
const { parsePagination, listMeta, buildOrderClause } = require('../utils/accountsPagination');
const {
  sliceYmd,
  resolveRequiredAcademicYearId,
  assertCategoryUsable,
  mapLedgerToIncome,
  LEDGER_FROM,
} = require('../utils/accountsFinancialLedger');
const { getStorageProvider } = require('../storage');

const TX_TYPE = 'Income';

const listIncome = async (req, res) => {
  try {
    const yearId = await resolveAcademicYearIdFromQuery(req);
    const search = req.query.search ? String(req.query.search).trim() : '';
    const dateFrom = req.query.date_from ? String(req.query.date_from).trim().slice(0, 10) : '';
    const dateTo = req.query.date_to ? String(req.query.date_to).trim().slice(0, 10) : '';
    const paymentMethod = req.query.payment_method ? String(req.query.payment_method).trim() : '';
    const { page, pageSize, limit, offset } = parsePagination(req.query);

    const params = [];
    let where = `WHERE fl.deleted_at IS NULL AND fl.transaction_type = '${TX_TYPE}'`;
    if (yearId != null) {
      params.push(yearId);
      where += ` AND fl.academic_year_id = $${params.length}`;
    }
    if (search) {
      const p = `%${search}%`;
      params.push(p);
      const n = params.length;
      where += ` AND (
        fl.title ILIKE $${n}
        OR COALESCE(fl.description, '') ILIKE $${n}
        OR COALESCE(fl.source_reference, '') ILIKE $${n}
        OR COALESCE(fl.invoice_no, '') ILIKE $${n}
      )`;
    }
    if (dateFrom) {
      params.push(dateFrom);
      where += ` AND fl.transaction_date >= $${params.length}::date`;
    }
    if (dateTo) {
      params.push(dateTo);
      where += ` AND fl.transaction_date <= $${params.length}::date`;
    }
    if (paymentMethod) {
      params.push(paymentMethod);
      where += ` AND fl.payment_mode = $${params.length}`;
    }

    const countR = await query(`SELECT COUNT(*)::int AS c ${LEDGER_FROM} ${where}`, [...params]);
    const total = countR.rows[0].c;

    const orderSql = buildOrderClause(
      req.query,
      {
        income_date: 'fl.transaction_date',
        amount: 'fl.amount',
        income_name: 'fl.title',
        invoice_no: 'fl.invoice_no',
        source: 'fl.source_reference',
        payment_method: 'fl.payment_mode',
        description: 'fl.description',
        id: 'fl.id',
      },
      'income_date',
      'fl.id DESC'
    );

    const dataParams = [...params, limit, offset];
    const limIdx = dataParams.length - 1;
    const offIdx = dataParams.length;
    const r = await query(
      `SELECT fl.*, cat.category_name, fd.document_name, fd.file_path, fd.file_size, fd.file_type
       ${LEDGER_FROM}
       ${where}
       ${orderSql}
       LIMIT $${limIdx} OFFSET $${offIdx}`,
      dataParams
    );
    const data = r.rows.map(mapLedgerToIncome);
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Income records fetched',
      data,
      count: data.length,
      ...listMeta(total, page, pageSize),
    });
  } catch (e) {
    console.error('accounts income list', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to list income records' });
  }
};

const getIncome = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid id' });
    }
    const r = await query(
      `SELECT fl.*, cat.category_name, fd.document_name, fd.file_path, fd.file_size, fd.file_type
       ${LEDGER_FROM}
       WHERE fl.id = $1 AND fl.deleted_at IS NULL AND fl.transaction_type = $2`,
      [id, TX_TYPE]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Income record not found' });
    }
    res.status(200).json({ status: 'SUCCESS', message: 'OK', data: mapLedgerToIncome(r.rows[0]) });
  } catch (e) {
    console.error('accounts income get', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to get income record' });
  }
};

const createIncome = async (req, res) => {
  let uploadedFileKey = null;
  try {
    const schoolId = req.user?.school_id;
    if (!schoolId) {
      return res.status(400).json({ status: 'ERROR', message: 'School context is required' });
    }
    const userId = req.user?.id;

    const yearId = await resolveRequiredAcademicYearId(req.body, await resolveAcademicYearIdFromQuery(req));
    if (!Number.isFinite(yearId)) {
      return res.status(400).json({ status: 'ERROR', message: 'academic_year_id is required' });
    }
    const income_date = sliceYmd(req.body.income_date);
    if (!income_date) {
      return res.status(400).json({ status: 'ERROR', message: 'income_date is required' });
    }

    const category_id = parseInt(req.body.category_id, 10);
    if (!Number.isFinite(category_id)) {
      return res.status(400).json({ status: 'ERROR', message: 'category_id is required' });
    }

    const storage = getStorageProvider();
    if (req.file) {
      const uploadResult = await storage.upload(req.file, schoolId, 'documents/accounts/income');
      uploadedFileKey = uploadResult.relativePath;
    }

    const row = await executeTransaction(async (client) => {
      await assertCategoryUsable(client, category_id, yearId, 'Income');

      const ins = await client.query(
        `INSERT INTO financial_ledger (
           academic_year_id, category_id, title, description, source_reference,
           transaction_date, amount, transaction_type, payment_mode, invoice_no, status,
           created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10, $11, NOW(), NOW())
         RETURNING *`,
        [
          yearId,
          category_id,
          String(req.body.income_name).trim(),
          req.body.description != null ? String(req.body.description).trim() : null,
          req.body.source != null ? String(req.body.source).trim() : null,
          income_date,
          req.body.amount,
          TX_TYPE,
          req.body.payment_method != null ? String(req.body.payment_method).trim() : null,
          req.body.invoice_no != null ? String(req.body.invoice_no).trim() : null,
          'Completed',
        ]
      );
      const ledger = ins.rows[0];

      if (req.file && uploadedFileKey) {
        await client.query(
          `INSERT INTO financial_documents (
             ledger_id, document_name, file_path, file_size, file_type, uploaded_by,
             created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
          [
            ledger.id,
            req.file.originalname,
            uploadedFileKey,
            req.file.size,
            req.file.mimetype,
            userId || null,
          ]
        );
      }

      return ledger;
    });

    const r = await query(
      `SELECT fl.*, cat.category_name, fd.document_name, fd.file_path, fd.file_size, fd.file_type
       ${LEDGER_FROM}
       WHERE fl.id = $1 AND fl.deleted_at IS NULL`,
      [row.id]
    );

    res.status(201).json({ status: 'SUCCESS', message: 'Income created', data: mapLedgerToIncome(r.rows[0]) });
  } catch (e) {
    if (uploadedFileKey) {
      try {
        const storage = getStorageProvider();
        await storage.delete(uploadedFileKey);
      } catch (err) {
        console.error('Failed to cleanup uploaded file on error', err);
      }
    }

    if (e.code === 'CATEGORY_NOT_FOUND') {
      return res.status(400).json({ status: 'ERROR', message: 'Category does not exist' });
    }
    if (e.code === 'CATEGORY_INACTIVE') {
      return res.status(400).json({ status: 'ERROR', message: 'Category is inactive' });
    }
    if (e.code === 'CATEGORY_YEAR_MISMATCH') {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Category does not belong to the selected academic year',
      });
    }
    console.error('accounts income create', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to create income record' });
  }
};

const updateIncome = async (req, res) => {
  let uploadedFileKey = null;
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid id' });
    }
    const schoolId = req.user?.school_id;
    if (!schoolId) {
      return res.status(400).json({ status: 'ERROR', message: 'School context is required' });
    }
    const userId = req.user?.id;

    const existing = await query(
      `SELECT * FROM financial_ledger WHERE id = $1 AND deleted_at IS NULL AND transaction_type = $2`,
      [id, TX_TYPE]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Income record not found' });
    }

    const cur = existing.rows[0];
    const title = req.body.income_name != null ? String(req.body.income_name).trim() : cur.title;
    const description =
      req.body.description !== undefined
        ? req.body.description != null
          ? String(req.body.description).trim()
          : null
        : cur.description;
    const source_reference =
      req.body.source !== undefined
        ? req.body.source != null
          ? String(req.body.source).trim()
          : null
        : cur.source_reference;
    const transaction_date =
      req.body.income_date != null ? sliceYmd(req.body.income_date) || cur.transaction_date : cur.transaction_date;
    const amount = req.body.amount != null ? req.body.amount : cur.amount;
    const invoice_no =
      req.body.invoice_no !== undefined
        ? req.body.invoice_no != null
          ? String(req.body.invoice_no).trim()
          : null
        : cur.invoice_no;
    const payment_mode =
      req.body.payment_method !== undefined
        ? req.body.payment_method != null
          ? String(req.body.payment_method).trim()
          : null
        : cur.payment_mode;
    const academic_year_id =
      req.body.academic_year_id !== undefined
        ? req.body.academic_year_id != null && req.body.academic_year_id !== ''
          ? parseInt(req.body.academic_year_id, 10)
          : cur.academic_year_id
        : cur.academic_year_id;
    const category_id =
      req.body.category_id !== undefined
        ? req.body.category_id != null && req.body.category_id !== ''
          ? parseInt(req.body.category_id, 10)
          : null
        : cur.category_id;

    const storage = getStorageProvider();
    if (req.file) {
      const uploadResult = await storage.upload(req.file, schoolId, 'documents/accounts/income');
      uploadedFileKey = uploadResult.relativePath;
    }

    const removeDoc = req.body.remove_document === true || req.body.remove_document === 'true';

    await executeTransaction(async (client) => {
      if (Number.isFinite(category_id)) {
        await assertCategoryUsable(client, category_id, academic_year_id, 'Income');
      }

      await client.query(
        `UPDATE financial_ledger SET
           title = $1,
           description = $2,
           source_reference = $3,
           transaction_date = $4::date,
           amount = $5,
           invoice_no = $6,
           payment_mode = $7,
           academic_year_id = $8,
           category_id = $9,
           updated_at = NOW()
         WHERE id = $10 AND deleted_at IS NULL AND transaction_type = $11`,
        [
          title,
          description,
          source_reference,
          transaction_date,
          amount,
          invoice_no,
          payment_mode,
          academic_year_id,
          Number.isFinite(category_id) ? category_id : null,
          id,
          TX_TYPE,
        ]
      );

      if (req.file || removeDoc) {
        // Soft delete old active documents
        await client.query(
          `UPDATE financial_documents
           SET deleted_at = NOW(), updated_at = NOW()
           WHERE ledger_id = $1 AND deleted_at IS NULL`,
          [id]
        );
      }

      if (req.file && uploadedFileKey) {
        await client.query(
          `INSERT INTO financial_documents (
             ledger_id, document_name, file_path, file_size, file_type, uploaded_by,
             created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
          [
            id,
            req.file.originalname,
            uploadedFileKey,
            req.file.size,
            req.file.mimetype,
            userId || null,
          ]
        );
      }
    });

    const r = await query(
      `SELECT fl.*, cat.category_name, fd.document_name, fd.file_path, fd.file_size, fd.file_type
       ${LEDGER_FROM}
       WHERE fl.id = $1 AND fl.deleted_at IS NULL`,
      [id]
    );
    res.status(200).json({ status: 'SUCCESS', message: 'Income updated', data: mapLedgerToIncome(r.rows[0]) });
  } catch (e) {
    if (uploadedFileKey) {
      try {
        const storage = getStorageProvider();
        await storage.delete(uploadedFileKey);
      } catch (err) {
        console.error('Failed to cleanup uploaded file on error', err);
      }
    }

    if (e.code === 'CATEGORY_NOT_FOUND') {
      return res.status(400).json({ status: 'ERROR', message: 'Category does not exist' });
    }
    if (e.code === 'CATEGORY_INACTIVE') {
      return res.status(400).json({ status: 'ERROR', message: 'Category is inactive' });
    }
    if (e.code === 'CATEGORY_YEAR_MISMATCH') {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Category does not belong to the selected academic year',
      });
    }
    console.error('accounts income update', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to update income record' });
  }
};

const deleteIncome = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid id' });
    }

    const result = await executeTransaction(async (client) => {
      const del = await client.query(
        `UPDATE financial_ledger
         SET deleted_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL AND transaction_type = $2
         RETURNING id`,
        [id, TX_TYPE]
      );
      
      if (del.rows.length > 0) {
        await client.query(
          `UPDATE financial_documents
           SET deleted_at = NOW(), updated_at = NOW()
           WHERE ledger_id = $1 AND deleted_at IS NULL`,
          [id]
        );
      }
      return del.rows;
    });

    if (result.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Income record not found' });
    }
    res.status(200).json({ status: 'SUCCESS', message: 'Income deleted', data: { id } });
  } catch (e) {
    console.error('accounts income delete', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to delete income record' });
  }
};

module.exports = {
  listIncome,
  getIncome,
  createIncome,
  updateIncome,
  deleteIncome,
};
