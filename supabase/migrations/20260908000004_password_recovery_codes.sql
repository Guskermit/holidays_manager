-- ============================================================
-- Password recovery codes — one-time-use codes for internal
-- password recovery (no email required).
-- ============================================================

-- 1. Recovery codes table
CREATE TABLE IF NOT EXISTS public.password_recovery_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  code        text NOT NULL,
  is_used     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);

-- Index for fast lookup by code
CREATE INDEX idx_password_recovery_codes_code
  ON public.password_recovery_codes (code);

-- Index for cleanup of expired codes
CREATE INDEX idx_password_recovery_codes_expires
  ON public.password_recovery_codes (expires_at);

-- RLS — only service role / server actions need access
ALTER TABLE public.password_recovery_codes ENABLE ROW LEVEL SECURITY;

-- Allow all access via service role (server actions use createClient which bypasses RLS)
CREATE POLICY "Service role full access on recovery codes"
  ON public.password_recovery_codes
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 2. Database function to update user password (SECURITY DEFINER to access auth.users)
CREATE OR REPLACE FUNCTION public.update_user_password(
  p_user_id uuid,
  p_new_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = p_user_id;
END;
$$;
