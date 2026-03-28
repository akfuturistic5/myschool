// Load env first (local .env; on Render, env is injected by platform)
require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Import configurations
const serverConfig = require('./src/config/server');
const { testConnection } = require('./src/config/database');
const { error: errorResponse } = require('./src/utils/responseHelper');

// Import routes
const healthRoutes = require('./src/routes/healthRoutes');
const academicYearRoutes = require('./src/routes/academicYearRoutes');
const classRoutes = require('./src/routes/classRoutes');
const sectionRoutes = require('./src/routes/sectionRoutes');
const subjectRoutes = require('./src/routes/subjectRoutes');
const teacherRoutes = require('./src/routes/teacherRoutes');
const studentRoutes = require('./src/routes/studentRoutes');
const bloodGroupRoutes = require('./src/routes/bloodGroupRoutes');
const religionRoutes = require('./src/routes/religionRoutes');
const castRoutes = require('./src/routes/castRoutes');
const motherTongueRoutes = require('./src/routes/motherTongueRoutes');
const parentRoutes = require('./src/routes/parentRoutes');
const guardianRoutes = require('./src/routes/guardianRoutes');
const houseRoutes = require('./src/routes/houseRoutes');
const addressRoutes = require('./src/routes/addressRoutes');
const transportRoutes = require('./src/routes/transportRoutes');
const classScheduleRoutes = require('./src/routes/classScheduleRoutes');
const classRoomRoutes = require('./src/routes/classRoomRoutes');
const scheduleRoutes = require('./src/routes/scheduleRoutes');
const hostelRoutes = require('./src/routes/hostelRoutes');
const hostelRoomRoutes = require('./src/routes/hostelRoomRoutes');
const roomTypeRoutes = require('./src/routes/roomTypeRoutes');
const staffRoutes = require('./src/routes/staffRoutes');
const departmentRoutes = require('./src/routes/departmentRoutes');
const designationRoutes = require('./src/routes/designationRoutes');
const userRoutes = require('./src/routes/userRoutes');
const userRoleRoutes = require('./src/routes/userRoleRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const leaveApplicationRoutes = require('./src/routes/leaveApplicationRoutes');
const authRoutes = require('./src/routes/authRoutes');
const chatRoutes = require('./src/routes/chatRoutes');
const callRoutes = require('./src/routes/callRoutes');
const calendarRoutes = require('./src/routes/calendarRoutes');
const emailRoutes = require('./src/routes/emailRoutes');
const todoRoutes = require('./src/routes/todoRoutes');
const notesRoutes = require('./src/routes/notesRoutes');
const fileRoutes = require('./src/routes/fileRoutes');
const syllabusRoutes = require('./src/routes/syllabusRoutes');
const noticeBoardRoutes = require('./src/routes/noticeBoardRoutes');
const eventsRoutes = require('./src/routes/eventsRoutes');
const feeRoutes = require('./src/routes/feeRoutes');
const superAdminAuthRoutes = require('./src/routes/superAdminAuthRoutes');
const superAdminRoutes = require('./src/routes/superAdminRoutes');
const schoolProfileRoutes = require('./src/routes/schoolProfileRoutes');
const { protectApi } = require('./src/middleware/authMiddleware');
const { requireActiveAccount } = require('./src/middleware/requireActiveAccount');

// Create Express app
const app = express();

// When running behind a proxy/load balancer (Render, Nginx, etc.),
// trust the X-Forwarded-* headers so express-rate-limit can identify
// the real client IP instead of the proxy IP.
// This also fixes ERR_ERL_UNEXPECTED_X_FORWARDED_FOR in production.
app.set('trust proxy', 1);

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", 'https:'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https:'],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'no-referrer' },
})); // Security headers
app.use(cookieParser());
const isProduction = process.env.NODE_ENV === 'production';
// Logging: quieter and safer in production.
app.use(morgan(isProduction ? 'combined' : 'dev', { skip: (req) => req.method === 'OPTIONS' }));
// CORS: production = explicit origins from CORS_ORIGIN, dev = localhost
const defaultDevOrigins = ['http://localhost:3000', 'http://localhost:5173'];
const allowedOrigins = serverConfig.corsOrigin
  ? serverConfig.corsOrigin.split(',').map((s) => s.trim()).filter(Boolean)
  : [];
const devOrigins = Array.from(new Set([...defaultDevOrigins, ...allowedOrigins]));
const corsOptions = {
  origin: isProduction
    ? (allowedOrigins.length > 0 ? allowedOrigins : false)
    : devOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-XSRF-TOKEN', 'X-CSRF-TOKEN'],
};
app.use(cors(corsOptions));
if (isProduction) {
  const { secureCookieBase } = require('./src/utils/cookiePolicy');
  const cp = secureCookieBase();
  console.log(`[cookies] SameSite=${cp.sameSite} Secure=${cp.secure} (COOKIE_SAME_SITE / CORS_ORIGIN affect session cookies)`);
}
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CSRF (double-submit cookie) for cookie-authenticated SPA.
// Requires frontend to send X-XSRF-TOKEN header matching XSRF-TOKEN cookie for unsafe methods.
const enforceCsrf = (req, res, next) => {
  const method = (req.method || 'GET').toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return next();
  // Public auth endpoints are exempt (login establishes cookies).
  if (
    req.path.startsWith('/api/auth/login') ||
    req.path.startsWith('/super-admin/api/auth/login')
  ) return next();
  const cookieToken = req.cookies?.['XSRF-TOKEN'];
  const headerToken = req.headers['x-xsrf-token'] || req.headers['x-csrf-token'];
  if (!cookieToken || !headerToken || String(cookieToken) !== String(headerToken)) {
    return errorResponse(res, 403, 'CSRF validation failed');
  }
  return next();
};
app.use(enforceCsrf);

// Login rate limiting - stricter (10 attempts per 15 min per IP)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '10', 10),
  message: { status: 'ERROR', message: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', loginLimiter);
app.use('/super-admin/api/auth/login', loginLimiter);

// Global API rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || '500', 10),
  message: { status: 'ERROR', message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health' || req.path === '/api/health/database'
});
app.use('/api', limiter);
app.use('/super-admin/api', limiter);

// Auth routes - public, no token needed
app.use('/api/auth', authRoutes);
// Super Admin auth & API (master_db only, no tenant context)
app.use('/super-admin/api/auth', superAdminAuthRoutes);
app.use('/super-admin/api', superAdminRoutes);
app.use('/api', healthRoutes);

// Protect all other API routes - require valid JWT; then block inactive student/teacher accounts (except /auth/me)
app.use('/api', protectApi, (req, res, next) => requireActiveAccount(req, res, next).catch(next));
app.use('/api/academic-years', academicYearRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/blood-groups', bloodGroupRoutes);
app.use('/api/religions', religionRoutes);
app.use('/api/casts', castRoutes);
app.use('/api/mother-tongues', motherTongueRoutes);
app.use('/api/parents', parentRoutes);
app.use('/api/guardians', guardianRoutes);
app.use('/api/houses', houseRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/transport', transportRoutes);
app.use('/api/class-schedules', classScheduleRoutes);
app.use('/api/class-rooms', classRoomRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/hostels', hostelRoutes);
app.use('/api/hostel-rooms', hostelRoomRoutes);
app.use('/api/room-types', roomTypeRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/designations', designationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/user-roles', userRoleRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/leave-applications', leaveApplicationRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/class-syllabus', syllabusRoutes);
app.use('/api/notice-board', noticeBoardRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/school/profile', schoolProfileRoutes);

// Lightweight public health check (no DB, no auth, always 200)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'backend',
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to PreSkool School Management API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  errorResponse(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
});

// Global error handler - never leak internal error details to client
const { globalErrorHandler } = require('./src/utils/errorHandler');
app.use(globalErrorHandler);

// Start server
const startServer = async () => {
  try {
    // Production: require DATABASE_URL (no localhost fallback)
    const nodeEnv = process.env.NODE_ENV || 'development';
    if (nodeEnv === 'production') {
      if (!process.env.DATABASE_URL) {
        console.error('❌ Production requires DATABASE_URL. Add it in Render → Environment.');
        process.exit(1);
      }
      // Align with serverConfig: user token may use JWT_SECRET_USER or legacy JWT_SECRET; super-admin must be explicit.
      const userSecretLen = (process.env.JWT_SECRET_USER || process.env.JWT_SECRET || '').length;
      const superSecretLen = (process.env.JWT_SECRET_SUPER_ADMIN || '').length;
      if (userSecretLen < 32 || superSecretLen < 32) {
        console.error(
          '❌ Production requires strong JWT secrets: JWT_SECRET_SUPER_ADMIN (32+ chars) and JWT_SECRET_USER or JWT_SECRET (32+ chars).'
        );
        process.exit(1);
      }
      if (allowedOrigins.length === 0) {
        console.warn(
          '⚠️  CORS_ORIGIN is empty. If the SPA runs on another domain (e.g. Vercel), set CORS_ORIGIN to that origin or requests will fail. Same-origin deployments can ignore this.'
        );
      }
    }
    if (!serverConfig.jwtUserSecret || !serverConfig.jwtSuperAdminSecret) {
      console.error('❌ JWT secrets are required for startup.');
      process.exit(1);
    }
    if (serverConfig.jwtUserSecret.length < 32 || serverConfig.jwtSuperAdminSecret.length < 32) {
      console.error('❌ JWT secrets must be at least 32 characters long.');
      process.exit(1);
    }

    // Test database connection (without crashing from health path behavior).
    console.log('🔍 Testing database connection...');
    const dbConnected = await testConnection();
    if (!dbConnected && nodeEnv === 'production') {
      console.error('❌ Startup database connectivity check failed.');
      process.exit(1);
    }

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log('🚀 Server is running!');
      console.log(`📍 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${serverConfig.nodeEnv}`);
      console.log('📋 Available endpoints:');
      console.log(`   GET  http://localhost:${serverConfig.port}/`);
      console.log(`   GET  http://localhost:${serverConfig.port}/api/health`);
      console.log(`   GET  http://localhost:${serverConfig.port}/api/health/database`);
      console.log(`   GET  http://localhost:${serverConfig.port}/api/academic-years`);
      console.log(`   GET  http://localhost:${serverConfig.port}/api/academic-years/:id`);
      console.log(`   GET  http://localhost:${serverConfig.port}/api/classes`);
      console.log(`   GET  http://localhost:${serverConfig.port}/api/classes/:id`);
      console.log(`   GET  http://localhost:${serverConfig.port}/api/sections`);
      console.log(`   GET  http://localhost:${serverConfig.port}/api/sections/:id`);
      console.log(`   GET  http://localhost:${serverConfig.port}/api/subjects`);
      console.log(`   GET  http://localhost:${serverConfig.port}/api/subjects/:id`);
      console.log(`   GET  http://localhost:${serverConfig.port}/api/subjects/class/:classId`);
      console.log(`   GET  http://localhost:${serverConfig.port}/api/teachers`);
      console.log(`   GET  http://localhost:${serverConfig.port}/api/teachers/:id`);
      console.log(`   GET  http://localhost:${serverConfig.port}/api/teachers/class/:classId`);
      console.log(`   GET  http://localhost:${serverConfig.port}/api/students`);
      console.log(`   GET  http://localhost:${serverConfig.port}/api/students/:id`);
      console.log(`   GET  http://localhost:${serverConfig.port}/api/students/class/:classId`);
      console.log(`   GET  http://localhost:${serverConfig.port}/api/blood-groups`);
      console.log(`   GET  http://localhost:${serverConfig.port}/api/blood-groups/:id`);
      console.log(`   GET  http://localhost:${serverConfig.port}/api/religions`);
      console.log(`   GET  http://localhost:${serverConfig.port}/api/religions/:id`);
      console.log(`   GET  http://localhost:${serverConfig.port}/api/casts`);
      console.log(`   GET  http://localhost:${serverConfig.port}/api/casts/:id`);
      console.log(`   GET  http://localhost:${serverConfig.port}/api/mother-tongues`);
      console.log(`   GET  http://localhost:${serverConfig.port}/api/mother-tongues/:id`);
      console.log(`   GET  http://localhost:${serverConfig.port}/api/houses`);
      console.log(`   GET  http://localhost:${serverConfig.port}/api/houses/:id`);
      console.log(`   GET  http://localhost:${serverConfig.port}/api/addresses`);
      console.log(`   GET  http://localhost:${serverConfig.port}/api/addresses/:id`);
      console.log(`   GET  http://localhost:${serverConfig.port}/api/addresses/user/:userId`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason instanceof Error ? reason.message : reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err?.message || 'Unknown error');
});

// Start the server
startServer();
