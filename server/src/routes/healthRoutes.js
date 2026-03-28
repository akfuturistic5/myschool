const express = require('express');
const { healthCheck, databaseTest, tenantDatabaseTest } = require('../controllers/healthController');
const { requireHealthToken } = require('../middleware/requireHealthToken');

const router = express.Router();

router.use(requireHealthToken);

router.get('/health', healthCheck);
router.get('/health/database', databaseTest);
router.get('/health/tenants', tenantDatabaseTest);

module.exports = router;
