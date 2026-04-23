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
const { testConnection, closePool } = require('./src/config/database');
const { error: errorResponse } = require('./src/utils/responseHelper');

// Import routes
const healthRoutes = require('./src/routes/healthRoutes');
const academicYearRoutes = require('./src/routes/academicYearRoutes');
const classRoutes = require('./src/routes/classRoutes');
const sectionRoutes = require('./src/routes/sectionRoutes');
const subjectRoutes = require('./src/routes/subjectRoutes');
const attendanceRoutes = require('./src/routes/attendanceRoutes');
const holidayRoutes = require('./src/routes/holidayRoutes');
const teacherRoutes = require('./src/routes/teacherRoutes');
const teacherAssignmentRoutes = require('./src/routes/teacherAssignmentRoutes');
const studentRoutes = require('./src/routes/studentRoutes');
const bloodGroupRoutes = require('./src/routes/bloodGroupRoutes');
const religionRoutes = require('./src/routes/religionRoutes');
const castRoutes = require('./src/routes/castRoutes');
const motherTongueRoutes = require('./src/routes/motherTongueRoutes');
const parentRoutes = require('./src/routes/parentRoutes');
const parentPersonRoutes = require('./src/routes/parentPersonRoutes');
const guardianRoutes = require('./src/routes/guardianRoutes');
const houseRoutes = require('./src/routes/houseRoutes');
const addressRoutes = require('./src/routes/addressRoutes');
const transportRoutes = require('./src/routes/transportRoutes');
const driverPortalRoutes = require('./src/routes/driverPortalRoutes');
const classScheduleRoutes = require('./src/routes/classScheduleRoutes');
const timetableRoutes = require('./src/routes/timetableRoutes');
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
const storageRoutes = require('./src/routes/storageRoutes');
const uploadRoutes = require('./src/routes/uploadRoutes');
const syllabusRoutes = require('./src/routes/syllabusRoutes');
const noticeBoardRoutes = require('./src/routes/noticeBoardRoutes');
const eventsRoutes = require('./src/routes/eventsRoutes');
const feeRoutes = require('./src/routes/feeRoutes');
const feesGroupRoutes = require('./src/routes/feesGroupRoutes');
const feesTypeRoutes = require('./src/routes/feesTypeRoutes');
const feesMasterRoutes = require('./src/routes/feesMasterRoutes');
const feesAssignRoutes = require('./src/routes/feesAssignRoutes');
const feesCollectRoutes = require('./src/routes/feesCollectRoutes');
const superAdminAuthRoutes = require('./src/routes/superAdminAuthRoutes');
const superAdminRoutes = require('./src/routes/superAdminRoutes');
const schoolProfileRoutes = require('./src/routes/schoolProfileRoutes');
const bonafideRoutes = require('./src/routes/bonafideRoutes');
const libraryRoutes = require('./src/routes/libraryRoutes');
const accountsRoutes = require('./src/routes/accountsRoutes');
const examModuleRoutes = require('./src/routes/examModuleRoutes');
const examSubjectsRoutes = require('./src/routes/examSubjectsRoutes');
const settingsRoutes = require('./src/routes/settingsRoutes');
const enquiryRoutes = require('./src/routes/enquiryRoutes');
const settingsController = require('./src/controllers/settingsController');
const { protectApi } = require('./src/middleware/authMiddleware');
const { requireActiveAccount } = require('./src/middleware/requireActiveAccount');

// Create Express app
const app = express();
let httpServer = null;
let shuttingDown = false;
// Avoid 304 + empty body on API GETs (breaks fetch().ok and JSON parse for /auth/me, etc.)
app.set('etag', false);

// When running behind a proxy/load balancer (Render, Nginx, etc.),
// trust the X-Forwarded-* headers so express-rate-limit can identify
// the real client IP instead of the proxy IP.
// Trust proxy hops: 1 = single LB (default). TRUST_PROXY=false disables. TRUST_PROXY_HOPS=N for chains.
const trustProxyEnv = String(process.env.TRUST_PROXY || '').toLowerCase();
if (trustProxyEnv === 'false' || trustProxyEnv === '0') {
  app.set('trust proxy', false);
} else {
  const hops = parseInt(process.env.TRUST_PROXY_HOPS || '1', 10);
  app.set('trust proxy', Number.isFinite(hops) && hops >= 0 ? hops : 1);
}

// JSON API: strict CSP (no script/eval). The React app sets its own CSP when served separately.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'no-referrer' },
  })
);
app.use(cookieParser());
const isProduction = process.env.NODE_ENV === 'production';
// Logging: keep dev verbose, but avoid noisy Apache-style access lines in production.
const shouldSkipRequestLog = (req, res) => {
  if (req.method === 'OPTIONS') return true;

  if (!isProduction) return false;

  const path = req.path || '';
  const status = Number(res.statusCode || 0);
  const isSuccess = status > 0 && status < 400;

  // These endpoints are hit frequently by the SPA and add little value to production logs.
  if (
    isSuccess &&
    (
      path === '/api/auth/me' ||
      path === '/api/auth/csrf-token' ||
      path === '/super-admin/api/auth/csrf-token' ||
      path === '/health' ||
      path.startsWith('/api/school/profile/logo/') ||
      path.startsWith('/api/settings/file/')
    )
  ) {
    return true;
  }

  return false;
};

morgan.token('real-ip', (req) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || '-';
});

morgan.token('tenant-user', (req) => req.user?.username || req.user?.id || '-');

const productionLogFormat =
  ':method :url :status :response-time ms ip=:real-ip user=:tenant-user len=:res[content-length]';

app.use(
  morgan(isProduction ? productionLogFormat : 'dev', {
    skip: shouldSkipRequestLog,
  })
);
// CORS: production = explicit origins from CORS_ORIGIN; dev = list + any localhost / 127.0.0.1 port (Vite may use 5174+)
const defaultDevOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];
const allowedOrigins = serverConfig.corsOrigin
  ? serverConfig.corsOrigin.split(',').map((s) => s.trim()).filter(Boolean)
  : [];
const devOrigins = Array.from(new Set([...defaultDevOrigins, ...allowedOrigins]));

/** Dev-only: allow Vite on any port (e.g. 5174 when 5173 is taken). */
function isLocalDevOrigin(origin) {
  if (!origin || typeof origin !== 'string') return true;
  if (devOrigins.includes(origin)) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin.trim());
}

const corsOptions = {
  origin: isProduction
    ? (allowedOrigins.length > 0 ? allowedOrigins : false)
    : (origin, callback) => {
        if (isLocalDevOrigin(origin)) return callback(null, true);
        return callback(null, false);
      },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-XSRF-TOKEN',
    'X-CSRF-TOKEN',
    'X-Health-Check-Token',
    'X-Tenant-Health-Token',
  ],
};
app.use(cors(corsOptions));

// Never cache authenticated JSON API (CDN/browser 304 caused GET /api/auth/me to fail clients)
app.use((req, res, next) => {
  const p = req.path || '';
  if (p.startsWith('/api') || p.startsWith('/super-admin/api')) {
    res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
  }
  next();
});

if (isProduction) {
  const { secureCookieBase } = require('./src/utils/cookiePolicy');
  const cp = secureCookieBase();
  console.log(`[cookies] SameSite=${cp.sameSite} Secure=${cp.secure} (COOKIE_SAME_SITE / CORS_ORIGIN / ALLOW_CROSS_SITE_COOKIES)`);
  if (String(process.env.TENANT_BEARER_AUTH || '').toLowerCase() === 'true') {
    console.log(
      '[auth] TENANT_BEARER_AUTH=true — tenant API accepts Authorization: Bearer from login accessToken; CSRF double-submit skipped for those requests. Prefer HTTPS + CSP; treat tokens like passwords.'
    );
  }
  if (!String(process.env.CORS_ORIGIN || '').trim()) {
    console.warn(
      '[cookies] CORS_ORIGIN is empty. If your React app uses config.json apiUrl pointing at another hostname ' +
        '(e.g. SPA on my-school-dsps.onrender.com but API on my-school-c50t.onrender.com), the browser will not send ' +
        'session cookies unless CORS_ORIGIN lists the SPA origin AND SameSite=None (set CORS_ORIGIN or COOKIE_SAME_SITE=none + ALLOW_CROSS_SITE_COOKIES=true).'
    );
  }
}
const bodyLimit = process.env.REQUEST_BODY_LIMIT || '2mb';
app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

// CSRF (double-submit cookie) for cookie-authenticated SPA.
// Requires frontend to send X-XSRF-TOKEN header matching XSRF-TOKEN cookie for unsafe methods.
const enforceCsrf = (req, res, next) => {
  const method = (req.method || 'GET').toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return next();
  // Public auth endpoints are exempt (login establishes cookies).
  // Logout is exempt so clients can clear session when CSRF header is not yet cached
  // (e.g. 401 storm before ensureCsrfToken); logout is idempotent and low risk for CSRF abuse.
  if (
    req.path.startsWith('/api/auth/login') ||
    req.path.startsWith('/api/auth/logout') ||
    req.path.startsWith('/super-admin/api/auth/login') ||
    req.path.startsWith('/super-admin/api/auth/logout')
  ) return next();
  // Split SPA/API: XSRF cookie often does not attach cross-origin; Bearer auth does not need double-submit CSRF.
  const tenantBearerMode = String(process.env.TENANT_BEARER_AUTH || '').toLowerCase() === 'true';
  const authz = req.headers.authorization || '';
  if (tenantBearerMode && authz.startsWith('Bearer ') && req.path.startsWith('/api/')) {
    return next();
  }
  const cookieToken = req.cookies?.['XSRF-TOKEN'];
  const headerToken = req.headers['x-xsrf-token'] || req.headers['x-csrf-token'];
  if (!cookieToken || !headerToken || String(cookieToken) !== String(headerToken)) {
    return errorResponse(res, 403, 'CSRF validation failed');
  }
  return next();
};
app.use(enforceCsrf);

// Rate limiting - only applied in production to avoid disruption in local development.
if (isProduction) {
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
    skip: (req) => req.path.startsWith('/api/health'),
  });
  app.use('/api', limiter);
  app.use('/super-admin/api', limiter);
} else {
  console.log('[rate-limit] Disabled in development mode');
}

// Auth routes - public, no token needed
app.use('/api/auth', authRoutes);
// Super Admin auth & API (master_db only, no tenant context)
app.use('/super-admin/api/auth', superAdminAuthRoutes);
app.use('/super-admin/api', superAdminRoutes);
app.use('/api', healthRoutes);
// settings/file must be public to serve <img> tags in browser
app.get('/api/settings/file/:filename', settingsController.getFile);

// Protect all other API routes - require valid JWT; then block inactive student/teacher accounts (except /auth/me)
app.use('/api', protectApi, (req, res, next) => requireActiveAccount(req, res, next).catch(next));
app.use('/api/academic-years', academicYearRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/teacher-assignments', teacherAssignmentRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/blood-groups', bloodGroupRoutes);
app.use('/api/religions', religionRoutes);
app.use('/api/casts', castRoutes);
app.use('/api/mother-tongues', motherTongueRoutes);
app.use('/api/parents', parentRoutes);
app.use('/api/parent-persons', parentPersonRoutes);
app.use('/api/guardians', guardianRoutes);
app.use('/api/houses', houseRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/transport', transportRoutes);
app.use('/api/driver-portal', driverPortalRoutes);
app.use('/api/class-schedules', classScheduleRoutes);
app.use('/api/timetable', timetableRoutes);
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
app.use('/api/storage', storageRoutes);
app.use('/api', uploadRoutes);
app.use('/api/class-syllabus', syllabusRoutes);
app.use('/api/notice-board', noticeBoardRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/fees-groups', feesGroupRoutes);
app.use('/api/fees-types', feesTypeRoutes);
app.use('/api/fees-master', feesMasterRoutes);
app.use('/api/fees-assign', feesAssignRoutes);
app.use('/api/fees-collect', feesCollectRoutes);
app.use('/api/school/profile', schoolProfileRoutes);
app.use('/api/bonafide', bonafideRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/exams', examModuleRoutes);
app.use('/api/exam-subjects', examSubjectsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/enquiries', enquiryRoutes);

// Load-balancer probe (no internal metrics; detailed checks live under /api/health with token)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
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
          '⚠️  CORS_ORIGIN is empty. Cross-host SPAs (different Render service URL than this API) will get CORS errors or 401 on every call after login because auth cookies are not sent. Set CORS_ORIGIN=https://your-spa-host on this API service.'
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

    const PORT = Number(process.env.PORT) || 5001;
    // Render/Docker/Kubernetes: must listen on all interfaces. Binding only to localhost
    // leaves no reachable port for the platform health check → "No open ports detected" / deploy timeout.
    const BIND_HOST = process.env.BIND_HOST || '0.0.0.0';

    const startListening = (retriesLeft = 5) => {
      const server = app.listen(PORT, BIND_HOST);
      httpServer = server;

      server.on('listening', () => {
        console.log('🚀 Server is running!');
        console.log(`📍 Listening on ${BIND_HOST}:${PORT} (use PORT from environment on PaaS)`);
        console.log(`🌍 Environment: ${serverConfig.nodeEnv}`);
        // Use localhost in logs so it matches VITE_API_URL / browser Network tab (127.0.0.1 is the same host).
        console.log(`📌 API base: http://localhost:${PORT}/api  (same as http://127.0.0.1:${PORT}/api)`);
        console.log('📋 Example GET routes:');
        const base = `http://localhost:${PORT}`;
        console.log(`   GET  ${base}/`);
        console.log(`   GET  ${base}/api/health`);
        console.log(`   POST ${base}/api/auth/login`);
        console.log(`   GET  ${base}/api/health/database`);
        console.log(`   GET  ${base}/api/academic-years`);
        console.log(`   GET  ${base}/api/academic-years/:id`);
        console.log(`   GET  ${base}/api/classes`);
        console.log(`   GET  ${base}/api/classes/:id`);
        console.log(`   GET  ${base}/api/sections`);
        console.log(`   GET  ${base}/api/sections/:id`);
        console.log(`   GET  ${base}/api/subjects`);
        console.log(`   GET  ${base}/api/subjects/:id`);
        console.log(`   GET  ${base}/api/subjects/class/:classId`);
        console.log(`   GET  ${base}/api/teachers`);
        console.log(`   GET  ${base}/api/teachers/:id`);
        console.log(`   GET  ${base}/api/teachers/class/:classId`);
        console.log(`   GET  ${base}/api/students`);
        console.log(`   GET  ${base}/api/students/:id`);
        console.log(`   GET  ${base}/api/students/class/:classId`);
        console.log(`   GET  ${base}/api/blood-groups`);
        console.log(`   GET  ${base}/api/blood-groups/:id`);
        console.log(`   GET  ${base}/api/religions`);
        console.log(`   GET  ${base}/api/religions/:id`);
        console.log(`   GET  ${base}/api/casts`);
        console.log(`   GET  ${base}/api/casts/:id`);
        console.log(`   GET  ${base}/api/mother-tongues`);
        console.log(`   GET  ${base}/api/mother-tongues/:id`);
        console.log(`   GET  ${base}/api/houses`);
        console.log(`   GET  ${base}/api/houses/:id`);
        console.log(`   GET  ${base}/api/addresses`);
        console.log(`   GET  ${base}/api/addresses/:id`);
        console.log(`   GET  ${base}/api/addresses/user/:userId`);
      });

      server.on('error', (err) => {
        if (err?.code === 'EADDRINUSE' && retriesLeft > 0) {
          console.warn(`⚠️ Port ${PORT} is busy, retrying bind (${retriesLeft} left)...`);
          setTimeout(() => startListening(retriesLeft - 1), 1000);
          return;
        }
        console.error('❌ Failed to bind HTTP server:', err);
        process.exit(1);
      });
    };

    startListening();
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
const gracefulShutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received. Shutting down gracefully...`);
  const finalize = async () => {
    try {
      await closePool();
    } catch (e) {
      console.warn('Error while closing database pools:', e?.message || e);
    } finally {
      process.exit(0);
    }
  };
  if (httpServer) {
    httpServer.close(() => {
      finalize();
    });
    setTimeout(() => {
      finalize();
    }, 5000).unref();
    return;
  }
  finalize();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason instanceof Error ? reason.message : reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err?.message || 'Unknown error');
});

// Start the server
startServer();
