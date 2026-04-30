-- Revert migration 20260430000025_vacation_overview_colleague_policies.sql
-- Drop the three colleague-visibility policies that caused admin access issues.

DROP POLICY IF EXISTS "employee_projects: read colleagues"       ON public.employee_projects;
DROP POLICY IF EXISTS "employees: read project colleagues"       ON public.employees;
DROP POLICY IF EXISTS "vacation_requests: read project colleagues" ON public.vacation_requests;
