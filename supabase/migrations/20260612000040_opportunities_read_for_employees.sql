-- Allow authenticated employees to read opportunities
-- so they can select real clients in the Copilot self-service form.
CREATE POLICY "opportunities: authenticated read"
  ON public.opportunities FOR SELECT
  TO authenticated
  USING (true);
