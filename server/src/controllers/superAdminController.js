const {
  masterQuery,
  runWithTenant,
  query,
  getPrimaryDbName,
  closeTenantPoolForDb,
} = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const {
  generateTenantDbName,
  createTenantDatabase,
  dropTenantDatabaseIfExists,
  createHeadmasterUserInTenant,
  getTemplateDbName,
} = require('../services/tenantProvisioningService');
const {
  verifySuperAdminPassword,
  signSchoolDeleteToken,
  verifySchoolDeleteToken,
  writeSuperAdminAudit,
  DELETE_TOKEN_TTL_SEC,
} = require('../utils/superAdminSecurity');

/**
 * List all schools from master_db.schools.
 * Optionally filter by status via ?status=active|disabled.
 */
const listSchools = async (req, res) => {
  try {
    const { status } = req.query || {};
    const filters = ['deleted_at IS NULL'];
    const params = [];

    if (status) {
      filters.push(`status = $${params.length + 1}`);
      params.push(String(status).trim());
    }

    const whereClause = `WHERE ${filters.join(' AND ')}`;

    const result = await masterQuery(
      `
        SELECT
          id,
          school_name,
          type,
          institute_number,
          db_name,
          status,
          created_at
        FROM schools
        ${whereClause}
        ORDER BY id ASC
      `,
      params
    );

    return success(res, 200, 'Schools fetched', result.rows || []);
  } catch (err) {
    console.error('Super Admin listSchools error:', err);
    return errorResponse(res, 500, 'Failed to fetch schools');
  }
};

/**
 * Get a single school by ID from master_db.schools.
 */
const getSchoolById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return errorResponse(res, 400, 'Invalid school id');
    }

    const result = await masterQuery(
      `
        SELECT
          id,
          school_name,
          type,
          institute_number,
          db_name,
          status,
          created_at
        FROM schools
        WHERE id = $1 AND deleted_at IS NULL
        LIMIT 1
      `,
      [id]
    );

    if (!result.rows || result.rows.length === 0) {
      return errorResponse(res, 404, 'School not found');
    }

    return success(res, 200, 'School fetched', result.rows[0]);
  } catch (err) {
    console.error('Super Admin getSchoolById error:', err);
    return errorResponse(res, 500, 'Failed to fetch school');
  }
};

/**
 * Enable or disable a school by updating master_db.schools.status.
 * Does NOT touch tenant databases.
 */
const updateSchoolStatus = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return errorResponse(res, 400, 'Invalid school id');
    }

    const { status } = req.body || {};
    const normalizedStatus = String(status || '').trim().toLowerCase();

    if (!normalizedStatus || !['active', 'disabled'].includes(normalizedStatus)) {
      return errorResponse(res, 400, 'Status must be "active" or "disabled"');
    }

    const result = await masterQuery(
      `
        UPDATE schools
        SET status = $1
        WHERE id = $2 AND deleted_at IS NULL
        RETURNING
          id,
          school_name,
          type,
          institute_number,
          db_name,
          status,
          created_at
      `,
      [normalizedStatus, id]
    );

    if (!result.rows || result.rows.length === 0) {
      return errorResponse(res, 404, 'School not found');
    }

    await writeSuperAdminAudit({
      superAdminId: req.superAdmin?.id,
      action: 'school_status_updated',
      resourceType: 'school',
      resourceId: String(id),
      details: { status: normalizedStatus },
      req,
    });

    return success(res, 200, 'School status updated', result.rows[0]);
  } catch (err) {
    console.error('Super Admin updateSchoolStatus error:', err);
    return errorResponse(res, 500, 'Failed to update school status');
  }
};

/**
 * Platform-level statistics from master_db only.
 * Returns counts of total / active / disabled schools.
 * Safe initial implementation without cross-tenant aggregation.
 */
const getPlatformStats = async (req, res) => {
  try {
    const totalRes = await masterQuery(
      'SELECT COUNT(*)::INT AS total_schools FROM schools WHERE deleted_at IS NULL'
    );
    const activeRes = await masterQuery(
      `SELECT COUNT(*)::INT AS total_active_schools FROM schools WHERE deleted_at IS NULL AND status = 'active'`
    );
    const disabledRes = await masterQuery(
      `SELECT COUNT(*)::INT AS total_disabled_schools FROM schools WHERE deleted_at IS NULL AND status = 'disabled'`
    );

    const data = {
      total_schools: totalRes.rows?.[0]?.total_schools ?? 0,
      total_active_schools: activeRes.rows?.[0]?.total_active_schools ?? 0,
      total_disabled_schools: disabledRes.rows?.[0]?.total_disabled_schools ?? 0,
    };

    return success(res, 200, 'Platform statistics fetched', data);
  } catch (err) {
    console.error('Super Admin getPlatformStats error:', err);
    return errorResponse(res, 500, 'Failed to fetch platform statistics');
  }
};

/**
 * Create a new school:
 * - Validate uniqueness of institute_number
 * - Generate tenant DB name
 * - Create tenant database from template
 * - Insert row into master_db.schools
 * - Create initial Headmaster user in tenant DB
 */
const createSchool = async (req, res) => {
  const { school_name, type, institute_number, admin_name, admin_email, admin_password } =
    req.body || {};

  if (!school_name || !type || !institute_number || !admin_name || !admin_email || !admin_password) {
    return errorResponse(res, 400, 'Missing required fields');
  }

  const institute = String(institute_number).trim();
  const name = String(school_name).trim();
  const schoolType = String(type).trim();

  if (!institute) {
    return errorResponse(res, 400, 'Institute number is required');
  }

  if (!schoolType) {
    return errorResponse(res, 400, 'School type is required');
  }

  let existing;
  try {
    existing = await masterQuery(
      `
      SELECT id, institute_number, db_name
      FROM schools
      WHERE institute_number = $1 AND deleted_at IS NULL
      LIMIT 1
      `,
      [institute]
    );
  } catch (err) {
    console.error('Super Admin createSchool: master_db lookup failed:', err);
    return errorResponse(res, 500, 'Failed to validate institute number');
  }

  if (existing.rows && existing.rows.length > 0) {
    return errorResponse(res, 400, 'Institute number already exists');
  }

  // Unique index on db_name applies to ALL rows (including soft-deleted); must not reuse names.
  let existingDbNames = [];
  try {
    const dbRes = await masterQuery(
      'SELECT db_name FROM schools WHERE db_name IS NOT NULL AND TRIM(db_name) <> \'\''
    );
    existingDbNames = (dbRes.rows || []).map((r) => r.db_name).filter(Boolean);
  } catch {
    /* ignore; use empty list */
  }

  const dbName = generateTenantDbName(name, institute, existingDbNames);

  try {
    await createTenantDatabase(dbName, name);
  } catch (err) {
    console.error('Super Admin createSchool: tenant DB creation failed:', err);
    return errorResponse(res, 500, 'Failed to create tenant database');
  }

  let schoolRow;
  try {
    const insertRes = await masterQuery(
      `
      INSERT INTO schools (school_name, type, institute_number, db_name, status)
      VALUES ($1, $2, $3, $4, 'active')
      RETURNING id, school_name, type, institute_number, db_name, status, created_at
      `,
      [name, schoolType, institute, dbName]
    );
    schoolRow = insertRes.rows[0];
  } catch (err) {
    console.error('Super Admin createSchool: failed to insert into master_db.schools, rolling back DB:', err);
    try {
      await dropTenantDatabaseIfExists(dbName);
    } catch (dropErr) {
      console.error('Super Admin createSchool: failed to drop tenant DB after master insert error:', dropErr);
    }
    if (err && err.code === '23505') {
      const detail = String(err.detail || '');
      if (detail.includes('db_name')) {
        return errorResponse(
          res,
          409,
          'That database name is already registered (it may belong to a removed school). Change the school name or contact support to free the name.',
          'DUPLICATE_DB_NAME'
        );
      }
      return errorResponse(
        res,
        409,
        'This school or institute conflicts with existing data. Check institute number and try again.',
        'DUPLICATE_KEY'
      );
    }
    return errorResponse(res, 500, 'Failed to register school in master database');
  }

  try {
    await createHeadmasterUserInTenant(dbName, admin_name, admin_email, admin_password, institute);
  } catch (err) {
    console.error('Super Admin createSchool: failed to create headmaster user in tenant DB:', err);
    return errorResponse(
      res,
      500,
      'School created, but failed to create initial Headmaster user. Please configure manually.'
    );
  }

  await writeSuperAdminAudit({
    superAdminId: req.superAdmin?.id,
    action: 'school_created',
    resourceType: 'school',
    resourceId: String(schoolRow.id),
    details: {
      school_name: schoolRow.school_name,
      type: schoolRow.type,
      institute_number: schoolRow.institute_number,
    },
    req,
  });

  return success(res, 201, 'School created successfully', schoolRow);
};

/**
 * Update school metadata (school_name, institute_number) in master_db.schools.
 * Does not change db_name or status.
 */
const updateSchoolMetadata = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return errorResponse(res, 400, 'Invalid school id');
    }

    const { school_name, institute_number, type } = req.body || {};

    if (school_name === undefined && institute_number === undefined && type === undefined) {
      return errorResponse(res, 400, 'No fields to update');
    }

    const currentRes = await masterQuery(
      `
      SELECT id, school_name, type, institute_number, db_name, status, created_at
      FROM schools
      WHERE id = $1 AND deleted_at IS NULL
      LIMIT 1
      `,
      [id]
    );
    if (!currentRes.rows || currentRes.rows.length === 0) {
      return errorResponse(res, 404, 'School not found');
    }
    const current = currentRes.rows[0];

    const nextName = school_name !== undefined ? String(school_name).trim() : current.school_name;
    const nextInstitute =
      institute_number !== undefined ? String(institute_number).trim() : current.institute_number;

    let nextType = current.type;
    if (type !== undefined) {
      if (type === null || type === '') {
        nextType = null;
      } else {
        const t = String(type).trim();
        if (t.length < 2) {
          return errorResponse(res, 400, 'School type must be at least 2 characters or left empty');
        }
        nextType = t;
      }
    }

    if (!nextInstitute) {
      return errorResponse(res, 400, 'Institute number is required');
    }

    if (nextInstitute !== current.institute_number) {
      const dupRes = await masterQuery(
        `
        SELECT 1
        FROM schools
        WHERE institute_number = $1 AND id <> $2 AND deleted_at IS NULL
        LIMIT 1
        `,
        [nextInstitute, id]
      );
      if (dupRes.rows && dupRes.rows.length > 0) {
        return errorResponse(res, 400, 'Another school already uses this institute number');
      }
    }

    const updateRes = await masterQuery(
      `
      UPDATE schools
      SET school_name = $1,
          institute_number = $2,
          type = $3
      WHERE id = $4 AND deleted_at IS NULL
      RETURNING id, school_name, type, institute_number, db_name, status, created_at
      `,
      [nextName, nextInstitute, nextType, id]
    );

    await writeSuperAdminAudit({
      superAdminId: req.superAdmin?.id,
      action: 'school_metadata_updated',
      resourceType: 'school',
      resourceId: String(id),
      details: { school_name: nextName, institute_number: nextInstitute, type: nextType },
      req,
    });

    // Keep tenant-local school_profile in sync for certificate/template reads.
    try {
      await runWithTenant(current.db_name, async () => {
        await query(`
          CREATE TABLE IF NOT EXISTS school_profile (
            id SERIAL PRIMARY KEY,
            school_name VARCHAR(255) NOT NULL,
            logo_url TEXT NULL,
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);
        const exists = await query('SELECT id FROM school_profile ORDER BY id ASC LIMIT 1');
        if (!exists.rows || exists.rows.length === 0) {
          await query('INSERT INTO school_profile (school_name, logo_url) VALUES ($1, NULL)', [nextName]);
        } else {
          await query(
            'UPDATE school_profile SET school_name = $1, updated_at = NOW() WHERE id = $2',
            [nextName, exists.rows[0].id]
          );
        }
      });
    } catch (syncErr) {
      console.warn('Super Admin updateSchoolMetadata: tenant school_profile sync failed:', syncErr.message);
    }

    return success(res, 200, 'School updated successfully', updateRes.rows[0]);
  } catch (err) {
    console.error('Super Admin updateSchoolMetadata error:', err);
    return errorResponse(res, 500, 'Failed to update school');
  }
};

/**
 * Step 1: verify Super Admin password and issue a short-lived delete token (JWT).
 */
const requestSchoolDeleteToken = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return errorResponse(res, 400, 'Invalid school id');
    }
    const { password } = req.body || {};
    if (!password || !String(password).trim()) {
      return errorResponse(res, 400, 'Password is required');
    }
    const adminId = req.superAdmin?.id;
    const pwdOk = await verifySuperAdminPassword(adminId, password);
    if (!pwdOk) {
      // 403 — not "session expired" (401); client must not clear Super Admin login
      return errorResponse(res, 403, 'Sorry, that password is incorrect.', 'WRONG_PASSWORD');
    }

    const schoolRes = await masterQuery(
      `
      SELECT id, school_name, institute_number, db_name, deleted_at
      FROM schools
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );
    if (!schoolRes.rows?.length) {
      return errorResponse(res, 404, 'School not found');
    }
    if (schoolRes.rows[0].deleted_at) {
      return errorResponse(res, 400, 'School is already removed');
    }

    const templateDbName = getTemplateDbName();
    if (schoolRes.rows[0].db_name === templateDbName) {
      return errorResponse(res, 400, 'Cannot remove primary template school');
    }

    const deleteToken = signSchoolDeleteToken(id, adminId);
    await writeSuperAdminAudit({
      superAdminId: adminId,
      action: 'school_delete_token_issued',
      resourceType: 'school',
      resourceId: String(id),
      details: { school_name: schoolRes.rows[0].school_name },
      req,
    });

    return success(res, 200, 'Delete confirmation issued', {
      deleteToken,
      expiresInSeconds: DELETE_TOKEN_TTL_SEC,
    });
  } catch (err) {
    console.error('Super Admin requestSchoolDeleteToken error:', err);
    return errorResponse(res, 500, 'Unable to issue delete confirmation');
  }
};

/**
 * Step 2: confirm with password + token; soft-delete in master, then drop tenant DB when safe.
 */
const confirmDeleteSchool = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return errorResponse(res, 400, 'Invalid school id');
    }
    const { password, deleteToken } = req.body || {};
    if (!password || !deleteToken) {
      return errorResponse(res, 400, 'Password and delete token are required');
    }

    let payload;
    try {
      payload = verifySchoolDeleteToken(deleteToken);
    } catch {
      return errorResponse(res, 400, 'Invalid or expired delete token');
    }
    if (payload.schoolId !== id || payload.superAdminId !== req.superAdmin?.id) {
      return errorResponse(res, 403, 'Delete token does not match this request');
    }

    const pwdOk = await verifySuperAdminPassword(req.superAdmin.id, password);
    if (!pwdOk) {
      return errorResponse(res, 403, 'Sorry, that password is incorrect.', 'WRONG_PASSWORD');
    }

    const schoolRes = await masterQuery(
      `
      SELECT id, school_name, institute_number, db_name, deleted_at
      FROM schools
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );
    if (!schoolRes.rows?.length) {
      return errorResponse(res, 404, 'School not found');
    }
    if (schoolRes.rows[0].deleted_at) {
      return errorResponse(res, 400, 'School already removed');
    }

    const templateDbName = getTemplateDbName();
    if (schoolRes.rows[0].db_name === templateDbName) {
      return errorResponse(res, 400, 'Cannot remove primary template school');
    }

    const tenantDbName = schoolRes.rows[0].db_name;
    const primaryAppDb = getPrimaryDbName();

    const upd = await masterQuery(
      `
      UPDATE schools
      SET deleted_at = NOW(),
          status = 'disabled'
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id, school_name, type, institute_number, db_name, status, created_at, deleted_at
      `,
      [id]
    );

    let tenantDbDropped = false;
    let tenantDbDropError = null;
    let tenantDbDropSkippedReason = null;

    await closeTenantPoolForDb(tenantDbName);

    if (tenantDbName === primaryAppDb) {
      tenantDbDropSkippedReason = 'primary_application_database';
    } else {
      try {
        await dropTenantDatabaseIfExists(tenantDbName);
        tenantDbDropped = true;
      } catch (dropErr) {
        console.error('Super Admin confirmDeleteSchool: tenant DB drop failed:', dropErr);
        tenantDbDropError = dropErr.message || String(dropErr);
      }
    }

    await writeSuperAdminAudit({
      superAdminId: req.superAdmin.id,
      action: 'school_deleted',
      resourceType: 'school',
      resourceId: String(id),
      details: {
        school_name: schoolRes.rows[0].school_name,
        db_name: tenantDbName,
        tenant_db_dropped: tenantDbDropped,
        tenant_db_drop_skipped_reason: tenantDbDropSkippedReason,
        tenant_db_drop_error: tenantDbDropError,
      },
      req,
    });

    const row = upd.rows[0];
    const message =
      tenantDbDropped
        ? 'School and tenant database removed successfully'
        : tenantDbDropSkippedReason === 'primary_application_database'
          ? 'School removed from the platform (application primary database was not dropped)'
          : tenantDbDropError
            ? 'School removed from the platform, but the tenant database could not be dropped automatically. Check server logs.'
            : 'School removed from the platform';

    return success(res, 200, message, {
      ...row,
      tenant_db_dropped: tenantDbDropped,
      tenant_db_drop_skipped_reason: tenantDbDropSkippedReason,
      tenant_db_drop_error: tenantDbDropError,
    });
  } catch (err) {
    console.error('Super Admin confirmDeleteSchool error:', err);
    return errorResponse(res, 500, 'Failed to remove school');
  }
};

module.exports = {
  listSchools,
  getSchoolById,
  updateSchoolStatus,
  getPlatformStats,
  createSchool,
  updateSchoolMetadata,
  requestSchoolDeleteToken,
  confirmDeleteSchool,
};

