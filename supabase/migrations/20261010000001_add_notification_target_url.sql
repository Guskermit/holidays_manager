-- Add target_url column so clicking a notification navigates to the right section
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS target_url text;
