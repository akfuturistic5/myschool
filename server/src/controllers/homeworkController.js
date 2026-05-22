const { executeTransaction } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { validate } = require('../utils/validate');
const {
  createHomeworkSchema,
  updateHomeworkSchema,
  listHomeworkQuerySchema,
  patchHomeworkStatusSchema,
  addHomeworkAttachmentSchema,
} = require('../validations/homeworkValidation');
const homeworkService = require('../services/homeworkService');

const listHomework = async (req, res) => {
  try {
    const { error, value } = listHomeworkQuerySchema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      return errorResponse(res, 400, error.details.map((d) => d.message).join('; '));
    }

    const result = await homeworkService.listHomework(req.user, value);
    return success(res, 200, 'Homework list fetched successfully', result.rows, {
      count: result.rows.length,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  } catch (err) {
    console.error('listHomework:', err);
    return errorResponse(res, 500, 'Failed to fetch homework list');
  }
};

const getHomework = async (req, res) => {
  try {
    const result = await homeworkService.getHomeworkById(req.params.id, req.user);
    if (!result.ok) {
      return errorResponse(res, result.status, result.message);
    }
    return success(res, 200, 'Homework fetched successfully', result.homework);
  } catch (err) {
    console.error('getHomework:', err);
    return errorResponse(res, 500, 'Failed to fetch homework');
  }
};

const createHomework = async (req, res) => {
  try {
    const result = await homeworkService.createHomework(
      req.user,
      req.body,
      executeTransaction
    );
    if (!result.ok) {
      return errorResponse(res, result.status, result.message);
    }
    return success(res, 201, 'Homework created successfully', result.homework, {
      recipient_count: result.recipient_count,
    });
  } catch (err) {
    console.error('createHomework:', err);
    if (err.code === '23503') {
      return errorResponse(res, 400, 'Invalid academic context or teacher assignment');
    }
    if (err.code === '23514') {
      return errorResponse(res, 400, 'Homework data violates database constraints');
    }
    return errorResponse(res, 500, 'Failed to create homework');
  }
};

const updateHomework = async (req, res) => {
  try {
    const result = await homeworkService.updateHomework(req.params.id, req.user, req.body);
    if (!result.ok) {
      return errorResponse(res, result.status, result.message);
    }
    return success(res, 200, 'Homework updated successfully', result.homework);
  } catch (err) {
    console.error('updateHomework:', err);
    if (err.code === '23514') {
      return errorResponse(res, 400, 'Homework data violates database constraints');
    }
    return errorResponse(res, 500, 'Failed to update homework');
  }
};

const patchHomeworkStatus = async (req, res) => {
  try {
    const result = await homeworkService.patchHomeworkStatus(
      req.params.id,
      req.user,
      req.body.status
    );
    if (!result.ok) {
      return errorResponse(res, result.status, result.message);
    }
    return success(res, 200, 'Homework status updated', result.homework);
  } catch (err) {
    console.error('patchHomeworkStatus:', err);
    return errorResponse(res, 500, 'Failed to update status');
  }
};

const deleteHomework = async (req, res) => {
  try {
    const result = await homeworkService.softDeleteHomework(req.params.id, req.user);
    if (!result.ok) {
      return errorResponse(res, result.status, result.message);
    }
    return success(res, 200, 'Homework deleted successfully');
  } catch (err) {
    console.error('deleteHomework:', err);
    return errorResponse(res, 500, 'Failed to delete homework');
  }
};

const listRecipients = async (req, res) => {
  try {
    const result = await homeworkService.listHomeworkRecipients(req.params.id, req.user);
    if (!result.ok) {
      return errorResponse(res, result.status, result.message);
    }
    return success(res, 200, 'Homework recipients fetched successfully', result.recipients, {
      count: result.recipients.length,
      homework_id: homeworkService.parseId(req.params.id),
    });
  } catch (err) {
    console.error('listRecipients:', err);
    return errorResponse(res, 500, 'Failed to fetch homework recipients');
  }
};

const addAttachment = async (req, res) => {
  try {
    const result = await homeworkService.addHomeworkAttachment(
      req.params.id,
      req.user,
      req.body
    );
    if (!result.ok) {
      return errorResponse(res, result.status, result.message);
    }
    return success(res, 201, 'Attachment added', result.attachment);
  } catch (err) {
    console.error('addAttachment:', err);
    return errorResponse(res, 500, 'Failed to add attachment');
  }
};

const deleteAttachment = async (req, res) => {
  try {
    const result = await homeworkService.softDeleteHomeworkAttachment(
      req.params.attachmentId,
      req.user
    );
    if (!result.ok) {
      return errorResponse(res, result.status, result.message);
    }
    return success(res, 200, 'Attachment removed');
  } catch (err) {
    console.error('deleteAttachment:', err);
    return errorResponse(res, 500, 'Failed to remove attachment');
  }
};

module.exports = {
  listHomework,
  getHomework,
  createHomework,
  updateHomework,
  patchHomeworkStatus,
  deleteHomework,
  listRecipients,
  addAttachment,
  deleteAttachment,
  validateCreateHomework: validate(createHomeworkSchema),
  validateUpdateHomework: validate(updateHomeworkSchema),
  validatePatchStatus: validate(patchHomeworkStatusSchema),
  validateAddAttachment: validate(addHomeworkAttachmentSchema),
};
