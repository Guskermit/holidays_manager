-- ============================================================
-- Default weekly imputation hours per category
-- regular_hours  = hours/week in standard season
-- summer_hours   = hours/week in summer season (Jun–Sep)
-- ============================================================

create table if not exists public.engagement_hours_settings (
  category      text primary key,
  regular_hours numeric(4,1) not null check (regular_hours >= 0),
  summer_hours  numeric(4,1) not null check (summer_hours >= 0),
  updated_at    timestamptz not null default now()
);

-- Seed default values
insert into public.engagement_hours_settings (category, regular_hours, summer_hours)
values
  ('Staff',         42, 30),
  ('Senior',        42, 30),
  ('Manager',       29, 21),
  ('Senior-Manager',21, 15),
  ('Externo',       42, 30),
  ('Socio',         42, 30),
  ('Intern',        42, 30)
on conflict (category) do nothing;

-- RLS
alter table public.engagement_hours_settings enable row level security;

create policy "hours_settings: admin all"
  on public.engagement_hours_settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "hours_settings: authenticated read"
  on public.engagement_hours_settings for select
  to authenticated
  using (true);
