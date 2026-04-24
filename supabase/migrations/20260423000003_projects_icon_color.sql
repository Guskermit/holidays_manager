-- ============================================================
-- Add icon_url and color columns to projects
-- ============================================================

alter table public.projects
  add column color    text not null default '#6366f1',
  add column icon_url text;

-- ── Supabase Storage: project-icons bucket ───────────────────

insert into storage.buckets (id, name, public)
values ('project-icons', 'project-icons', true)
on conflict (id) do nothing;

-- Anyone authenticated can upload icons
create policy "project-icons: upload authenticated"
  on storage.objects for insert
  with check (
    bucket_id = 'project-icons'
    and auth.role() = 'authenticated'
  );

-- Publicly readable (bucket is public, but policy still required)
create policy "project-icons: public read"
  on storage.objects for select
  using (bucket_id = 'project-icons');

-- Authenticated users can replace / delete their uploads
create policy "project-icons: update authenticated"
  on storage.objects for update
  using (
    bucket_id = 'project-icons'
    and auth.role() = 'authenticated'
  );

create policy "project-icons: delete authenticated"
  on storage.objects for delete
  using (
    bucket_id = 'project-icons'
    and auth.role() = 'authenticated'
  );
