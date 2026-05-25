const express = require('express');

const { requireRole } = require('../middleware/rbacMiddleware');

const { SUPPORT_ACCESS_ROLES } = require('../config/roles');

const { validate } = require('../utils/validate');

const {

  ticketListQuerySchema,

  createTicketSchema,

  replyTicketSchema,

  helpSearchQuerySchema,
  helpIdParamSchema,
} = require('../validations/supportValidation');

const {

  listCategories,

  listArticles,

  getArticleById,

  listFaqs,

  searchHelpCenter,

} = require('../controllers/helpCenterController');

const {

  listTickets,

  createTicket,

  getTicketById,

  replyToTicket,

  getTicketMeta,

} = require('../controllers/supportTicketController');



const router = express.Router();



router.get('/meta', requireRole(SUPPORT_ACCESS_ROLES), getTicketMeta);

router.get('/search', requireRole(SUPPORT_ACCESS_ROLES), validate(helpSearchQuerySchema, 'query'), searchHelpCenter);

router.get('/categories', requireRole(SUPPORT_ACCESS_ROLES), listCategories);

router.get('/articles', requireRole(SUPPORT_ACCESS_ROLES), listArticles);

router.get('/articles/:id', requireRole(SUPPORT_ACCESS_ROLES), validate(helpIdParamSchema, 'params'), getArticleById);

router.get('/faqs', requireRole(SUPPORT_ACCESS_ROLES), listFaqs);



router.get('/tickets', requireRole(SUPPORT_ACCESS_ROLES), validate(ticketListQuerySchema, 'query'), listTickets);

router.post('/tickets', requireRole(SUPPORT_ACCESS_ROLES), validate(createTicketSchema), createTicket);

router.get('/tickets/:id', requireRole(SUPPORT_ACCESS_ROLES), getTicketById);

router.post('/tickets/:id/replies', requireRole(SUPPORT_ACCESS_ROLES), validate(replyTicketSchema), replyToTicket);



module.exports = router;

