-- Allow assigning one employee to multiple teams within a project.
CREATE TABLE public.employee_project_teams (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_project_id uuid NOT NULL REFERENCES public.employee_projects(id) ON DELETE CASCADE,
  team_id             uuid NOT NULL REFERENCES public.project_teams(id) ON DELETE CASCADE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_project_id, team_id)
);

ALTER TABLE public.employee_project_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_project_teams: admin all"
  ON public.employee_project_teams FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "employee_project_teams: read all authenticated"
  ON public.employee_project_teams FOR SELECT
  TO authenticated
  USING (true);

-- Backfill existing single-team assignments from employee_projects.team_id.
INSERT INTO public.employee_project_teams (employee_project_id, team_id)
SELECT ep.id, ep.team_id
FROM public.employee_projects ep
WHERE ep.team_id IS NOT NULL
ON CONFLICT (employee_project_id, team_id) DO NOTHING;
