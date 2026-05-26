const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { masterQuery } = require('../config/database');
const serverConfig = require('../config/server');
const { secureCookieBase } = require('../utils/cookiePolicy');
const { getEffectiveSchoolModules } = require('./saasSchoolModulesService');

const AUTH_COOKIE_NAME = 'auth_token';
const SESSION_COOKIE_NAME = 'sid';

function newOpaqueSessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function sha256Hex(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

function getAuthCookieOptions() {
  const { sameSite, secure } = secureCookieBase();
  const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
  return {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: maxAgeMs,
    path: '/',
  };
}

function getSessionCookieOptions() {
  const { sameSite, secure } = secureCookieBase();
  const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
  return {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: maxAgeMs,
    path: '/',
  };
}

function getCsrfCookieOptions() {
  const { sameSite, secure } = secureCookieBase();
  return {
    httpOnly: false,
    secure,
    sameSite,
    path: '/',
  };
}

/**
 * Issues tenant JWT + sid session row + cookies (same contract as normal login).
 * @param {object} params
 * @param {import('express').Request} params.req
 * @param {import('express').Response} params.res
 * @param {object} params.school master_db.schools row fragment: id, school_name, type, institute_number, db_name, logo
 * @param {object} params.user tenant users row fragment from login query shape
 * @param {string} params.targetDbName
 * @param {boolean} [params.accountDisabled]
 */
async function issueTenantSessionForUser(req, res, { school, user, targetDbName, accountDisabled = false }) {
  if (!serverConfig.jwtUserSecret) {
    throw new Error('JWT user secret not configured');
  }

  const payload = {
    id: user.id,
    username: user.username,
    role_id: user.role_id,
    role_name: user.role_name || 'User',
    db_name: targetDbName,
    school_id: school.id,
    school_name: school.school_name,
    school_type: school.type,
    school_logo: school.logo || null,
    institute_number: school.institute_number,
  };

  const token = jwt.sign(payload, serverConfig.jwtUserSecret, {
    expiresIn: serverConfig.jwtExpiresIn || '7d',
  });

  const displayName = (user.staff_first_name || user.first_name)
    ? `${user.staff_first_name || user.first_name} ${user.staff_last_name || user.last_name}`.trim()
    : user.username;

  const sessionToken = newOpaqueSessionToken();
  const sessionHash = sha256Hex(sessionToken);
  const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + maxAgeMs);

  await masterQuery(
    `
    INSERT INTO tenant_sessions (session_hash, school_id, institute_number, db_name, tenant_user_id, expires_at, user_agent, ip_address)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [
      sessionHash,
      school.id,
      school.institute_number,
      targetDbName,
      user.id,
      expiresAt,
      String(req.headers['user-agent'] || '').slice(0, 2000) || null,
      String(req.headers['x-forwarded-for'] || req.ip || '').slice(0, 100) || null,
    ]
  );

  res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
  res.cookie(SESSION_COOKIE_NAME, sessionToken, getSessionCookieOptions());

  const csrfToken = crypto.randomBytes(16).toString('base64url');
  res.cookie('XSRF-TOKEN', csrfToken, getCsrfCookieOptions());

  let saas_modules = null;
  try {
    const eff = await getEffectiveSchoolModules(school.id);
    saas_modules = eff.modules;
  } catch {
    /* optional tables */
  }

  const responseData = {
    csrfToken,
    user: {
      id: user.id,
      username: user.username,
      avatar: user.avatar ?? null,
      displayName,
      role: user.role_name || 'User',
      role_id: user.role_id,
      staff_id: user.staff_id,
      accountDisabled: !!accountDisabled,
      school_name: school.school_name,
      school_type: school.type,
      school_logo: school.logo || null,
      institute_number: school.institute_number,
      saas_modules,
    },
  };

  if (serverConfig.tenantBearerAuthInProduction || serverConfig.allowLegacyBearerAuth) {
    responseData.accessToken = token;
  }

  return responseData;
}

/**
 * Re-issue auth_token cookie when DB role changed but JWT is stale (e.g. staff role sync).
 * Does not rotate sid — existing session stays valid.
 */
function refreshTenantJwtCookie(req, res, { school, user, targetDbName }) {
  if (!serverConfig.jwtUserSecret) {
    return null;
  }
  const payload = {
    id: user.id,
    username: user.username,
    role_id: user.role_id,
    role_name: user.role_name || 'User',
    db_name: targetDbName,
    school_id: school.id,
    school_name: school.school_name,
    school_type: school.type,
    school_logo: school.logo || null,
    institute_number: school.institute_number,
  };
  const token = jwt.sign(payload, serverConfig.jwtUserSecret, {
    expiresIn: serverConfig.jwtExpiresIn || '7d',
  });
  res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
  return token;
}

module.exports = {
  issueTenantSessionForUser,
  refreshTenantJwtCookie,
  AUTH_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  getAuthCookieOptions,
  getSessionCookieOptions,
  getCsrfCookieOptions,
};
