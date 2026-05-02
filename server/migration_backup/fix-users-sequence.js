const { query } = require('./src/config/database');
query("SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1))")
  .then(() => { console.log('Users id sequence fixed'); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
