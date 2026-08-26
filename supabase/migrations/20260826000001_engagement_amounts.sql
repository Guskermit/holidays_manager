-- ============================================================
-- Add total_amount and estimated_expenses to engagements table
-- ============================================================

alter table public.engagements
  add column if not exists total_amount numeric(12,2) default 0,
  add column if not exists estimated_expenses numeric(12,2) default 0;
