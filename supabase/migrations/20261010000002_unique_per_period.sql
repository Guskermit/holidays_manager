-- Allow multiple imputation periods per employee-engagement (for per-week editing)
-- Change unique constraint from (employee_id, engagement_id) to (employee_id, engagement_id, start_date)
ALTER TABLE public.employee_imputations
  DROP CONSTRAINT IF EXISTS employee_imputations_employee_id_engagement_id_key;

ALTER TABLE public.employee_imputations
  ADD CONSTRAINT employee_imputations_unique_per_period
  UNIQUE (employee_id, engagement_id, start_date);