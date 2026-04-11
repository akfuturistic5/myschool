const STATUS_KEYS = ['present', 'absent', 'late', 'half_day', 'holiday'];

function emptySummary() {
  return {
    present: 0,
    absent: 0,
    late: 0,
    half_day: 0,
    holiday: 0,
    total_marked: 0,
    attendance_percentage: 0,
  };
}

function buildSummaryFromRows(rows = []) {
  const summary = emptySummary();
  for (const row of rows) {
    const status = String(row?.status || '').trim().toLowerCase();
    if (STATUS_KEYS.includes(status)) {
      summary[status] += 1;
      summary.total_marked += 1;
    }
  }
  const effectivePresent = summary.present + summary.late + (summary.half_day * 0.5);
  summary.attendance_percentage = summary.total_marked > 0
    ? Number(((effectivePresent / summary.total_marked) * 100).toFixed(2))
    : 0;
  return summary;
}

module.exports = {
  buildSummaryFromRows,
};
