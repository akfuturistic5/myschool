const test = require('node:test');
const assert = require('node:assert/strict');
const { upsertAttendanceSchema } = require('../src/validations/attendanceValidation');
const { buildSummaryFromRows } = require('../src/utils/attendanceMetrics');

test('attendance upsert schema accepts valid student payload', () => {
  const payload = {
    entityType: 'student',
    attendanceDate: '2026-04-09',
    academicYearId: 1,
    records: [
      { entityId: 10, status: 'present', classId: 2, sectionId: 3, remark: 'On time' },
      { entityId: 11, status: 'late', classId: 2, sectionId: 3 },
    ],
  };
  const { error } = upsertAttendanceSchema.validate(payload);
  assert.equal(error, undefined);
});

test('attendance upsert schema rejects invalid status', () => {
  const payload = {
    entityType: 'staff',
    attendanceDate: '2026-04-09',
    records: [{ entityId: 1, status: 'invalid_status' }],
  };
  const { error } = upsertAttendanceSchema.validate(payload);
  assert.ok(error);
});

test('attendance upsert schema rejects future date', () => {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const payload = {
    entityType: 'staff',
    attendanceDate: tomorrow,
    records: [{ entityId: 1, status: 'present' }],
  };
  const { error } = upsertAttendanceSchema.validate(payload);
  assert.ok(error);
});

test('attendance metrics summary uses centralized formula', () => {
  const summary = buildSummaryFromRows([
    { status: 'present' },
    { status: 'late' },
    { status: 'half_day' },
    { status: 'absent' },
  ]);
  assert.equal(summary.total_marked, 4);
  assert.equal(summary.present, 1);
  assert.equal(summary.late, 1);
  assert.equal(summary.half_day, 1);
  assert.equal(summary.absent, 1);
  assert.equal(summary.attendance_percentage, 62.5);
});
