const test = require('node:test');
const assert = require('node:assert/strict');
const { holidayBodySchema } = require('../src/validations/holidayValidation');
const { buildHolidayDateSet, applyHolidayOverride } = require('../src/utils/holidayUtils');

test('holiday schema accepts valid payload', () => {
  const payload = {
    title: 'Summer Break',
    description: 'School vacation',
    start_date: '2026-05-10',
    end_date: '2026-05-20',
    holiday_type: 'school',
  };
  const { error } = holidayBodySchema.validate(payload);
  assert.equal(error, undefined);
});

test('holiday date set expands ranges correctly', () => {
  const dates = buildHolidayDateSet(
    [{ start_date: '2026-05-10', end_date: '2026-05-12' }],
    '2026-05-01',
    '2026-05-31'
  );
  assert.equal(dates.has('2026-05-10'), true);
  assert.equal(dates.has('2026-05-11'), true);
  assert.equal(dates.has('2026-05-12'), true);
  assert.equal(dates.has('2026-05-13'), false);
});

test('holiday override maps attendance status to holiday', () => {
  assert.equal(applyHolidayOverride('present', true), 'holiday');
  assert.equal(applyHolidayOverride('late', true), 'holiday');
  assert.equal(applyHolidayOverride('leave', true, { leavePriority: true }), 'leave');
});
