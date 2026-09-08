-- Create vacation balances for 2027 for all active employees.
-- Uses COALESCE to respect custom_vacation_days if set, otherwise category default.
-- Idempotent: ON CONFLICT DO NOTHING.

INSERT INTO vacation_balances (employee_id, year, total_days, used_days, pending_days)
SELECT
  e.id,
  2027,
  COALESCE(e.custom_vacation_days, public.get_category_vacation_days(e.category)),
  0,
  0
FROM employees e
WHERE e.approved = true
  AND (e.exit_date IS NULL OR e.exit_date > '2027-01-31')
ON CONFLICT (employee_id, year) DO NOTHING;
