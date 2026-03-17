require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

// Server configuration - production requires explicit JWT_SECRET and CORS_ORIGIN
const serverConfig = {
  port: parseInt(process.env.PORT || '5000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: isProduction ? process.env.JWT_SECRET : (process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  // In production we require an explicit allowlist (no implicit localhost fallback).
  corsOrigin: isProduction ? (process.env.CORS_ORIGIN || '') : (process.env.CORS_ORIGIN || 'http://localhost:5173'),
  logLevel: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  // Backward-compat: allow legacy Bearer auth only if explicitly enabled.
  allowLegacyBearerAuth: String(process.env.ALLOW_LEGACY_BEARER_AUTH || '').toLowerCase() === 'true',
};

module.exports = serverConfig;
