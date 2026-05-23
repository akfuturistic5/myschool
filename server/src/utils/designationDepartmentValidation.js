/**
 * Validates that a designation belongs to a department (designations.department_id).
 * Used by staff/teacher create & update to prevent mismatched FK pairs.
 */

function parsePositiveIntId(raw) {
  const id = parseInt(String(raw), 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * @param {Function} queryFn - `query` or `client.query`
 * @param {number} designationId
 * @param {number} departmentId
 * @throws {Error} with `.code` in INVALID_DESIGNATION | DESIGNATION_NO_DEPARTMENT | DESIGNATION_DEPARTMENT_MISMATCH
 */
async function assertDesignationBelongsToDepartment(queryFn, designationId, departmentId) {
  const desigId = parsePositiveIntId(designationId);
  const deptId = parsePositiveIntId(departmentId);
  if (!desigId || !deptId) {
    const err = new Error('INVALID_IDS');
    err.code = 'INVALID_IDS';
    throw err;
  }

  const r = await queryFn(
    `SELECT id, department_id FROM designations WHERE id = $1 LIMIT 1`,
    [desigId]
  );
  if (!r.rows.length) {
    const err = new Error('INVALID_DESIGNATION');
    err.code = 'INVALID_DESIGNATION';
    throw err;
  }

  const rowDeptId =
    r.rows[0].department_id != null ? parsePositiveIntId(r.rows[0].department_id) : null;

  if (rowDeptId == null) {
    const err = new Error('DESIGNATION_NO_DEPARTMENT');
    err.code = 'DESIGNATION_NO_DEPARTMENT';
    throw err;
  }

  if (rowDeptId !== deptId) {
    const err = new Error('DESIGNATION_DEPARTMENT_MISMATCH');
    err.code = 'DESIGNATION_DEPARTMENT_MISMATCH';
    throw err;
  }
}

function mapDesignationDepartmentError(code) {
  switch (code) {
    case 'INVALID_DESIGNATION':
      return { status: 400, message: 'Designation does not exist', code: 'INVALID_DESIGNATION' };
    case 'DESIGNATION_NO_DEPARTMENT':
      return {
        status: 400,
        message: 'This designation is not linked to a department. Update it in HRM Designations first.',
        code: 'DESIGNATION_NO_DEPARTMENT',
      };
    case 'DESIGNATION_DEPARTMENT_MISMATCH':
      return {
        status: 400,
        message: 'Selected designation does not belong to the selected department',
        code: 'DESIGNATION_DEPARTMENT_MISMATCH',
      };
    default:
      return { status: 400, message: 'Invalid department or designation', code: 'VALIDATION_ERROR' };
  }
}

module.exports = {
  parsePositiveIntId,
  assertDesignationBelongsToDepartment,
  mapDesignationDepartmentError,
};
