const Joi = require('joi');
const {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_CATEGORIES,
  HELP_ARTICLE_STATUSES,
} = require('../config/supportConstants');

const ticketListQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  page_size: Joi.number().integer().min(1).max(100).optional(),
  pageSize: Joi.number().integer().min(1).max(100).optional(),
  status: Joi.string().valid(...TICKET_STATUSES).optional(),
  priority: Joi.string().valid(...TICKET_PRIORITIES).optional(),
  category: Joi.string().valid(...TICKET_CATEGORIES).optional(),
  search: Joi.string().trim().max(200).allow('').optional(),
  sort_by: Joi.string().valid('created_at', 'updated_at', 'priority', 'status').optional(),
  sort_order: Joi.string().valid('asc', 'desc').optional(),
});

const createTicketSchema = Joi.object({
  subject: Joi.string().trim().min(3).max(255).required(),
  description: Joi.string().trim().min(10).max(10000).required(),
  category: Joi.string().valid(...TICKET_CATEGORIES).required(),
  priority: Joi.string().valid(...TICKET_PRIORITIES).default('medium'),
  attachments: Joi.array()
    .items(
      Joi.object({
        file_name: Joi.string().trim().max(255).required(),
        file_path: Joi.string().trim().max(500).required(),
        file_type: Joi.string().trim().max(100).allow(null, '').optional(),
        file_size: Joi.number().integer().min(0).max(50 * 1024 * 1024).optional(),
      })
    )
    .max(5)
    .optional(),
});

const replyTicketSchema = Joi.object({
  message: Joi.string().trim().min(1).max(10000).required(),
  attachments: Joi.array()
    .items(
      Joi.object({
        file_name: Joi.string().trim().max(255).required(),
        file_path: Joi.string().trim().max(500).required(),
        file_type: Joi.string().trim().max(100).allow(null, '').optional(),
        file_size: Joi.number().integer().min(0).max(50 * 1024 * 1024).optional(),
      })
    )
    .max(5)
    .optional(),
});

const helpSearchQuerySchema = Joi.object({
  q: Joi.string().trim().max(200).allow('').optional(),
  category: Joi.string().trim().max(80).optional(),
  type: Joi.string().valid('all', 'articles', 'faqs').optional(),
});

const superAdminTicketPatchSchema = Joi.object({
  status: Joi.string().valid(...TICKET_STATUSES).optional(),
}).min(1);

const superAdminReplySchema = Joi.object({
  message: Joi.string().trim().min(1).max(10000).required(),
  is_internal_note: Joi.boolean().optional(),
  attachments: Joi.array()
    .items(
      Joi.object({
        file_name: Joi.string().trim().max(255).required(),
        file_path: Joi.string().trim().max(500).required(),
        file_type: Joi.string().trim().max(100).allow(null, '').optional(),
        file_size: Joi.number().integer().min(0).optional(),
        school_id: Joi.number().integer().min(1).optional(),
      })
    )
    .max(5)
    .optional(),
});

const helpArticleBodySchema = Joi.object({
  category_id: Joi.number().integer().min(1).required(),
  title: Joi.string().trim().min(2).max(255).required(),
  description: Joi.string().trim().max(1000).allow('', null).optional(),
  content: Joi.string().max(100000).required(),
  status: Joi.string().valid(...HELP_ARTICLE_STATUSES).optional(),
  sort_order: Joi.number().integer().min(1).required(),
});

const helpFaqBodySchema = Joi.object({
  category_slug: Joi.string().trim().max(80).allow('', null).optional(),
  question: Joi.string().trim().min(3).max(500).required(),
  answer: Joi.string().trim().min(3).max(10000).required(),
  sort_order: Joi.number().integer().min(1).required(),
  is_active: Joi.boolean().optional(),
});

const helpCategoryBodySchema = Joi.object({
  slug: Joi.string().trim().min(2).max(80).required(),
  name: Joi.string().trim().min(2).max(120).required(),
  description: Joi.string().trim().max(1000).allow('', null).optional(),
  sort_order: Joi.number().integer().min(1).required(),
  is_active: Joi.boolean().optional(),
});

const helpCategoryPatchSchema = Joi.object({
  slug: Joi.string().trim().min(2).max(80).optional(),
  name: Joi.string().trim().min(2).max(120).optional(),
  description: Joi.string().trim().max(1000).allow('', null).optional(),
  sort_order: Joi.number().integer().min(1).optional(),
  is_active: Joi.boolean().optional(),
}).min(1);

const helpArticlePatchSchema = Joi.object({
  category_id: Joi.number().integer().min(1).optional(),
  title: Joi.string().trim().min(2).max(255).optional(),
  description: Joi.string().trim().max(1000).allow('', null).optional(),
  content: Joi.string().max(100000).optional(),
  status: Joi.string().valid(...HELP_ARTICLE_STATUSES).optional(),
  sort_order: Joi.number().integer().min(1).optional(),
}).min(1);

const helpFaqPatchSchema = Joi.object({
  category_slug: Joi.string().trim().max(80).allow('', null).optional(),
  question: Joi.string().trim().min(3).max(500).optional(),
  answer: Joi.string().trim().min(3).max(10000).optional(),
  sort_order: Joi.number().integer().min(1).optional(),
  is_active: Joi.boolean().optional(),
}).min(1);

const helpIdParamSchema = Joi.object({
  id: Joi.string().pattern(/^[1-9]\d*$/).required(),
});

module.exports = {
  ticketListQuerySchema,
  createTicketSchema,
  replyTicketSchema,
  helpSearchQuerySchema,
  superAdminTicketPatchSchema,
  superAdminReplySchema,
  helpArticleBodySchema,
  helpFaqBodySchema,
  helpCategoryBodySchema,
  helpCategoryPatchSchema,
  helpArticlePatchSchema,
  helpFaqPatchSchema,
  helpIdParamSchema,
};
