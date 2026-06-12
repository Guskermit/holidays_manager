-- Add GitHub Copilot license tracking fields to employees
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS has_copilot boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS copilot_engagement text,
  ADD COLUMN IF NOT EXISTS copilot_clients text[];

-- Keep Copilot fields consistent with has_copilot flag
ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_copilot_details_check;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_copilot_details_check
  CHECK (
    (
      has_copilot = false
      AND copilot_engagement IS NULL
      AND (copilot_clients IS NULL OR cardinality(copilot_clients) = 0)
    )
    OR
    (
      has_copilot = true
      AND copilot_engagement IS NOT NULL
      AND btrim(copilot_engagement) <> ''
      AND copilot_clients IS NOT NULL
      AND cardinality(copilot_clients) > 0
    )
  );
