const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/rbacMiddleware');
const { ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  getAllTodos,
  getTodoById,
  createTodo,
  updateTodo,
  deleteTodo
} = require('../controllers/todoController');

router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllTodos);
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getTodoById);
router.post('/', requireRole(ALL_AUTHENTICATED_ROLES), createTodo);
router.put('/:id', requireRole(ALL_AUTHENTICATED_ROLES), updateTodo);
router.delete('/:id', requireRole(ALL_AUTHENTICATED_ROLES), deleteTodo);

module.exports = router;
