-- ============================================================
-- Add Intern (Becario) category
-- ============================================================

-- 1. Extend the employees category check constraint to include 'Intern'
ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_category_check;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_category_check
  CHECK (category IN ('Staff', 'Senior', 'Manager', 'Senior-Manager', 'Externo', 'Socio', 'Intern'));

-- 2. Allow 0 vacation days so Intern can be seeded with 0
ALTER TABLE public.category_vacation_days
  DROP CONSTRAINT IF EXISTS category_vacation_days_vacation_days_check;

ALTER TABLE public.category_vacation_days
  ADD CONSTRAINT category_vacation_days_vacation_days_check
  CHECK (vacation_days >= 0);

-- 3. Seed Intern with 0 vacation days
INSERT INTO public.category_vacation_days (category, vacation_days)
VALUES ('Intern', 0)
ON CONFLICT (category) DO NOTHING;
