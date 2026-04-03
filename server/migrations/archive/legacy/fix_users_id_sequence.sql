-- Fix users table id sequence (common when rows were inserted with explicit ids)
SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1));
