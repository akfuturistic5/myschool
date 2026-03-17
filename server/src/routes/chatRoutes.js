const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/rbacMiddleware');
const { ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  getAllChats,
  getChatById,
  getMessagesByRecipient,
  getSharedMedia,
  getConversations,
  createChat,
  updateChat,
  pinConversation,
  deleteConversation,
  muteConversation,
  clearConversation,
  reportUser,
  blockUser,
  deleteChat
} = require('../controllers/chatController');

router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllChats);
router.get('/conversations', requireRole(ALL_AUTHENTICATED_ROLES), getConversations);
router.get('/messages/:recipientId', requireRole(ALL_AUTHENTICATED_ROLES), getMessagesByRecipient);
router.get('/shared-media/:recipientId', requireRole(ALL_AUTHENTICATED_ROLES), getSharedMedia);
router.put('/conversation/:recipientId/pin', requireRole(ALL_AUTHENTICATED_ROLES), pinConversation);
router.put('/conversation/:recipientId/mute', requireRole(ALL_AUTHENTICATED_ROLES), muteConversation);
router.put('/conversation/:recipientId/clear', requireRole(ALL_AUTHENTICATED_ROLES), clearConversation);
router.delete('/conversation/:recipientId', requireRole(ALL_AUTHENTICATED_ROLES), deleteConversation);
router.post('/conversation/:recipientId/report', requireRole(ALL_AUTHENTICATED_ROLES), reportUser);
router.post('/conversation/:recipientId/block', requireRole(ALL_AUTHENTICATED_ROLES), blockUser);
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getChatById);
router.post('/', requireRole(ALL_AUTHENTICATED_ROLES), createChat);
router.put('/:id', requireRole(ALL_AUTHENTICATED_ROLES), updateChat);
router.delete('/:id', requireRole(ALL_AUTHENTICATED_ROLES), deleteChat);

module.exports = router;
