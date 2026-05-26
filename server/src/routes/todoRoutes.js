const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/rbacMiddleware');
const { TODO_ACCESS_ROLES } = require('../config/roles');
const {
  getAllTodos,
  getTodoById,
  createTodo,
  updateTodo,
  trashTodo,
  restoreTodo,
  deleteTodo,
} = require('../controllers/todoController');

router.get('/', requireRole(TODO_ACCESS_ROLES), getAllTodos);
router.get('/:id', requireRole(TODO_ACCESS_ROLES), getTodoById);
router.post('/', requireRole(TODO_ACCESS_ROLES), createTodo);
router.put('/:id', requireRole(TODO_ACCESS_ROLES), updateTodo);
router.post('/:id/trash', requireRole(TODO_ACCESS_ROLES), trashTodo);
router.post('/:id/restore', requireRole(TODO_ACCESS_ROLES), restoreTodo);
router.delete('/:id', requireRole(TODO_ACCESS_ROLES), deleteTodo);

module.exports = router;
