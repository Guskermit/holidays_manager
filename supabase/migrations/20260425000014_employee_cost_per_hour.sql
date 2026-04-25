-- Add cost_per_hour to employees
ALTER TABLE public.employees
  ADD COLUMN cost_per_hour numeric(10,2);
