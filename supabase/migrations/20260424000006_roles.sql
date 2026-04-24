-- ============================================================
-- Add role column to employees and restrict projects to admins
-- ============================================================

-- 1. Add role column
alter table public.employees
  add column role text not null default 'employee'
  check (role in ('employee', 'admin'));

-- 2. Helper function: returns true if the current user is admin
create or replace function public.is_admin()
  returns boolean
  language sql
  security definer
  stable
as $$
  select exists (
    select 1 from public.employees
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- 3. Replace open project policies with admin-only ones
drop policy if exists "projects: insert authenticated"      on public.projects;
drop policy if exists "projects: update authenticated"      on public.projects;
drop policy if exists "projects: delete authenticated"      on public.projects;

create policy "projects: admin insert"
  on public.projects for insert
  to authenticated
  with check (public.is_admin());

create policy "projects: admin update"
  on public.projects for update
  to authenticated
  using (public.is_admin());

create policy "projects: admin delete"
  on public.projects for delete
  to authenticated
  using (public.is_admin());

-- 4. Replace open employee_projects policies with admin-only ones
drop policy if exists "employee_projects: insert authenticated" on public.employee_projects;
drop policy if exists "employee_projects: update authenticated" on public.employee_projects;
drop policy if exists "employee_projects: delete authenticated" on public.employee_projects;

create policy "employee_projects: admin insert"
  on public.employee_projects for insert
  to authenticated
  with check (public.is_admin());

create policy "employee_projects: admin update"
  on public.employee_projects for update
  to authenticated
  using (public.is_admin());

create policy "employee_projects: admin delete"
  on public.employee_projects for delete
  to authenticated
  using (public.is_admin());
