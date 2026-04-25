-- Add revenue_per_hour override column to opportunity_employees
ALTER TABLE public.opportunity_employees
  ADD COLUMN revenue_per_hour numeric(10,2);
