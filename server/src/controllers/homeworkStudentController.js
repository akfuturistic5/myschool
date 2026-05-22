const { executeTransaction } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { validate } = require('../utils/validate');
const { createStudentSubmissionSchema } = require('../validations/homeworkValidation');
const homeworkService = require('../services/homeworkService');

const listMyHomework = async (req, res) => {
  try {
    const result = await homeworkService.listMyHomework(req.user);
    if (!result.ok) {
      return errorResponse(res, result.status, result.message);
    }
    return success(res, 200, 'My homework fetched successfully', result.items, {
      count: result.items.length,
    });
  } catch (err) {
    console.error('listMyHomework:', err);
    return errorResponse(res, 500, 'Failed to fetch homework');
  }
};

const getMyHomework = async (req, res) => {
  try {
    const result = await homeworkService.getMyHomeworkById(req.params.homeworkId, req.user, {
      markViewed: true,
    });
    if (!result.ok) {
      return errorResponse(res, result.status, result.message);
    }
    return success(res, 200, 'Homework fetched successfully', result.homework);
  } catch (err) {
    console.error('getMyHomework:', err);
    return errorResponse(res, 500, 'Failed to fetch homework');
  }
};

const submitHomework = async (req, res) => {
  try {
    const result = await homeworkService.submitMyHomework(
      req.params.homeworkId,
      req.user,
      req.body,
      executeTransaction
    );
    if (!result.ok) {
      return errorResponse(res, result.status, result.message);
    }
    return success(res, 200, 'Submission saved successfully', {
      submission: result.submission,
      homework: result.homework,
    });
  } catch (err) {
    console.error('submitHomework:', err);
    if (err.code === '23505') {
      return errorResponse(res, 409, 'Submission attempt already exists');
    }
    return errorResponse(res, 500, 'Failed to save submission');
  }
};

module.exports = {
  listMyHomework,
  getMyHomework,
  submitHomework,
  validateSubmitHomework: validate(createStudentSubmissionSchema),
};
