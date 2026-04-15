dz# Class schedules – schema expected by the API

The API shows the **timetable** by reading **class_schedules** (class + period link) and **time_slots** (period details: start/end time).

## Relationship

- **class_schedules** has `class_id` and **time_slot_id**.
- **time_slot_id** stores the **pass key** of the period (same as `time_slots.id` or `time_slots.pass_key`).
- Each row in **class_schedules** means: “This class has this period (time slot).” The period’s start/end time come from **time_slots**.

## class_schedules table

| Purpose   | Column (or alternative) |
|----------|--------------------------|
| Class    | `class_id` or `class` → `classes.id` |
| Section  | `section_id` or `section` (optional) |
| Subject  | `subject_id` or `subject` (optional) |
| Period   | **`time_slot_id`** or `time_slot` or `period_id` → matches `time_slots.id` or `time_slots.pass_key` |
| Day      | `day_of_week` (0–6) or `day` or `weekday` |
| Room     | `room_number`, `room`, `class_room` |
| Teacher  | `teacher_id` or `teacher` (optional) |

## time_slots table (periods)

Stores each **period** in the timetable. The API looks up by **id** or **pass_key** so that `class_schedules.time_slot_id` finds the right row.

| Column       | Purpose |
|-------------|---------|
| `id`        | Primary key |
| `pass_key`  | Optional; if present, `class_schedules.time_slot_id` can match this instead of `id` |
| `start_time`| Period start (e.g. 09:30 or 09:30:00) |
| `end_time`  | Period end (e.g. 10:45 or 10:45:00) |

Alternatives for start/end: `period_start`/`period_end`, `start_time_period`/`end_time_period`, or `start`/`end`.

If **time_slots** is missing, the API still works if **class_schedules** has `start_time` and `end_time` on the row.

---

No database writes are performed by the API; this file is for reference only.

## Debug endpoint

- **GET /api/class-schedules/debug** – Returns raw counts and sample rows from `class_schedules` (or `class_schedule`), `time_slots`, and `classes` so you can verify table/column names without writing to the DB.

## Optional: manual SQL (run only if you need to create tables)

If your database has no class-schedule tables, you can run the following manually (adjust types/schema to match your DB).

```sql
-- Time slots (periods)
CREATE TABLE IF NOT EXISTS time_slots (
  id SERIAL PRIMARY KEY,
  pass_key VARCHAR(50),
  start_time TIME,
  end_time TIME
);

-- Class schedules (one row = one period for a class)
CREATE TABLE IF NOT EXISTS class_schedules (
  id SERIAL PRIMARY KEY,
  class_id INT REFERENCES classes(id),
  section_id INT,
  subject_id INT,
  teacher_id INT,
  time_slot_id INT,
  day_of_week INT,
  room_number VARCHAR(50),
  start_time TIME,
  end_time TIME
);

-- Example seed (optional)
INSERT INTO time_slots (pass_key, start_time, end_time) VALUES
  ('P1', '09:00', '09:45'),
  ('P2', '09:45', '10:30'),
  ('P3', '10:45', '11:30');
-- Then insert into class_schedules linking class_id and time_slot_id (e.g. 1, 2, 3) as needed.
```
