-- ============================================================
-- Add is_medical_leave flag to vacation_requests
-- Medical leave requests are not limited and are auto-approved.
-- They do NOT consume the regular vacation balance.
-- ============================================================

alter table public.vacation_requests
  add column if not exists is_medical_leave boolean not null default false;
