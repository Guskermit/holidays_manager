-- Revert broad read policy added for opportunities.
-- Copilot self-service now uses projects as source of options.
DROP POLICY IF EXISTS "opportunities: authenticated read" ON public.opportunities;
