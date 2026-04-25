-- ============================================================
-- Add Socio category + Pricing (opportunities) tables
-- ============================================================

-- 1. Extend employee category check to include Socio
ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_category_check;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_category_check
  CHECK (category IN ('Staff', 'Senior', 'Manager', 'Senior-Manager', 'Externo', 'Socio'));

-- Also update category_vacation_days helper
CREATE OR REPLACE FUNCTION public.category_vacation_days(cat text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE cat
    WHEN 'Externo'        THEN 22
    WHEN 'Staff'          THEN 26
    WHEN 'Senior'         THEN 26
    WHEN 'Manager'        THEN 31
    WHEN 'Senior-Manager' THEN 31
    WHEN 'Socio'          THEN 31
    ELSE 26
  END;
$$;

-- 2. Opportunities table
CREATE TABLE public.opportunities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client      text NOT NULL,
  name        text NOT NULL,
  description text,
  margin      numeric(5,2) NOT NULL DEFAULT 0,
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  created_by  uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

-- 3. Opportunity employees (with weekly hours as JSONB)
-- hours shape: { "2026-04-28": 40, "2026-05-05": 35, ... }
-- Keys are the ISO date of each Monday (week start)
CREATE TABLE public.opportunity_employees (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  employee_id    uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  cost_per_hour  numeric(10,2) NOT NULL DEFAULT 0,
  hours          jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (opportunity_id, employee_id)
);

-- 4. RLS
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "opportunities: admin all"
  ON public.opportunities FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "opportunity_employees: admin all"
  ON public.opportunity_employees FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 5. updated_at trigger for opportunities
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER opportunities_updated_at
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
