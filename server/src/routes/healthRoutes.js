const express = require('express');
const { healthCheck, databaseTest, tenantDatabaseTest } = require('../controllers/healthController');
const { requireHealthToken } = require('../middleware/requireHealthToken');

const router = express.Router();

// Token gate ONLY for health probe routes. Do not use router.use(requireHealthToken) here:
// this router is mounted at /api, and a global requireHealthToken would run on every /api/*
// request (e.g. /api/todos), causing 401 for all tenant APIs while /api/auth/* still works
// because auth routes are registered before this mount.
router.get('/health', requireHealthToken, healthCheck);
router.get('/health/database', requireHealthToken, databaseTest);
router.get('/health/tenants', requireHealthToken, tenantDatabaseTest);

module.exports = router;
