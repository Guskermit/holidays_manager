-- ============================================================
-- Add is_bootcamp flag to vacation_requests
-- Bootcamp requests are limited to 2 days per employee per year
-- and do NOT consume the regular vacation balance.
-- ============================================================

alter table public.vacation_requests
  add column if not exists is_bootcamp boolean not null default false;
