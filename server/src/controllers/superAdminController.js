const { masterQuery } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const {
  generateTenantDbName,
  createTenantDatabase,
  dropTenantDatabaseIfExists,
  createHeadmasterUserInTenant,
  getTemplateDbName,
} = require('../services/tenantProvisioningService');

/**
 * List all schools from master_db.schools.
 * Optionally filter by status via ?status=active|disabled.
 */
const listSchools = async (req, res) => {
  try {
    const { status } = req.query || {};
    const filters = [];
    const params = [];

    if (status) {
      filters.push('status = $1');
      params.push(String(status).trim());
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await masterQuery(
      `
        SELECT
          id,
          school_name,
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
          institute_number,
          db_name,
          status,
          created_at
        FROM schools
        WHERE id = $1
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
        WHERE id = $2
        RETURNING
          id,
          school_name,
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
    const totalRes = await masterQuery('SELECT COUNT(*)::INT AS total_schools FROM schools');
    const activeRes = await masterQuery(
      `SELECT COUNT(*)::INT AS total_active_schools FROM schools WHERE status = 'active'`
    );
    const disabledRes = await masterQuery(
      `SELECT COUNT(*)::INT AS total_disabled_schools FROM schools WHERE status = 'disabled'`
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
  const { school_name, institute_number, admin_name, admin_email, admin_password } = req.body || {};

  if (!school_name || !institute_number || !admin_name || !admin_email || !admin_password) {
    return errorResponse(res, 400, 'Missing required fields');
  }

  const institute = String(institute_number).trim();
  const name = String(school_name).trim();

  if (!institute) {
    return errorResponse(res, 400, 'Institute number is required');
  }

  let existing;
  try {
    existing = await masterQuery(
      `
      SELECT id, institute_number, db_name
      FROM schools
      WHERE institute_number = $1
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

  const dbName = generateTenantDbName(institute);

  try {
    await createTenantDatabase(dbName);
  } catch (err) {
    console.error('Super Admin createSchool: tenant DB creation failed:', err);
    return errorResponse(res, 500, err.message || 'Failed to create tenant database');
  }

  let schoolRow;
  try {
    const insertRes = await masterQuery(
      `
      INSERT INTO schools (school_name, institute_number, db_name, status)
      VALUES ($1, $2, $3, 'active')
      RETURNING id, school_name, institute_number, db_name, status, created_at
      `,
      [name, institute, dbName]
    );
    schoolRow = insertRes.rows[0];
  } catch (err) {
    console.error('Super Admin createSchool: failed to insert into master_db.schools, rolling back DB:', err);
    try {
      await dropTenantDatabaseIfExists(dbName);
    } catch (dropErr) {
      console.error('Super Admin createSchool: failed to drop tenant DB after master insert error:', dropErr);
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

    const { school_name, institute_number } = req.body || {};

    if (!school_name && !institute_number) {
      return errorResponse(res, 400, 'No fields to update');
    }

    const currentRes = await masterQuery(
      `
      SELECT id, school_name, institute_number, db_name, status, created_at
      FROM schools
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );
    if (!currentRes.rows || currentRes.rows.length === 0) {
      return errorResponse(res, 404, 'School not found');
    }
    const current = currentRes.rows[0];

    const nextName = school_name ? String(school_name).trim() : current.school_name;
    const nextInstitute = institute_number ? String(institute_number).trim() : current.institute_number;

    if (!nextInstitute) {
      return errorResponse(res, 400, 'Institute number is required');
    }

    if (nextInstitute !== current.institute_number) {
      const dupRes = await masterQuery(
        `
        SELECT 1
        FROM schools
        WHERE institute_number = $1 AND id <> $2
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
          institute_number = $2
      WHERE id = $3
      RETURNING id, school_name, institute_number, db_name, status, created_at
      `,
      [nextName, nextInstitute, id]
    );

    return success(res, 200, 'School updated successfully', updateRes.rows[0]);
  } catch (err) {
    console.error('Super Admin updateSchoolMetadata error:', err);
    return errorResponse(res, 500, 'Failed to update school');
  }
};

/**
 * Delete a school completely:
 * - Drop its tenant database
 * - Remove row from master_db.schools
 *
 * For safety, prevents deleting the primary template school (DB_NAME / DATABASE_URL db).
 */
const deleteSchool = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return errorResponse(res, 400, 'Invalid school id');
    }

    const schoolRes = await masterQuery(
      `
      SELECT id, school_name, institute_number, db_name, status, created_at
      FROM schools
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );
    if (!schoolRes.rows || schoolRes.rows.length === 0) {
      return errorResponse(res, 404, 'School not found');
    }
    const school = schoolRes.rows[0];

    const templateDbName = getTemplateDbName();
    if (school.db_name === templateDbName) {
      return errorResponse(res, 400, 'Cannot delete primary template school');
    }

    try {
      await dropTenantDatabaseIfExists(school.db_name);
    } catch (err) {
      console.error('Super Admin deleteSchool: failed to drop tenant database:', err);
      return errorResponse(
        res,
        500,
        'Failed to drop tenant database for this school. Delete aborted to keep data consistent.'
      );
    }

    const delRes = await masterQuery(
      `
      DELETE FROM schools
      WHERE id = $1
      RETURNING id, school_name, institute_number, db_name, status, created_at
      `,
      [id]
    );

    return success(res, 200, 'School deleted successfully', delRes.rows[0]);
  } catch (err) {
    console.error('Super Admin deleteSchool error:', err);
    return errorResponse(res, 500, 'Failed to delete school');
  }
};

module.exports = {
  listSchools,
  getSchoolById,
  updateSchoolStatus,
  getPlatformStats,
  createSchool,
  updateSchoolMetadata,
  deleteSchool,
};

