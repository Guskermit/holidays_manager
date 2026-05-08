-- ============================================================
-- Employee account approval workflow
-- New employees must be approved by an admin before they can
-- access the application.
-- ============================================================

-- 1. Add approved column (existing employees are auto-approved)
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT true;

-- 2. Update handle_new_user() trigger to create accounts as NOT approved
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.employees (user_id, name, email, office, category, company, approved)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'office', 'madrid'),
    COALESCE(NEW.raw_user_meta_data->>'category', 'Staff'),
    NEW.raw_user_meta_data->>'company',
    false  -- must be approved by admin before access
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 3. Allow employees to read their own approved status (already covered by
--    the existing "employees: read own" policy, no change needed).

-- 4. Admin can update the approved column
-- The existing "employees: admin update all" policy already covers this.

-- 5. Index for fast lookup of pending approvals
CREATE INDEX IF NOT EXISTS employees_approved_idx ON public.employees (approved);
