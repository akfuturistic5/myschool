const { masterQuery } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { writeSuperAdminAudit } = require('../utils/superAdminSecurity');

const listEnquiries = async (req, res) => {
  try {
    const { status } = req.query || {};
    const params = [];
    let where = '1=1';
    if (status && String(status).trim()) {
      params.push(String(status).trim().toLowerCase());
      where = `LOWER(status) = $1`;
    }
    const r = await masterQuery(
      `SELECT id, contact_name, organization_name, email, phone, message, status, created_at, updated_at
       FROM school_enquiries
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT 500`,
      params
    );
    return success(res, 200, 'Enquiries fetched', r.rows || []);
  } catch (err) {
    console.error('listEnquiries error:', err);
    return errorResponse(res, 500, 'Failed to list enquiries');
  }
};

const createEnquiry = async (req, res) => {
  try {
    const { contact_name, organization_name, email, phone, message } = req.body || {};
    const cn = String(contact_name || '').trim();
    if (cn.length < 2) return errorResponse(res, 400, 'Contact name is required');
    const ins = await masterQuery(
      `
      INSERT INTO school_enquiries (contact_name, organization_name, email, phone, message, status)
      VALUES ($1, $2, $3, $4, $5, 'new')
      RETURNING id, contact_name, organization_name, email, phone, message, status, created_at
      `,
      [
        cn,
        organization_name != null ? String(organization_name).trim() || null : null,
        email != null ? String(email).trim() || null : null,
        phone != null ? String(phone).trim() || null : null,
        message != null ? String(message).trim() || null : null,
      ]
    );
    await writeSuperAdminAudit({
      superAdminId: req.superAdmin?.id,
      action: 'school_enquiry_created',
      resourceType: 'school_enquiry',
      resourceId: String(ins.rows[0].id),
      req,
    });
    return success(res, 201, 'Enquiry recorded', ins.rows[0]);
  } catch (err) {
    console.error('createEnquiry error:', err);
    return errorResponse(res, 500, 'Failed to create enquiry');
  }
};

const patchEnquiry = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return errorResponse(res, 400, 'Invalid enquiry id');
    const { status } = req.body || {};
    const st = String(status || '').trim().toLowerCase();
    const allowed = ['new', 'contacted', 'converted', 'dismissed'];
    if (!allowed.includes(st)) {
      return errorResponse(res, 400, `Status must be one of: ${allowed.join(', ')}`);
    }
    const r = await masterQuery(
      `
      UPDATE school_enquiries
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, contact_name, organization_name, email, phone, message, status, created_at, updated_at
      `,
      [st, id]
    );
    if (!r.rows?.length) return errorResponse(res, 404, 'Enquiry not found');
    await writeSuperAdminAudit({
      superAdminId: req.superAdmin?.id,
      action: 'school_enquiry_status_updated',
      resourceType: 'school_enquiry',
      resourceId: String(id),
      details: { status: st },
      req,
    });
    return success(res, 200, 'Enquiry updated', r.rows[0]);
  } catch (err) {
    console.error('patchEnquiry error:', err);
    return errorResponse(res, 500, 'Failed to update enquiry');
  }
};

module.exports = {
  listEnquiries,
  createEnquiry,
  patchEnquiry,
};
