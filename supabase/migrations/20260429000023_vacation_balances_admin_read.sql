-- Allow admins to read all vacation balances (needed for the overview table)
create policy "vacation_balances: admin read all"
  on public.vacation_balances for select
  to authenticated
  using (public.is_admin());
