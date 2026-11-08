-- ============================================================
-- Public read policies for the employee time-off API endpoint
-- Allows unauthenticated (anon) read access to the tables
-- needed by GET /api/employees/[email]/time-off
-- ============================================================

-- Vacation requests: anyone can read (time-off API)
create policy "vacation_requests: public read"
  on public.vacation_requests for select
  to anon
  using (true);

-- Public holidays: anyone can read (time-off API)
create policy "public_holidays: public read"
  on public.public_holidays for select
  to anon
  using (true);
