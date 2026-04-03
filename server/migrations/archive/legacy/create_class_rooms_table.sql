-- =====================================================
-- CLASS ROOMS TABLE
-- For: Academic > Class Room (room number, capacity, status)
-- Run this migration to create and seed class_rooms table.
-- =====================================================

-- Drop table if you need a clean recreate (optional - comment out in production)
-- DROP TABLE IF EXISTS class_rooms;

CREATE TABLE IF NOT EXISTS class_rooms (
    id SERIAL PRIMARY KEY,
    room_no VARCHAR(50) NOT NULL UNIQUE,
    capacity INTEGER NOT NULL DEFAULT 50,
    status VARCHAR(20) DEFAULT 'Active',  -- Active, Inactive
    description TEXT,
    floor VARCHAR(50),
    building VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_class_rooms_room_no ON class_rooms(room_no);
CREATE INDEX IF NOT EXISTS idx_class_rooms_status ON class_rooms(status);

-- Seed initial data (same as static JSON - run only if table is empty)
INSERT INTO class_rooms (room_no, capacity, status)
SELECT '101', 50, 'Active'
WHERE NOT EXISTS (SELECT 1 FROM class_rooms WHERE room_no = '101');

INSERT INTO class_rooms (room_no, capacity, status)
SELECT '102', 40, 'Active'
WHERE NOT EXISTS (SELECT 1 FROM class_rooms WHERE room_no = '102');

INSERT INTO class_rooms (room_no, capacity, status)
SELECT '103', 60, 'Active'
WHERE NOT EXISTS (SELECT 1 FROM class_rooms WHERE room_no = '103');

INSERT INTO class_rooms (room_no, capacity, status)
SELECT '104', 50, 'Active'
WHERE NOT EXISTS (SELECT 1 FROM class_rooms WHERE room_no = '104');

INSERT INTO class_rooms (room_no, capacity, status)
SELECT '105', 40, 'Active'
WHERE NOT EXISTS (SELECT 1 FROM class_rooms WHERE room_no = '105');

INSERT INTO class_rooms (room_no, capacity, status)
SELECT '106', 50, 'Active'
WHERE NOT EXISTS (SELECT 1 FROM class_rooms WHERE room_no = '106');

INSERT INTO class_rooms (room_no, capacity, status)
SELECT '107', 40, 'Active'
WHERE NOT EXISTS (SELECT 1 FROM class_rooms WHERE room_no = '107');

INSERT INTO class_rooms (room_no, capacity, status)
SELECT '108', 40, 'Active'
WHERE NOT EXISTS (SELECT 1 FROM class_rooms WHERE room_no = '108');

INSERT INTO class_rooms (room_no, capacity, status)
SELECT '109', 40, 'Active'
WHERE NOT EXISTS (SELECT 1 FROM class_rooms WHERE room_no = '109');

INSERT INTO class_rooms (room_no, capacity, status)
SELECT '110', 50, 'Active'
WHERE NOT EXISTS (SELECT 1 FROM class_rooms WHERE room_no = '110');
