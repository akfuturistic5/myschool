/**
 * Support DBs that have not run migration 003 (parents.father_user_id / mother_user_id).
 */

const SPLIT_COL_ERR = /father_user_id|mother_user_id/;

function isSplitColumnError(e) {
  return e && SPLIT_COL_ERR.test(String(e.message || ''));
}

/**
 * SELECT parent row user links by student_id.
 * @returns {Promise<{ id: number, father_user_id: number|null, mother_user_id: number|null, user_id: number|null }|null>}
 */
async function selectParentsUserLinksByStudentId(client, studentId) {
  try {
    const r = await client.query(
      `SELECT id, father_user_id, mother_user_id, user_id
       FROM parents WHERE student_id = $1 LIMIT 1`,
      [studentId]
    );
    return r.rows[0] || null;
  } catch (e) {
    if (!isSplitColumnError(e)) throw e;
    const r = await client.query(`SELECT id, user_id FROM parents WHERE student_id = $1 LIMIT 1`, [studentId]);
    const row = r.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      father_user_id: row.user_id ?? null,
      mother_user_id: null,
      user_id: row.user_id ?? null,
    };
  }
}

/**
 * After creating father/mother users on insert.
 */
async function updateParentsUserIdsOnCreate(client, parentRowId, fatherUserId, motherUserId) {
  try {
    await client.query(
      `UPDATE parents SET
        father_user_id = $1::integer,
        mother_user_id = $2::integer,
        user_id = COALESCE($1::integer, $2::integer),
        updated_at = NOW()
      WHERE id = $3::integer`,
      [fatherUserId, motherUserId, parentRowId]
    );
  } catch (e) {
    if (!isSplitColumnError(e)) throw e;
    await client.query(
      `UPDATE parents SET
        user_id = COALESCE($1::integer, $2::integer, user_id),
        updated_at = NOW()
      WHERE id = $3::integer`,
      [fatherUserId, motherUserId, parentRowId]
    );
  }
}

/**
 * After optional createParentIndividualUser on update.
 */
async function mergeParentsUserIdsOnUpdate(client, parentRowId, newFatherUserId, newMotherUserId) {
  try {
    await client.query(
      `UPDATE parents SET
        father_user_id = COALESCE($1::integer, father_user_id),
        mother_user_id = COALESCE($2::integer, mother_user_id),
        user_id = COALESCE(user_id, father_user_id, mother_user_id),
        updated_at = NOW()
      WHERE id = $3`,
      [newFatherUserId, newMotherUserId, parentRowId]
    );
  } catch (e) {
    if (!isSplitColumnError(e)) throw e;
    await client.query(
      `UPDATE parents SET
        user_id = COALESCE($1::integer, $2::integer, user_id),
        updated_at = NOW()
      WHERE id = $3`,
      [newFatherUserId, newMotherUserId, parentRowId]
    );
  }
}

/**
 * For deactivating linked parent logins when student leaves.
 */
async function selectParentUserIdsForDeactivate(client, parentId) {
  try {
    const pRes = await client.query(
      `SELECT father_user_id, mother_user_id, user_id FROM parents WHERE id = $1 LIMIT 1`,
      [parentId]
    );
    return pRes.rows[0] || null;
  } catch (e) {
    if (!isSplitColumnError(e)) throw e;
    const pRes = await client.query(`SELECT user_id FROM parents WHERE id = $1 LIMIT 1`, [parentId]);
    const row = pRes.rows[0];
    if (!row) return null;
    return {
      father_user_id: row.user_id ?? null,
      mother_user_id: null,
      user_id: row.user_id ?? null,
    };
  }
}

/**
 * SELECT by parents.id (e.g. after UPDATE … RETURNING id).
 */
async function selectParentsUserLinksByParentId(client, parentId) {
  try {
    const r = await client.query(
      `SELECT id, father_user_id, mother_user_id, user_id
       FROM parents WHERE id = $1 LIMIT 1`,
      [parentId]
    );
    return r.rows[0] || null;
  } catch (e) {
    if (!isSplitColumnError(e)) throw e;
    const r = await client.query(`SELECT id, user_id FROM parents WHERE id = $1 LIMIT 1`, [parentId]);
    const row = r.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      father_user_id: row.user_id ?? null,
      mother_user_id: null,
      user_id: row.user_id ?? null,
    };
  }
}

module.exports = {
  selectParentsUserLinksByStudentId,
  selectParentsUserLinksByParentId,
  updateParentsUserIdsOnCreate,
  mergeParentsUserIdsOnUpdate,
  selectParentUserIdsForDeactivate,
  isSplitColumnError,
};
