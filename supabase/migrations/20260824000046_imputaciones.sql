-- ============================================================
-- Imputaciones system
-- Per client, admins can create engagements and assign
-- employees with weekly hours and date ranges.
-- ============================================================

-- 1. engagements table — engagements within a client
create table if not exists public.engagements (
  id              uuid primary key default gen_random_uuid(),
  client_id       text not null references public.projects(id_engagement) on delete cascade,
  engagement_code text not null,
  name            text not null,
  start_date      date,
  end_date        date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 2. employee_imputations — employee assignments to engagements
create table if not exists public.employee_imputations (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references public.employees(id) on delete cascade,
  engagement_id   uuid not null references public.engagements(id) on delete cascade,
  start_date      date not null,
  end_date        date,
  weekly_hours    numeric(5,2) not null check (weekly_hours > 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (employee_id, engagement_id)
);

-- 3. Indexes
create index if not exists idx_engagements_client on public.engagements(client_id);
create index if not exists idx_employee_imputations_employee on public.employee_imputations(employee_id);
create index if not exists idx_employee_imputations_engagement on public.employee_imputations(engagement_id);

-- 4. RLS policies
alter table public.engagements enable row level security;
alter table public.employee_imputations enable row level security;

-- Engagements: admins can do everything, employees can read
create policy "engagements: admin all"
  on public.engagements for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "engagements: employees read"
  on public.engagements for select
  to authenticated
  using (true);

-- Employee imputations: admins can do everything, employees can read their own
create policy "employee_imputations: admin all"
  on public.employee_imputations for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "employee_imputations: employee read own"
  on public.employee_imputations for select
  to authenticated
  using (
    employee_id in (
      select id from public.employees where user_id = auth.uid()
    )
  );
