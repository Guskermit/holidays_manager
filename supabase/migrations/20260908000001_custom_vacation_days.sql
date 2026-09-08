-- Add custom_vacation_days to employees table.
-- When set (NOT NULL and >= 0), it overrides the category-based vacation days
-- for that employee. When NULL, the category default is used.
ALTER TABLE public.employees
  ADD COLUMN custom_vacation_days integer;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_custom_vacation_days_check
  CHECK (custom_vacation_days IS NULL OR custom_vacation_days >= 0);

COMMENT ON COLUMN public.employees.custom_vacation_days
  IS 'Días de vacaciones personalizados para este empleado. Si es NULL se usa el valor de la categoría.';
