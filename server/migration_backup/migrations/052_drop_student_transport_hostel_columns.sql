-- Drop deprecated transport/hostel columns from students.
-- Transport is now sourced from transport_allocations.
-- Hostel details are temporarily paused.

ALTER TABLE students
  DROP COLUMN IF EXISTS route_id,
  DROP COLUMN IF EXISTS pickup_point_id,
  DROP COLUMN IF EXISTS vehicle_number,
  DROP COLUMN IF EXISTS hostel_id,
  DROP COLUMN IF EXISTS hostel_room_id;
