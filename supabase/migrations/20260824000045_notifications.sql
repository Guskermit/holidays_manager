-- ============================================================
-- Notifications system
-- Admins can send notifications to all employees, a project,
-- or a specific person. Supports recurring notifications.
-- ============================================================

-- 1. notifications table
create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  message       text not null,
  created_by    uuid not null references public.employees(id) on delete cascade,
  target_type   text not null check (target_type in ('all', 'project', 'employee')),
  target_id     text,                  -- project id_engagement or employee id (null for 'all')
  is_active     boolean not null default true,
  recurrence    text check (recurrence in ('none', 'daily', 'weekly', 'monthly')),
  next_run_at   timestamptz,           -- next time a recurring notification should fire
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 2. notification_recipients — tracks which employees received a notification and read status
create table if not exists public.notification_recipients (
  id              uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  employee_id     uuid not null references public.employees(id) on delete cascade,
  is_read         boolean not null default false,
  read_at         timestamptz,
  created_at      timestamptz not null default now(),
  unique (notification_id, employee_id)
);

-- 3. Indexes
create index if not exists idx_notifications_created_by on public.notifications(created_by);
create index if not exists idx_notifications_target on public.notifications(target_type, target_id);
create index if not exists idx_notifications_next_run on public.notifications(next_run_at) where is_active = true and recurrence != 'none';
create index if not exists idx_notification_recipients_employee on public.notification_recipients(employee_id);
create index if not exists idx_notification_recipients_notification on public.notification_recipients(notification_id);
create index if not exists idx_notification_recipients_unread on public.notification_recipients(employee_id, is_read) where is_read = false;

-- 4. RLS policies
alter table public.notifications enable row level security;
alter table public.notification_recipients enable row level security;

-- Notifications: admins can do everything, employees can read active ones
create policy "notifications: admin all"
  on public.notifications for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "notifications: employees read active"
  on public.notification_recipients for select
  to authenticated
  using (
    employee_id in (
      select id from public.employees where user_id = auth.uid()
    )
  );

-- Recipients: admins can insert/update any, employees can update their own read status
create policy "notification_recipients: admin manage"
  on public.notification_recipients for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "notification_recipients: employee update own read"
  on public.notification_recipients for update
  to authenticated
  using (
    employee_id in (
      select id from public.employees where user_id = auth.uid()
    )
  )
  with check (
    employee_id in (
      select id from public.employees where user_id = auth.uid()
    )
  );

-- 5. Function to expand a notification into recipients
create or replace function public.create_notification_recipients(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_type text;
  v_target_id   text;
  v_emp_ids     uuid[];
begin
  select target_type, target_id into v_target_type, v_target_id
  from notifications where id = p_notification_id;

  if v_target_type = 'all' then
    select array_agg(id) into v_emp_ids from employees;

  elsif v_target_type = 'project' then
    select array_agg(ep.employee_id) into v_emp_ids
    from employee_projects ep
    where ep.project_id = v_target_id
      and (ep.unassigned_at is null or ep.unassigned_at >= current_date);

  elsif v_target_type = 'employee' then
    v_emp_ids := ARRAY[v_target_id::uuid];

  else
    return;
  end if;

  if v_emp_ids is null or array_length(v_emp_ids, 1) = 0 then
    return;
  end if;

  insert into notification_recipients (notification_id, employee_id)
  select p_notification_id, unnest(v_emp_ids)
  on conflict (notification_id, employee_id) do nothing;
end;
$$;

-- 6. Function to fire recurring notifications (called by a cron or app)
create or replace function public.fire_recurring_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  new_id uuid;
  next_time timestamptz;
begin
  for rec in
    select * from notifications
    where is_active = true
      and recurrence != 'none'
      and next_run_at <= now()
  loop
    -- Create a new notification instance
    insert into notifications (title, message, created_by, target_type, target_id, is_active, recurrence, next_run_at)
    values (rec.title, rec.message, rec.created_by, rec.target_type, rec.target_id, true, rec.recurrence,
            case rec.recurrence
              when 'daily'  then now() + interval '1 day'
              when 'weekly' then now() + interval '1 week'
              when 'monthly' then now() + interval '1 month'
            end)
    returning id into new_id;

    -- Expand recipients for the new instance
    perform create_notification_recipients(new_id);

    -- Update next_run_at on the template notification
    update notifications
    set next_run_at = case rec.recurrence
      when 'daily'  then now() + interval '1 day'
      when 'weekly' then now() + interval '1 week'
      when 'monthly' then now() + interval '1 month'
    end,
    updated_at = now()
    where id = rec.id;
  end loop;
end;
$$;
