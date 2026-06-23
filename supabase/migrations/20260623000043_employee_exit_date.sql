-- ============================================================
-- Add exit_date to employees table
-- When set (and in the past), the employee is considered "given low" (baja):
--   - Hidden from vacation reports and availability views
--   - Excluded from skills analytics and search
--   - Excluded from Copilot license management
--   - Excluded from statistics
--   - Cannot submit new Minor hours (employee view is blocked)
--   - Historical Minor hours remain visible in the admin view
-- ============================================================

alter table public.employees
  add column exit_date date;

comment on column public.employees.exit_date is
  'Date the employee left the company. NULL = still active. When set and <= today the employee is treated as inactive (baja).';
