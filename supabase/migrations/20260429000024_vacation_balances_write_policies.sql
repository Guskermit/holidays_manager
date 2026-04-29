-- Allow employees to insert their own vacation balance row (created on first request)
create policy "vacation_balances: insert own"
  on public.vacation_balances for insert
  with check (employee_id = public.my_employee_id());

-- Allow employees to update their own vacation balance (used/pending days)
create policy "vacation_balances: update own"
  on public.vacation_balances for update
  using (employee_id = public.my_employee_id());

-- Allow admins to insert vacation balances for any employee
create policy "vacation_balances: admin insert all"
  on public.vacation_balances for insert
  with check (public.is_admin());

-- Allow admins to update vacation balances for any employee (approve/reject, settings sync)
create policy "vacation_balances: admin update all"
  on public.vacation_balances for update
  using (public.is_admin());
