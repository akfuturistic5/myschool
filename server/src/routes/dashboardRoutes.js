const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ADMIN_DASHBOARD_ROLES } = require('../config/roles');
const {
  getDashboardStats,
  getUpcomingEvents,
  getClassRoutineForDashboard,
  getBestPerformers,
  getStarStudents,
  getPerformanceSummary,
  getTopSubjects,
  getRecentActivity,
  getNoticeBoardForDashboard,
  getDashboardFeeStats,
  getDashboardFinanceSummary,
} = require('../controllers/dashboardController');

const router = express.Router();

// Admin-only dashboard stats (full system counts)
router.get('/stats', requireRole(ADMIN_DASHBOARD_ROLES), getDashboardStats);
router.get('/fee-stats', requireRole(ADMIN_DASHBOARD_ROLES), getDashboardFeeStats);
router.get('/finance-summary', requireRole(ADMIN_DASHBOARD_ROLES), getDashboardFinanceSummary);

// Shared dashboard endpoints (all authenticated roles)
router.get('/upcoming-events', getUpcomingEvents);
router.get('/class-routine', getClassRoutineForDashboard);
router.get('/best-performers', getBestPerformers);
router.get('/star-students', getStarStudents);
router.get('/performance-summary', getPerformanceSummary);
router.get('/top-subjects', getTopSubjects);
router.get('/recent-activity', getRecentActivity);
router.get('/notice-board', getNoticeBoardForDashboard);

module.exports = router;
