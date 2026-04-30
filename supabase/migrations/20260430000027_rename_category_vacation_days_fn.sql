-- Rename the helper function to avoid name collision with the
-- category_vacation_days TABLE (which PostgREST may misroute).
-- Old name: public.category_vacation_days(cat text)
-- New name: public.get_category_vacation_days(cat text)

CREATE OR REPLACE FUNCTION public.get_category_vacation_days(cat text)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT vacation_days FROM public.category_vacation_days WHERE category = cat LIMIT 1),
    CASE cat
      WHEN 'Externo'        THEN 22
      WHEN 'Staff'          THEN 26
      WHEN 'Senior'         THEN 26
      WHEN 'Manager'        THEN 31
      WHEN 'Senior-Manager' THEN 31
      WHEN 'Socio'          THEN 31
      WHEN 'Intern'         THEN 0
      ELSE 26
    END
  );
$$;

-- Update handle_new_user to use the renamed function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id uuid;
  v_category    text;
  v_company     text;
  v_total_days  integer;
BEGIN
  v_category := COALESCE(NEW.raw_user_meta_data ->> 'category', 'Staff');
  v_company  := NEW.raw_user_meta_data ->> 'company';

  INSERT INTO public.employees (user_id, name, email, office, category, company)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'office', 'madrid'),
    v_category,
    v_company
  )
  RETURNING id INTO v_employee_id;

  -- Use renamed function to avoid table/function name collision
  v_total_days := public.get_category_vacation_days(v_category);
  INSERT INTO public.vacation_balances (employee_id, year, total_days)
  VALUES (v_employee_id, EXTRACT(YEAR FROM now())::integer, v_total_days)
  ON CONFLICT (employee_id, year) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Drop the old function (now replaced by get_category_vacation_days)
DROP FUNCTION IF EXISTS public.category_vacation_days(text);
