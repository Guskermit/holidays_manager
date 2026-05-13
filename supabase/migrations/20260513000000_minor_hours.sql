-- ============================================================
-- Minor Hours feature
-- ============================================================
-- 1. Add weekly_hours to employees (default 42)
-- 2. Add is_minor flag to projects
-- 3. Create minor_subprojects table
-- 4. Create minor_hours table
-- 5. Helper functions + RLS policies
-- ============================================================

-- ── 1. New columns ────────────────────────────────────────────────────────────

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS weekly_hours integer NOT NULL DEFAULT 42;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS is_minor boolean NOT NULL DEFAULT false;

-- ── 2. minor_subprojects ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS minor_subprojects (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  active     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE minor_subprojects ENABLE ROW LEVEL SECURITY;

-- ── 3. minor_hours ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS minor_hours (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   uuid          NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  subproject_id uuid          NOT NULL REFERENCES minor_subprojects(id) ON DELETE CASCADE,
  week_start    date          NOT NULL,   -- always the Monday of the week (ISO: YYYY-MM-DD)
  hours         numeric(5,1)  NOT NULL DEFAULT 0 CHECK (hours >= 0),
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT minor_hours_unique UNIQUE (employee_id, subproject_id, week_start)
);

ALTER TABLE minor_hours ENABLE ROW LEVEL SECURITY;

-- ── 4. Helper functions ───────────────────────────────────────────────────────

-- Returns true when the current user is assigned to at least one minor project.
CREATE OR REPLACE FUNCTION is_in_minor_project() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   employee_projects ep
    JOIN   projects p ON p.id_engagement = ep.project_id
    WHERE  ep.employee_id = my_employee_id()
    AND    p.is_minor = true
  );
$$;

-- Returns true when the current user is an admin AND is in a minor project.
CREATE OR REPLACE FUNCTION is_minor_admin() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT is_admin() AND is_in_minor_project();
$$;

-- ── 5. RLS policies: minor_subprojects ───────────────────────────────────────

-- Minor members and all admins can read subprojects
CREATE POLICY "minor_subprojects_select" ON minor_subprojects
  FOR SELECT TO authenticated
  USING (is_in_minor_project() OR is_admin());

-- Only minor admins can create/edit/delete subprojects
CREATE POLICY "minor_subprojects_insert" ON minor_subprojects
  FOR INSERT TO authenticated
  WITH CHECK (is_minor_admin());

CREATE POLICY "minor_subprojects_update" ON minor_subprojects
  FOR UPDATE TO authenticated
  USING (is_minor_admin());

CREATE POLICY "minor_subprojects_delete" ON minor_subprojects
  FOR DELETE TO authenticated
  USING (is_minor_admin());

-- ── 6. RLS policies: minor_hours ─────────────────────────────────────────────

-- Employees see their own rows; minor admins see all
CREATE POLICY "minor_hours_select" ON minor_hours
  FOR SELECT TO authenticated
  USING (employee_id = my_employee_id() OR is_minor_admin());

-- Employees can only insert their own rows (must be in minor project)
CREATE POLICY "minor_hours_insert" ON minor_hours
  FOR INSERT TO authenticated
  WITH CHECK (employee_id = my_employee_id() AND is_in_minor_project());

-- Employees can update their own rows
CREATE POLICY "minor_hours_update" ON minor_hours
  FOR UPDATE TO authenticated
  USING (employee_id = my_employee_id() AND is_in_minor_project());

-- Employees can delete their own rows
CREATE POLICY "minor_hours_delete" ON minor_hours
  FOR DELETE TO authenticated
  USING (employee_id = my_employee_id() AND is_in_minor_project());
