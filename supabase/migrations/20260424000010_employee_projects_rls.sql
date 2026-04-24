-- Allow admins to read all employee_projects (needed for summary/project views)
create policy "employee_projects: admin read all"
  on public.employee_projects for select
  to authenticated
  using (public.is_admin());

-- Allow any authenticated user to read employee_projects (needed for non-admin views)
-- (only if not already covered by another policy)
create policy "employee_projects: read all authenticated"
  on public.employee_projects for select
  to authenticated
  using (true);
