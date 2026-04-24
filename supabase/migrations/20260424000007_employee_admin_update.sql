-- Allow admins to update any employee row
create policy "employees: admin update all"
  on public.employees for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
