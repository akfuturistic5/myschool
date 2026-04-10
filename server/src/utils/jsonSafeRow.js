/**
 * Express res.json uses JSON.stringify, which throws on BigInt (pg may return int8 as bigint).
 */
function jsonSafeRow(row) {
  if (row == null) return row;
  return JSON.parse(
    JSON.stringify(row, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))
  );
}

module.exports = { jsonSafeRow };
