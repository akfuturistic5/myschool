const { success, error: errorResponse } = require('../utils/responseHelper');
const homeworkService = require('../services/homeworkService');

const listChildHomework = async (req, res) => {
  try {
    const result = await homeworkService.listChildHomework(req.params.studentId, req.user);
    if (!result.ok) {
      return errorResponse(res, result.status, result.message);
    }
    return success(res, 200, 'Child homework fetched successfully', result.items, {
      count: result.items.length,
      student_id: result.student_id,
    });
  } catch (err) {
    console.error('listChildHomework:', err);
    return errorResponse(res, 500, 'Failed to fetch homework');
  }
};

const getChildHomework = async (req, res) => {
  try {
    const result = await homeworkService.getChildHomeworkById(
      req.params.homeworkId,
      req.params.studentId,
      req.user
    );
    if (!result.ok) {
      return errorResponse(res, result.status, result.message);
    }
    return success(res, 200, 'Homework fetched successfully', result.homework, {
      student_id: result.student_id,
    });
  } catch (err) {
    console.error('getChildHomework:', err);
    return errorResponse(res, 500, 'Failed to fetch homework');
  }
};

module.exports = {
  listChildHomework,
  getChildHomework,
};
