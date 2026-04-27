-- ============================================================
-- Add 'zaragoza' to the office CHECK constraint on employees
-- ============================================================

alter table public.employees
  drop constraint if exists employees_office_check;

alter table public.employees
  add constraint employees_office_check
    check (office in ('madrid', 'barcelona', 'valencia', 'malaga', 'zaragoza'));
