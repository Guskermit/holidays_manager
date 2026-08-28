-- Add is_other flag and other_reason text to vacation_requests
alter table public.vacation_requests
  add column if not exists is_other boolean not null default false;

alter table public.vacation_requests
  add column if not exists other_reason text;
