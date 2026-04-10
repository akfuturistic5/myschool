const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { PEOPLE_MANAGER_ROLES } = require('../config/roles');
const { searchParentPersons, getParentPersonById } = require('../controllers/parentPersonController');

const router = express.Router();

router.get('/search', requireRole(PEOPLE_MANAGER_ROLES), searchParentPersons);
router.get('/:id', requireRole(PEOPLE_MANAGER_ROLES), getParentPersonById);

module.exports = router;
