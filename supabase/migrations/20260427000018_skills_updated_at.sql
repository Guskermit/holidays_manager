-- ============================================================
-- Track when each employee last updated their skills profile
-- ============================================================

-- Add skills_updated_at column to employees table.
-- NULL means the employee has never registered any skill.
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS skills_updated_at timestamptz;
