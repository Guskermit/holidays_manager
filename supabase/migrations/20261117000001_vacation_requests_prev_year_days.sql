-- January vacation requests may consume the previous year's balance first.
-- prev_year_days stores how many days of this request were charged to (year - 1).
-- Non-January requests keep prev_year_days = 0.
alter table public.vacation_requests
  add column if not exists prev_year_days integer not null default 0;

-- Backfill: requests that start in January of their year may have used the
-- previous year balance under the old (incorrect) single-year charging.
-- We cannot know the historical split reliably, so leave as 0; only new
-- requests record the split. Existing single-year charges stay on `year`.
