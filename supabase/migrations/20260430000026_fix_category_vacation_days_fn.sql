-- Replace the immutable category_vacation_days() function with one that
-- reads from the category_vacation_days table (configured via Vacation Settings).
-- Falls back to sensible defaults if the row is missing.
CREATE OR REPLACE FUNCTION public.category_vacation_days(cat text)
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
