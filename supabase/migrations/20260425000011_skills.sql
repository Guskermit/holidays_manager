-- ── Skills: global tag pool ────────────────────────────────────────────────
CREATE TABLE public.skills (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness on the name
CREATE UNIQUE INDEX skills_name_ci ON public.skills (lower(name));

-- ── Employee ↔ Skill junction ───────────────────────────────────────────────
CREATE TABLE public.employee_skills (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  skill_id    uuid        NOT NULL REFERENCES public.skills(id)    ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_skills_unique UNIQUE (employee_id, skill_id)
);

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.skills         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_skills ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read all skills (needed to show the global tag pool)
CREATE POLICY "skills_select"
  ON public.skills FOR SELECT
  TO authenticated
  USING (true);

-- Any authenticated user can add a new skill to the global pool
CREATE POLICY "skills_insert"
  ON public.skills FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Any authenticated user can read all employee_skills
-- (needed to show which colleagues have which skills in future views)
CREATE POLICY "employee_skills_select"
  ON public.employee_skills FOR SELECT
  TO authenticated
  USING (true);

-- An employee can only add skills to their own profile
CREATE POLICY "employee_skills_insert"
  ON public.employee_skills FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = public.my_employee_id());

-- An employee can only remove skills from their own profile
CREATE POLICY "employee_skills_delete"
  ON public.employee_skills FOR DELETE
  TO authenticated
  USING (employee_id = public.my_employee_id());
