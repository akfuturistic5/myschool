require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

// Server configuration - production: DATABASE_URL + strong JWT_SECRET_SUPER_ADMIN + user secret (JWT_SECRET_USER or JWT_SECRET); CORS_ORIGIN for cross-origin SPAs
const serverConfig = {
  port: parseInt(process.env.PORT || '5000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtUserSecret: process.env.JWT_SECRET_USER || process.env.JWT_SECRET || '',
  jwtSuperAdminSecret: process.env.JWT_SECRET_SUPER_ADMIN || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  // In production we require an explicit allowlist (no implicit localhost fallback).
  corsOrigin: isProduction ? (process.env.CORS_ORIGIN || '') : (process.env.CORS_ORIGIN || 'http://localhost:5173'),
  logLevel: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  // Dev-only: Authorization Bearer for tenant API (testing).
  allowLegacyBearerAuth:
    !isProduction && String(process.env.ALLOW_LEGACY_BEARER_AUTH || '').toLowerCase() === 'true',
  // Production: split SPA/API (different origins). Cookies may not attach; signed JWT in Authorization + master_db school check.
  tenantBearerAuthInProduction:
    isProduction && String(process.env.TENANT_BEARER_AUTH || '').toLowerCase() === 'true',
  allowSuperAdminBearerAuth:
    !isProduction && String(process.env.ALLOW_SUPER_ADMIN_BEARER_AUTH || '').toLowerCase() === 'true',
};

module.exports = serverConfig;
