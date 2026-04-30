-- Safe colleague-visibility policies.
-- Uses a SECURITY DEFINER helper to read employee_projects without RLS,
-- avoiding any self-referential policy that could cause infinite recursion.

-- Helper: returns the project IDs the current user is assigned to.
CREATE OR REPLACE FUNCTION public.my_project_ids()
RETURNS text[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT ARRAY(
    SELECT project_id FROM public.employee_projects
    WHERE employee_id = public.my_employee_id()
  );
$$;

-- Employees can read the basic profile of colleagues in shared projects.
CREATE POLICY "employees: read project colleagues"
  ON public.employees FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT employee_id FROM public.employee_projects
      WHERE project_id = ANY(public.my_project_ids())
    )
  );

-- Employees can read vacation requests of colleagues in shared projects.
CREATE POLICY "vacation_requests: read project colleagues"
  ON public.vacation_requests FOR SELECT
  TO authenticated
  USING (
    employee_id IN (
      SELECT employee_id FROM public.employee_projects
      WHERE project_id = ANY(public.my_project_ids())
    )
  );

-- Employees can read vacation balances of colleagues in shared projects.
CREATE POLICY "vacation_balances: read project colleagues"
  ON public.vacation_balances FOR SELECT
  TO authenticated
  USING (
    employee_id IN (
      SELECT employee_id FROM public.employee_projects
      WHERE project_id = ANY(public.my_project_ids())
    )
  );
