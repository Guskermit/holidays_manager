-- Allow employees to read project assignments of colleagues in shared projects.
-- The inner subquery references employee_projects itself; PostgreSQL does NOT
-- apply RLS recursively on self-referential policy expressions.
create policy "employee_projects: read colleagues"
  on public.employee_projects for select
  to authenticated
  using (
    project_id in (
      select project_id from public.employee_projects
      where employee_id = public.my_employee_id()
    )
  );

-- Allow employees to read the basic profile of colleagues who share a project.
create policy "employees: read project colleagues"
  on public.employees for select
  to authenticated
  using (
    id in (
      select ep.employee_id from public.employee_projects ep
      where ep.project_id in (
        select ep2.project_id from public.employee_projects ep2
        where ep2.employee_id = public.my_employee_id()
      )
    )
  );

-- Allow employees to read vacation requests of colleagues who share a project.
create policy "vacation_requests: read project colleagues"
  on public.vacation_requests for select
  to authenticated
  using (
    employee_id in (
      select ep.employee_id from public.employee_projects ep
      where ep.project_id in (
        select ep2.project_id from public.employee_projects ep2
        where ep2.employee_id = public.my_employee_id()
      )
    )
  );
