-- ============================================================
-- Delete all skills and employee skill associations
-- ============================================================

-- employee_skills and employee_specializations cascade from their
-- parent tables, but we delete explicitly to be clear.
DELETE FROM public.employee_skills;
DELETE FROM public.employee_specializations;
DELETE FROM public.skills;
DELETE FROM public.specializations;

-- Reset the "last skills update" timestamp for every employee
UPDATE public.employees SET skills_updated_at = NULL;
