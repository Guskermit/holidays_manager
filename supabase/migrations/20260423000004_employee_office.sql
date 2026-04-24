-- ============================================================
-- Add office column to employees
-- ============================================================

alter table public.employees
  add column office text
    not null default 'madrid'
    check (office in ('madrid', 'barcelona', 'valencia', 'malaga'));

-- Update the trigger so it also persists the office chosen at sign-up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.employees (user_id, name, email, office)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'office', 'madrid')
  );
  return new;
end;
$$;
