const { success, error: errorResponse } = require('../utils/responseHelper');
const { validate } = require('../utils/validate');
const {
  evaluateSubmissionSchema,
  returnSubmissionSchema,
} = require('../validations/homeworkValidation');
const homeworkService = require('../services/homeworkService');

const listSubmissions = async (req, res) => {
  try {
    const result = await homeworkService.listHomeworkSubmissions(req.params.id, req.user);
    if (!result.ok) {
      return errorResponse(res, result.status, result.message);
    }
    return success(res, 200, 'Submissions fetched successfully', result.submissions, {
      count: result.submissions.length,
    });
  } catch (err) {
    console.error('listSubmissions:', err);
    return errorResponse(res, 500, 'Failed to fetch submissions');
  }
};

const evaluateSubmission = async (req, res) => {
  try {
    const result = await homeworkService.evaluateSubmission(
      req.params.submissionId,
      req.user,
      req.body
    );
    if (!result.ok) {
      return errorResponse(res, result.status, result.message);
    }
    return success(res, 200, 'Submission evaluated successfully', result.submission);
  } catch (err) {
    console.error('evaluateSubmission:', err);
    return errorResponse(res, 500, 'Failed to evaluate submission');
  }
};

const returnSubmission = async (req, res) => {
  try {
    const result = await homeworkService.returnSubmission(
      req.params.submissionId,
      req.user,
      req.body
    );
    if (!result.ok) {
      return errorResponse(res, result.status, result.message);
    }
    return success(res, 200, 'Submission returned for correction', result.submission);
  } catch (err) {
    console.error('returnSubmission:', err);
    return errorResponse(res, 500, 'Failed to return submission');
  }
};

module.exports = {
  listSubmissions,
  evaluateSubmission,
  returnSubmission,
  validateEvaluateSubmission: validate(evaluateSubmissionSchema),
  validateReturnSubmission: validate(returnSubmissionSchema),
};
