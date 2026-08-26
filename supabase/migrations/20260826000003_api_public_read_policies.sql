-- ============================================================
-- Public read policies for the engagements API endpoint
-- Allows unauthenticated (anon) read access to the tables
-- needed by GET /api/engagements/[code]
-- ============================================================

-- Engagements: anyone can read
create policy "engagements: public read"
  on public.engagements for select
  to anon
  using (true);

-- Employee imputations: anyone can read
create policy "employee_imputations: public read"
  on public.employee_imputations for select
  to anon
  using (true);

-- Employees: anyone can read (needed for employee details in the API)
create policy "employees: public read"
  on public.employees for select
  to anon
  using (true);

-- Projects: anyone can read (needed for client name resolution)
create policy "projects: public read"
  on public.projects for select
  to anon
  using (true);

-- ============================================================
-- Public write policies for the notifications API endpoint
-- Allows unauthenticated (anon) INSERT on notifications and recipients
-- used by GET /api/notifications/send
-- ============================================================

-- Notifications: anon can insert (API-created notifications)
create policy "notifications: public insert"
  on public.notifications for insert
  to anon
  with check (true);

-- Notification recipients: anon can insert (API-created recipients)
create policy "notification_recipients: public insert"
  on public.notification_recipients for insert
  to anon
  with check (true);
