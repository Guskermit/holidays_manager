-- ============================================================
-- Add super-admin role
-- ============================================================

-- 1. Expand role check to include 'super-admin'
ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_role_check;
ALTER TABLE public.employees
  ADD CONSTRAINT employees_role_check
  CHECK (role IN ('employee', 'admin', 'super-admin'));

-- 2. is_super_admin() helper
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees
    WHERE user_id = auth.uid() AND role = 'super-admin'
  );
$$;

-- 3. Update is_admin() so super-admins are also admins
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees
    WHERE user_id = auth.uid() AND role IN ('admin', 'super-admin')
  );
$$;

-- 4. Replace the admin update policy to protect super-admin rows
DROP POLICY IF EXISTS "employees: admin update all" ON public.employees;
CREATE POLICY "employees: admin update all"
  ON public.employees FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    AND (role != 'super-admin' OR public.is_super_admin())
  )
  WITH CHECK (
    public.is_admin()
    AND (role != 'super-admin' OR public.is_super_admin())
  );

-- 5. Promote gustavo to super-admin
UPDATE public.employees
  SET role = 'super-admin'
WHERE email = 'gustavo.lopezmartinez@es.ey.com';
