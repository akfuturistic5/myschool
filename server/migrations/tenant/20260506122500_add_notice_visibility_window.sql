ALTER TABLE public.notice_board
  ADD COLUMN IF NOT EXISTS notice_start_date date,
  ADD COLUMN IF NOT EXISTS notice_end_date date;
