-- ============================================================
-- Fix: missing INSERT/UPDATE/DELETE policies on projects
-- ============================================================
-- The initial schema only had a SELECT policy for projects.
-- Any authenticated user can create and manage projects for now.
-- Tighten to admin-only when role management is implemented.

create policy "projects: insert authenticated"
  on public.projects for insert
  with check (auth.role() = 'authenticated');

create policy "projects: update authenticated"
  on public.projects for update
  using (auth.role() = 'authenticated');

create policy "projects: delete authenticated"
  on public.projects for delete
  using (auth.role() = 'authenticated');

-- employee_projects: allow authenticated users to manage assignments
create policy "employee_projects: insert authenticated"
  on public.employee_projects for insert
  with check (auth.role() = 'authenticated');

create policy "employee_projects: update authenticated"
  on public.employee_projects for update
  using (auth.role() = 'authenticated');

create policy "employee_projects: delete authenticated"
  on public.employee_projects for delete
  using (auth.role() = 'authenticated');
