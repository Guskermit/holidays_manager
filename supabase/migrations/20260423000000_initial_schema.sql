-- ============================================================
-- Initial schema for Holidays Manager
-- ============================================================

-- ── categories ───────────────────────────────────────────────
create table public.categories (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  vacation_days integer not null,
  created_at    timestamptz not null default now()
);

-- ── departments ──────────────────────────────────────────────
create table public.departments (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

-- ── employees ────────────────────────────────────────────────
-- user_id references auth.users so every employee is tied to a
-- Supabase Auth account. ON DELETE CASCADE removes the employee
-- record when the auth user is deleted.
create table public.employees (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references auth.users (id) on delete cascade,
  name          text not null,
  email         text not null unique,
  category_id   uuid references public.categories (id) on delete set null,
  department_id uuid references public.departments (id) on delete set null,
  manager_id    uuid references public.employees (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── projects ─────────────────────────────────────────────────
create table public.projects (
  id_engagement text primary key,
  name          text not null,
  start_date    date not null,
  end_date      date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── employee_projects ─────────────────────────────────────────
create table public.employee_projects (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references public.employees (id) on delete cascade,
  project_id      text not null references public.projects (id_engagement) on delete cascade,
  role            text,
  assigned_at     date,
  unassigned_at   date,
  unique (employee_id, project_id)
);

-- ── vacation_requests ─────────────────────────────────────────
create table public.vacation_requests (
  id               uuid primary key default gen_random_uuid(),
  employee_id      uuid not null references public.employees (id) on delete cascade,
  start_date       date not null,
  end_date         date not null,
  days_requested   integer not null,
  status           text not null default 'pending'
                     check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by      uuid references public.employees (id) on delete set null,
  resolved_at      timestamptz,
  rejection_reason text,
  notes            text,
  year             integer not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ── vacation_balances ─────────────────────────────────────────
create table public.vacation_balances (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.employees (id) on delete cascade,
  year          integer not null,
  total_days    integer not null,
  used_days     integer not null default 0,
  pending_days  integer not null default 0,
  unique (employee_id, year)
);

-- ============================================================
-- Trigger: auto-create employee row on auth.users insert
-- ============================================================
-- When a user signs up via Supabase Auth, this trigger creates a
-- corresponding row in public.employees using the email and the
-- optional full_name passed through auth.users.raw_user_meta_data.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.employees (user_id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

alter table public.employees         enable row level security;
alter table public.projects          enable row level security;
alter table public.employee_projects enable row level security;
alter table public.vacation_requests enable row level security;
alter table public.vacation_balances enable row level security;
alter table public.categories        enable row level security;
alter table public.departments       enable row level security;

-- employees: each user can read/update their own row
create policy "employees: read own"
  on public.employees for select
  using (user_id = auth.uid());

create policy "employees: update own"
  on public.employees for update
  using (user_id = auth.uid());

-- managers can see their direct reports
create policy "employees: manager reads reports"
  on public.employees for select
  using (
    manager_id in (
      select id from public.employees where user_id = auth.uid()
    )
  );

-- vacation_requests: employees manage their own; managers resolve their reports'
create policy "vacation_requests: read own"
  on public.vacation_requests for select
  using (employee_id = (select id from public.employees where user_id = auth.uid()));

create policy "vacation_requests: insert own"
  on public.vacation_requests for insert
  with check (employee_id = (select id from public.employees where user_id = auth.uid()));

create policy "vacation_requests: update own pending"
  on public.vacation_requests for update
  using (
    employee_id = (select id from public.employees where user_id = auth.uid())
    and status = 'pending'
  );

create policy "vacation_requests: manager resolves"
  on public.vacation_requests for update
  using (
    employee_id in (
      select id from public.employees
      where manager_id = (select id from public.employees where user_id = auth.uid())
    )
  );

create policy "vacation_requests: manager reads reports"
  on public.vacation_requests for select
  using (
    employee_id in (
      select id from public.employees
      where manager_id = (select id from public.employees where user_id = auth.uid())
    )
  );

-- vacation_balances: each employee reads their own
create policy "vacation_balances: read own"
  on public.vacation_balances for select
  using (employee_id = (select id from public.employees where user_id = auth.uid()));

-- categories and departments: readable by all authenticated users
create policy "categories: read all"
  on public.categories for select
  using (auth.role() = 'authenticated');

create policy "departments: read all"
  on public.departments for select
  using (auth.role() = 'authenticated');

-- employee_projects: employees see their own assignments
create policy "employee_projects: read own"
  on public.employee_projects for select
  using (employee_id = (select id from public.employees where user_id = auth.uid()));

-- projects: readable by all authenticated users
create policy "projects: read all"
  on public.projects for select
  using (auth.role() = 'authenticated');
