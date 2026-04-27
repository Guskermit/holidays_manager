-- ============================================================
-- Configurable vacation days per category
-- ============================================================

create table public.category_vacation_days (
  category      text primary key,
  vacation_days integer not null check (vacation_days > 0),
  updated_at    timestamptz not null default now()
);

-- Seed defaults
insert into public.category_vacation_days (category, vacation_days) values
  ('Staff',          26),
  ('Senior',         26),
  ('Manager',        31),
  ('Senior-Manager', 31),
  ('Externo',        22),
  ('Socio',          31);

-- RLS
alter table public.category_vacation_days enable row level security;

create policy "category_vacation_days: read authenticated"
  on public.category_vacation_days for select
  to authenticated
  using (true);

create policy "category_vacation_days: admin update"
  on public.category_vacation_days for update
  to authenticated
  using (public.is_admin());
