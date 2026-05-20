-- Ensure Driver and Conductor roles exist for transport staff (staff + users).
INSERT INTO public.user_roles (role_name, description, is_active) VALUES
  ('Driver', 'Staff responsible for vehicle operation and student transport', true),
  ('Conductor', 'Staff assisting with student transport and vehicle supervision', true),
  ('Warden', 'Staff responsible for hostel and student accommodation', true)
ON CONFLICT (role_name) DO NOTHING;
