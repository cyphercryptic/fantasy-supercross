-- Per-moto breakdown for MX race results.
-- race_results stores one row per rider per event (position = avg finish across
-- motos, points = summed). To show each moto's individual finish on the rider
-- profile, add a nullable JSONB column holding the per-moto detail:
--   [{ "moto": 1, "position": 3, "points": 10 }, { "moto": 2, "position": 6, "points": 4 }]
-- NULL for SX (single main) and for any MX row imported before this column existed
-- (re-import / backfill repopulates it). The auto-import writes it for MX going forward.

ALTER TABLE race_results ADD COLUMN IF NOT EXISTS moto_results JSONB;
