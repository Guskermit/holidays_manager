-- ============================================================
-- Fix: infinite recursion in employees RLS policies
-- ============================================================
-- Policies that query public.employees from within an employees
-- policy trigger recursion. We solve this with a SECURITY DEFINER
-- function that bypasses RLS to return the current user's employee id.

create or replace function public.my_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.employees where user_id = auth.uid() limit 1;
$$;

-- ── Re-create employees policies ─────────────────────────────

drop policy if exists "employees: read own"            on public.employees;
drop policy if exists "employees: update own"          on public.employees;
drop policy if exists "employees: manager reads reports" on public.employees;

create policy "employees: read own"
  on public.employees for select
  using (user_id = auth.uid());

create policy "employees: update own"
  on public.employees for update
  using (user_id = auth.uid());

create policy "employees: manager reads reports"
  on public.employees for select
  using (manager_id = public.my_employee_id());

-- ── Re-create vacation_requests policies ─────────────────────

drop policy if exists "vacation_requests: read own"           on public.vacation_requests;
drop policy if exists "vacation_requests: insert own"         on public.vacation_requests;
drop policy if exists "vacation_requests: update own pending" on public.vacation_requests;
drop policy if exists "vacation_requests: manager resolves"   on public.vacation_requests;
drop policy if exists "vacation_requests: manager reads reports" on public.vacation_requests;

create policy "vacation_requests: read own"
  on public.vacation_requests for select
  using (employee_id = public.my_employee_id());

create policy "vacation_requests: insert own"
  on public.vacation_requests for insert
  with check (employee_id = public.my_employee_id());

create policy "vacation_requests: update own pending"
  on public.vacation_requests for update
  using (
    employee_id = public.my_employee_id()
    and status = 'pending'
  );

create policy "vacation_requests: manager resolves"
  on public.vacation_requests for update
  using (
    employee_id in (
      select id from public.employees
      where manager_id = public.my_employee_id()
    )
  );

create policy "vacation_requests: manager reads reports"
  on public.vacation_requests for select
  using (
    employee_id in (
      select id from public.employees
      where manager_id = public.my_employee_id()
    )
  );

-- ── Re-create vacation_balances policies ─────────────────────

drop policy if exists "vacation_balances: read own" on public.vacation_balances;

create policy "vacation_balances: read own"
  on public.vacation_balances for select
  using (employee_id = public.my_employee_id());

-- ── Re-create employee_projects policies ─────────────────────

drop policy if exists "employee_projects: read own" on public.employee_projects;

create policy "employee_projects: read own"
  on public.employee_projects for select
  using (employee_id = public.my_employee_id());
