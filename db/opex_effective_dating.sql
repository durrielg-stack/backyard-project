-- OPEX effective dating (2026-09-21)
--
-- `opex_items` rows become month-versioned: one row per (item, amount era).
-- Both effective columns are MONTH-START dates (day = 1) and are INCLUSIVE.
-- A row applies to month M (M = first day of that month) iff
--   effective_from <= M AND (effective_to IS NULL OR effective_to >= M)
--
-- Changing an amount never rewrites history: close the current row
-- (effective_to = month before the change) and insert a new row.

ALTER TABLE public.opex_items
  ADD COLUMN IF NOT EXISTS effective_from date NOT NULL DEFAULT '2000-01-01',
  ADD COLUMN IF NOT EXISTS effective_to   date;

ALTER TABLE public.opex_items
  ADD CONSTRAINT opex_items_effective_from_month_start
    CHECK (EXTRACT(DAY FROM effective_from) = 1),
  ADD CONSTRAINT opex_items_effective_to_month_start
    CHECK (effective_to IS NULL OR EXTRACT(DAY FROM effective_to) = 1),
  ADD CONSTRAINT opex_items_effective_range
    CHECK (effective_to IS NULL OR effective_to >= effective_from);

COMMENT ON COLUMN public.opex_items.effective_from IS
  'Month-start date (day=1). First month this version applies to. Inclusive.';
COMMENT ON COLUMN public.opex_items.effective_to IS
  'Month-start date (day=1), or NULL for open-ended. Last month this version applies to. Inclusive.';
