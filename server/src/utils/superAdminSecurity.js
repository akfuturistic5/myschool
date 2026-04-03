const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { masterQuery } = require('../config/database');
const serverConfig = require('../config/server');

const DELETE_TOKEN_TYP = 'school_delete';
const DELETE_TOKEN_TTL_SEC = 5 * 60;

async function verifySuperAdminPassword(superAdminId, password) {
  const id = parseInt(String(superAdminId), 10);
  if (!Number.isFinite(id) || id < 1) return false;
  const r = await masterQuery(
    `
    SELECT password_hash
    FROM super_admin_users
    WHERE id = $1
      AND (is_active IS DISTINCT FROM false)
    LIMIT 1
    `,
    [id]
  );
  const hash = r.rows?.[0]?.password_hash;
  if (!hash) return false;
  try {
    return await bcrypt.compare(String(password || ''), String(hash));
  } catch {
    return false;
  }
}

function signSchoolDeleteToken(schoolId, superAdminId) {
  if (!serverConfig.jwtSuperAdminSecret) {
    throw new Error('Super Admin JWT secret not configured');
  }
  return jwt.sign(
    {
      typ: DELETE_TOKEN_TYP,
      schoolId: parseInt(String(schoolId), 10),
      sub: parseInt(String(superAdminId), 10),
    },
    serverConfig.jwtSuperAdminSecret,
    { expiresIn: DELETE_TOKEN_TTL_SEC }
  );
}

function verifySchoolDeleteToken(token) {
  const decoded = jwt.verify(token, serverConfig.jwtSuperAdminSecret);
  if (!decoded || decoded.typ !== DELETE_TOKEN_TYP) {
    const e = new Error('Invalid delete token');
    e.statusCode = 400;
    throw e;
  }
  return {
    schoolId: parseInt(String(decoded.schoolId), 10),
    superAdminId: parseInt(String(decoded.sub), 10),
  };
}

async function writeSuperAdminAudit({
  superAdminId,
  action,
  resourceType = null,
  resourceId = null,
  details = null,
  req = null,
}) {
  try {
    const ip =
      req && (String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || '');
    const ua = req && String(req.headers['user-agent'] || '').slice(0, 2000);
    await masterQuery(
      `
      INSERT INTO super_admin_audit_log
        (super_admin_id, action, resource_type, resource_id, details, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
      `,
      [
        superAdminId,
        String(action).slice(0, 96),
        resourceType ? String(resourceType).slice(0, 64) : null,
        resourceId != null ? String(resourceId).slice(0, 128) : null,
        details != null ? JSON.stringify(details) : null,
        ip ? ip.slice(0, 100) : null,
        ua || null,
      ]
    );
  } catch (e) {
    console.error('[audit] super_admin_audit_log write failed:', e.message);
  }
}

module.exports = {
  verifySuperAdminPassword,
  signSchoolDeleteToken,
  verifySchoolDeleteToken,
  writeSuperAdminAudit,
  DELETE_TOKEN_TYP,
  DELETE_TOKEN_TTL_SEC,
};
