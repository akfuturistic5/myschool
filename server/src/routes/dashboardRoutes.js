const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ADMIN_DASHBOARD_ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
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
router.get('/upcoming-events', requireRole(ALL_AUTHENTICATED_ROLES), getUpcomingEvents);
router.get('/class-routine', requireRole(ALL_AUTHENTICATED_ROLES), getClassRoutineForDashboard);
router.get('/best-performers', requireRole(ALL_AUTHENTICATED_ROLES), getBestPerformers);
router.get('/star-students', requireRole(ALL_AUTHENTICATED_ROLES), getStarStudents);
router.get('/performance-summary', requireRole(ALL_AUTHENTICATED_ROLES), getPerformanceSummary);
router.get('/top-subjects', requireRole(ALL_AUTHENTICATED_ROLES), getTopSubjects);
router.get('/recent-activity', requireRole(ALL_AUTHENTICATED_ROLES), getRecentActivity);
router.get('/notice-board', requireRole(ALL_AUTHENTICATED_ROLES), getNoticeBoardForDashboard);

module.exports = router;
