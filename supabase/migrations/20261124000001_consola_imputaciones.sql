-- ============================================================
-- Consola de imputaciones (PUT /api/imputaciones)
-- Weekly imputations pushed by the external console and used
-- to inform employees (dashboard) and admins (read-only grid).
-- Replaces employee_imputations as the source for those views.
-- ============================================================

-- 1. Table — one row per (employee email, week, engagement)
create table if not exists public.employee_console_imputations (
  id              uuid primary key default gen_random_uuid(),
  email           text not null,                      -- normalized lowercase from payload
  employee_id     uuid references public.employees(id) on delete set null,
  engagement_code text not null,                      -- e.g. E-1235456 (no FK required)
  semana          text not null,                      -- raw "semana" value from payload
  lunes           date not null,                      -- week start (Monday) — canonical week key
  viernes         date not null,                      -- week end (Friday)
  horas           numeric(5,2) not null check (horas >= 0),
  formato         text,
  version         text,
  generado        timestamptz,
  fecha_corte     date,
  redondeo        numeric,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (email, lunes, engagement_code)
);

-- 2. Indexes
create index if not exists idx_employee_console_imputations_employee
  on public.employee_console_imputations(employee_id);
create index if not exists idx_employee_console_imputations_lunes
  on public.employee_console_imputations(lunes);

-- 3. updated_at trigger
drop trigger if exists set_employee_console_imputations_updated_at on public.employee_console_imputations;
create trigger set_employee_console_imputations_updated_at
  before update on public.employee_console_imputations
  for each row execute function public.set_updated_at();

-- 4. RLS policies
alter table public.employee_console_imputations enable row level security;

-- Admins: full access
drop policy if exists "employee_console_imputations: admin all" on public.employee_console_imputations;
create policy "employee_console_imputations: admin all"
  on public.employee_console_imputations for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Employees: read their own rows (dashboard + views)
drop policy if exists "employee_console_imputations: employee read own" on public.employee_console_imputations;
create policy "employee_console_imputations: employee read own"
  on public.employee_console_imputations for select
  to authenticated
  using (
    employee_id in (
      select id from public.employees where user_id = auth.uid()
    )
  );

-- NOTE: no anon write policies on purpose. PUT /api/imputaciones writes with
-- the service-role key (SUPABASE_SERVICE_ROLE_KEY) after validating its token,
-- so the public anon key cannot modify this table.
