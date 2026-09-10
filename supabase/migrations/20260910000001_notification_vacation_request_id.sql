-- Add vacation_request_id to notifications so we can link vacation
-- notifications to a specific request and bulk-mark them as read
-- when any manager approves / rejects the request.

alter table public.notifications
  add column if not exists vacation_request_id uuid
    references public.vacation_requests(id) on delete set null;

create index if not exists idx_notifications_vacation_request
  on public.notifications(vacation_request_id)
  where vacation_request_id is not null;
