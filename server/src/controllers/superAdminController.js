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
const { issueTenantSessionForUser } = require('../services/tenantSessionIssueService');
const {
  getEffectiveSchoolModules,
  replaceSchoolOverrides,
} = require('../services/saasSchoolModulesService');
const { ROLES } = require('../config/roles');

/**
 * List all schools from master_db.schools.
 * Optionally filter by status via ?status=active|disabled.
 */
const listSchools = async (req, res) => {
  try {
    const { status, q } = req.query || {};
    const filters = ['s.deleted_at IS NULL'];
    const params = [];

    if (status) {
      filters.push(`s.status = $${params.length + 1}`);
      params.push(String(status).trim());
    }

    if (q && String(q).trim()) {
      const term = `%${String(q).trim().toLowerCase()}%`;
      const idx = params.length + 1;
      filters.push(
        `(LOWER(s.school_name) LIKE $${idx} OR LOWER(s.institute_number) LIKE $${idx} OR LOWER(s.db_name) LIKE $${idx})`
      );
      params.push(term);
    }

    const whereClause = `WHERE ${filters.join(' AND ')}`;

    const result = await masterQuery(
      `
        SELECT
          s.id,
          s.school_name,
          s.type,
          s.institute_number,
          s.db_name,
          s.status,
          s.created_at,
          s.plan_id,
          p.name AS plan_name,
          p.slug AS plan_slug
        FROM schools s
        LEFT JOIN saas_plans p ON p.id = s.plan_id
        ${whereClause}
        ORDER BY s.id ASC
      `,
      params
    );

    return success(res, 200, 'Schools fetched', result.rows || []);
  } catch (err) {
    console.error('Super Admin listSchools error:', err);
    return errorResponse(res, 500, 'Failed to fetch schools', err.message);
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
          s.id,
          s.school_name,
          s.type,
          s.institute_number,
          s.db_name,
          s.status,
          s.created_at,
          s.plan_id,
          p.name AS plan_name,
          p.slug AS plan_slug
        FROM schools s
        LEFT JOIN saas_plans p ON p.id = s.plan_id
        WHERE s.id = $1 AND s.deleted_at IS NULL
        LIMIT 1
      `,
      [id]
    );

    if (!result.rows || result.rows.length === 0) {
      return errorResponse(res, 404, 'School not found');
    }

    const row = result.rows[0];
    let modulesPayload = null;
    try {
      modulesPayload = await getEffectiveSchoolModules(id);
    } catch (e) {
      console.warn('getSchoolById: modules not loaded:', e.message);
    }

    let overrides = [];
    try {
      const ov = await masterQuery(
        `SELECT module_key, show_in_menu, route_accessible
         FROM school_module_overrides WHERE school_id = $1 ORDER BY module_key`,
        [id]
      );
      overrides = ov.rows || [];
    } catch {
      /* migration may not be applied */
    }

    return success(res, 200, 'School fetched', {
      ...row,
      saas_plan: modulesPayload?.plan || null,
      saas_modules: modulesPayload?.modules || null,
      saas_module_overrides: overrides,
    });
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
    const inactiveRes = await masterQuery(
      `SELECT COUNT(*)::INT AS total_inactive_schools FROM schools WHERE deleted_at IS NULL AND status <> 'active'`
    );
    const disabledRes = await masterQuery(
      `SELECT COUNT(*)::INT AS total_disabled_schools FROM schools WHERE deleted_at IS NULL AND status = 'disabled'`
    );

    let total_plans = 0;
    let enquiries_new = 0;
    try {
      const plansRes = await masterQuery(
        `SELECT COUNT(*)::INT AS c FROM saas_plans WHERE is_active = TRUE`
      );
      total_plans = plansRes.rows?.[0]?.c ?? 0;
    } catch {
      total_plans = 0;
    }
    try {
      const enqRes = await masterQuery(
        `SELECT COUNT(*)::INT AS c FROM school_enquiries WHERE LOWER(status) = 'new'`
      );
      enquiries_new = enqRes.rows?.[0]?.c ?? 0;
    } catch {
      enquiries_new = 0;
    }

    const data = {
      total_schools: totalRes.rows?.[0]?.total_schools ?? 0,
      total_active_schools: activeRes.rows?.[0]?.total_active_schools ?? 0,
      total_inactive_schools: inactiveRes.rows?.[0]?.total_inactive_schools ?? 0,
      total_disabled_schools: disabledRes.rows?.[0]?.total_disabled_schools ?? 0,
      total_plans,
      enquiries_new,
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
    const message =
      process.env.NODE_ENV !== 'production' && err && err.message
        ? `Failed to create tenant database: ${err.message}`
        : 'Failed to create tenant database';
    return errorResponse(res, 500, message);
  }

  let schoolRow;
  try {
    let defaultPlanId = null;
    try {
      const pr = await masterQuery(`SELECT id FROM saas_plans WHERE slug = 'full' LIMIT 1`);
      defaultPlanId = pr.rows?.[0]?.id ?? null;
    } catch {
      defaultPlanId = null;
    }

    const insertRes = defaultPlanId
      ? await masterQuery(
          `
      INSERT INTO schools (school_name, type, institute_number, db_name, status, plan_id)
      VALUES ($1, $2, $3, $4, 'active', $5)
      RETURNING id, school_name, type, institute_number, db_name, status, created_at, plan_id
      `,
          [name, schoolType, institute, dbName, defaultPlanId]
        )
      : await masterQuery(
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
            phone VARCHAR(30) NULL,
            email VARCHAR(255) NULL,
            fax VARCHAR(30) NULL,
            address TEXT NULL,
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
      DELETE FROM schools
      WHERE id = $1
      RETURNING id, school_name, type, institute_number, db_name, status, created_at
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
      deleted_at: new Date(),
      tenant_db_dropped: tenantDbDropped,
      tenant_db_drop_skipped_reason: tenantDbDropSkippedReason,
      tenant_db_drop_error: tenantDbDropError,
    });
  } catch (err) {
    console.error('Super Admin confirmDeleteSchool error:', err);
    return errorResponse(res, 500, 'Failed to remove school');
  }
};

/**
 * Super Admin: establish tenant session as first active Headmaster (else Administrative).
 */
const impersonateSchool = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return errorResponse(res, 400, 'Invalid school id');
    }

    const schoolRes = await masterQuery(
      `
      SELECT id, school_name, type, logo, institute_number, db_name, status, deleted_at
      FROM schools
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );
    if (!schoolRes.rows?.length) {
      return errorResponse(res, 404, 'School not found');
    }
    const school = schoolRes.rows[0];
    if (school.deleted_at) {
      return errorResponse(res, 400, 'School has been removed');
    }
    if (String(school.status || '').toLowerCase() === 'disabled') {
      return errorResponse(
        res,
        403,
        'School is disabled. Enable the school before using Login as school.'
      );
    }

    const adminRoleIds = [ROLES.ADMIN, ROLES.ADMINISTRATIVE];
    let pickedUser = null;
    let accountDisabled = false;

    await runWithTenant(school.db_name, async () => {
      const userResult = await query(
        `
        SELECT u.id, u.username, u.first_name, u.last_name, u.role_id, u.phone, u.avatar,
               ur.role_name,
               st.id AS staff_id, u.first_name AS staff_first_name, u.last_name AS staff_last_name
        FROM users u
        LEFT JOIN user_roles ur ON u.role_id = ur.id
        LEFT JOIN staff st ON u.id = st.user_id AND (st.deleted_at IS NULL AND LOWER(st.status) = 'active')
        WHERE u.is_active = true AND u.deleted_at IS NULL
          AND u.role_id = ANY($1::int[])
        ORDER BY CASE u.role_id WHEN $2 THEN 0 WHEN $3 THEN 1 ELSE 2 END, u.id ASC
        LIMIT 1
        `,
        [adminRoleIds, ROLES.ADMIN, ROLES.ADMINISTRATIVE]
      );
      if (!userResult.rows?.length) {
        return;
      }
      pickedUser = userResult.rows[0];

      try {
        const accCheck = await query(
          `SELECT s.id AS student_id, s.is_active AS student_is_active, st.id AS staff_id, (st.deleted_at IS NULL AND LOWER(st.status) = 'active') AS staff_is_active
           FROM users u
           LEFT JOIN students s ON u.id = s.user_id
           LEFT JOIN staff st ON u.id = st.user_id
           WHERE u.id = $1`,
          [pickedUser.id]
        );
        if (accCheck.rows.length > 0) {
          const r = accCheck.rows[0];
          const sid = r.student_id;
          const sActive = r.student_is_active;
          const tid = r.staff_id;
          const tActive = r.staff_is_active;
          const studentInactive = sid != null && (sActive === false || sActive === 'f' || sActive === 0);
          const staffInactive = tid != null && (tActive === false || tActive === 'f' || tActive === 0);
          accountDisabled = !!studentInactive || !!staffInactive;
        }
      } catch {
        accountDisabled = false;
      }
    });

    if (!pickedUser) {
      return errorResponse(
        res,
        400,
        'No active Headmaster or Administrative user found in this school database'
      );
    }

    let responseData;
    try {
      responseData = await issueTenantSessionForUser(req, res, {
        school: {
          id: school.id,
          school_name: school.school_name,
          type: school.type,
          institute_number: school.institute_number,
          logo: school.logo,
        },
        user: pickedUser,
        targetDbName: school.db_name,
        accountDisabled,
      });
    } catch (e) {
      console.error('impersonateSchool session issue failed:', e);
      return errorResponse(res, 500, 'Could not start tenant session');
    }

    await writeSuperAdminAudit({
      superAdminId: req.superAdmin?.id,
      action: 'school_impersonation',
      resourceType: 'school',
      resourceId: String(id),
      details: { target_user_id: pickedUser.id, institute_number: school.institute_number },
      req,
    });

    return success(res, 200, 'Logged in as school user', {
      ...responseData,
      impersonation: true,
      institute_number: school.institute_number,
    });
  } catch (err) {
    console.error('Super Admin impersonateSchool error:', err);
    return errorResponse(res, 500, 'Failed to impersonate school');
  }
};

const updateSchoolPlan = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return errorResponse(res, 400, 'Invalid school id');
    }
    const { plan_id } = req.body || {};
    let pid = null;
    if (plan_id !== undefined && plan_id !== null && String(plan_id).trim() !== '') {
      pid = parseInt(String(plan_id), 10);
      if (Number.isNaN(pid)) {
        return errorResponse(res, 400, 'Invalid plan id');
      }
      const pr = await masterQuery(`SELECT id FROM saas_plans WHERE id = $1 AND is_active = TRUE LIMIT 1`, [
        pid,
      ]);
      if (!pr.rows?.length) {
        return errorResponse(res, 400, 'Plan not found or inactive');
      }
    }

    const upd = await masterQuery(
      `
      UPDATE schools
      SET plan_id = $1
      WHERE id = $2 AND deleted_at IS NULL
      RETURNING id, school_name, type, institute_number, db_name, status, created_at, plan_id
      `,
      [pid, id]
    );
    if (!upd.rows?.length) {
      return errorResponse(res, 404, 'School not found');
    }

    await writeSuperAdminAudit({
      superAdminId: req.superAdmin?.id,
      action: 'school_plan_updated',
      resourceType: 'school',
      resourceId: String(id),
      details: { plan_id: pid },
      req,
    });

    return success(res, 200, 'School plan updated', upd.rows[0]);
  } catch (err) {
    console.error('Super Admin updateSchoolPlan error:', err);
    return errorResponse(res, 500, 'Failed to update school plan');
  }
};

const getSchoolModuleConfig = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return errorResponse(res, 400, 'Invalid school id');
    }
    const eff = await getEffectiveSchoolModules(id);
    let overrides = [];
    try {
      const ov = await masterQuery(
        `SELECT module_key, show_in_menu, route_accessible FROM school_module_overrides WHERE school_id = $1 ORDER BY module_key`,
        [id]
      );
      overrides = ov.rows || [];
    } catch {
      overrides = [];
    }
    return success(res, 200, 'School module configuration', {
      plan: eff.plan,
      effective: eff.modules,
      overrides,
    });
  } catch (err) {
    console.error('Super Admin getSchoolModuleConfig error:', err);
    return errorResponse(res, 500, 'Failed to load module configuration');
  }
};

const putSchoolModuleOverrides = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return errorResponse(res, 400, 'Invalid school id');
    }
    const { overrides } = req.body || {};
    if (!Array.isArray(overrides)) {
      return errorResponse(res, 400, 'overrides must be an array');
    }
    const sch = await masterQuery(`SELECT id FROM schools WHERE id = $1 AND deleted_at IS NULL LIMIT 1`, [id]);
    if (!sch.rows?.length) {
      return errorResponse(res, 404, 'School not found');
    }
    await replaceSchoolOverrides(
      id,
      overrides.map((r) => ({
        module_key: r.module_key,
        show_in_menu: !!r.show_in_menu,
        route_accessible: !!r.route_accessible,
      }))
    );
    await writeSuperAdminAudit({
      superAdminId: req.superAdmin?.id,
      action: 'school_module_overrides_updated',
      resourceType: 'school',
      resourceId: String(id),
      details: { count: overrides.length },
      req,
    });
    const eff = await getEffectiveSchoolModules(id);
    return success(res, 200, 'Overrides saved', { effective: eff.modules });
  } catch (err) {
    console.error('Super Admin putSchoolModuleOverrides error:', err);
    return errorResponse(res, 500, 'Failed to save overrides');
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
  impersonateSchool,
  updateSchoolPlan,
  getSchoolModuleConfig,
  putSchoolModuleOverrides,
};

