-- ============================================================
-- Allow employees to cancel their own vacation requests when:
--   · status is 'pending', OR
--   · status is 'approved' and the request starts in the future
-- ============================================================

-- Replace the existing employee update policy with a broader one
drop policy if exists "vacation_requests: update own pending" on public.vacation_requests;

create policy "vacation_requests: employee cancel"
  on public.vacation_requests for update
  using (
    employee_id = public.my_employee_id()
    and (
      status = 'pending'
      or (status = 'approved' and start_date > current_date)
    )
  )
  with check (
    employee_id = public.my_employee_id()
    and status = 'cancelled'
  );
