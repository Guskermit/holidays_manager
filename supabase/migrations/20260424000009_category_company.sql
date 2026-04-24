-- ============================================================
-- Add category and company columns to employees
-- ============================================================

alter table public.employees
  add column category text not null default 'Staff'
    check (category in ('Staff', 'Senior', 'Manager', 'Senior-Manager', 'Externo')),
  add column company text;

-- Helper function: vacation days by category
create or replace function public.category_vacation_days(cat text)
returns integer
language sql
immutable
as $$
  select case cat
    when 'Externo'        then 22
    when 'Staff'          then 26
    when 'Senior'         then 26
    when 'Manager'        then 31
    when 'Senior-Manager' then 31
    else 26
  end;
$$;

-- Update handle_new_user trigger to include category, company, and auto-create balance
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
  v_category    text;
  v_company     text;
  v_total_days  integer;
begin
  v_category := coalesce(new.raw_user_meta_data ->> 'category', 'Staff');
  v_company  := new.raw_user_meta_data ->> 'company';

  insert into public.employees (user_id, name, email, office, category, company)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'office', 'madrid'),
    v_category,
    v_company
  )
  returning id into v_employee_id;

  -- Create vacation balance for current year based on category
  v_total_days := public.category_vacation_days(v_category);
  insert into public.vacation_balances (employee_id, year, total_days)
  values (v_employee_id, extract(year from now())::integer, v_total_days)
  on conflict (employee_id, year) do nothing;

  return new;
end;
$$;
