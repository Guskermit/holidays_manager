-- Teams are named subgroups within a project
CREATE TABLE project_teams (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES projects(id_engagement) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, name)
);

ALTER TABLE project_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_all" ON project_teams
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super-admin')
    )
  );

CREATE POLICY "authenticated_read" ON project_teams
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Add team assignment to employee_projects
ALTER TABLE employee_projects
  ADD COLUMN team_id uuid REFERENCES project_teams(id) ON DELETE SET NULL;
