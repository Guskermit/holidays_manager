-- ============================================================
-- Skills expertise levels + Specializations
-- ============================================================

-- ── Add expertise level to employee_skills ──────────────────
-- 0 = sin conocimiento, 1 = necesita supervisión (default),
-- 2 = autónomo, 3 = puede liderar
ALTER TABLE public.employee_skills
  ADD COLUMN level smallint NOT NULL DEFAULT 1
  CHECK (level >= 0 AND level <= 3);

-- Allow employees to update the level of their own skills
CREATE POLICY "employee_skills_update"
  ON public.employee_skills FOR UPDATE
  TO authenticated
  USING (employee_id = public.my_employee_id());

-- ── Specializations: global tag pool ────────────────────────
CREATE TABLE public.specializations (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX specializations_name_ci ON public.specializations (lower(name));

-- ── Employee ↔ Specialization junction ──────────────────────
CREATE TABLE public.employee_specializations (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       uuid        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  specialization_id uuid        NOT NULL REFERENCES public.specializations(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_specializations_unique UNIQUE (employee_id, specialization_id)
);

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.specializations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_specializations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "specializations_select"
  ON public.specializations FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "specializations_insert"
  ON public.specializations FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "employee_specializations_select"
  ON public.employee_specializations FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "employee_specializations_insert"
  ON public.employee_specializations FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = public.my_employee_id());

CREATE POLICY "employee_specializations_delete"
  ON public.employee_specializations FOR DELETE
  TO authenticated
  USING (employee_id = public.my_employee_id());
