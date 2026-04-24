-- Allow admins to read all vacation requests
create policy "vacation_requests: admin read all"
  on public.vacation_requests for select
  to authenticated
  using (public.is_admin());

-- Allow admins to update (approve/reject) any vacation request
create policy "vacation_requests: admin update all"
  on public.vacation_requests for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Allow admins to read all employees (summary + approval views)
create policy "employees: admin read all"
  on public.employees for select
  to authenticated
  using (public.is_admin());
