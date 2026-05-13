-- Add color column to minor_subprojects
ALTER TABLE minor_subprojects
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#6366f1';
