-- Outdoor Motocross expansion — Phase 1 schema
-- Safe to run anytime. Does NOT modify or delete any existing SX data.
--
-- Adds:
--   1. races.series      — 'sx' (default) | 'mx' | 'smx'
--   2. leagues.series    — same enum, defaults 'sx' for existing leagues
--   3. rider_series      — per-series rider data (number, team, class, status)
--                          riders that race both SX and MX get one row per series
--   4. Backfill for existing riders: insert their current data as series='sx'
--
-- After this migration:
--   - All existing SX queries keep working (default 'sx' filter is implicit)
--   - SX riders still keep their data in the riders table — untouched
--   - MX additions go into rider_series with series='mx'
--   - Bonus types for MX (moto winners, per-moto holeshots) use TEXT column,
--     no schema change needed.

BEGIN;

-- 1. Per-series flag on races
ALTER TABLE races
  ADD COLUMN IF NOT EXISTS series TEXT NOT NULL DEFAULT 'sx';

CREATE INDEX IF NOT EXISTS races_series_status_idx ON races(series, status);
CREATE INDEX IF NOT EXISTS races_series_round_idx ON races(series, round_number);

-- 2. Per-series flag on leagues
ALTER TABLE leagues
  ADD COLUMN IF NOT EXISTS series TEXT NOT NULL DEFAULT 'sx';

-- 3. Per-series rider data
CREATE TABLE IF NOT EXISTS rider_series (
  id SERIAL PRIMARY KEY,
  rider_id INTEGER NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  series TEXT NOT NULL,
  class TEXT NOT NULL,
  number INTEGER,
  team TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  UNIQUE (rider_id, series)
);

CREATE INDEX IF NOT EXISTS rider_series_series_idx ON rider_series(series);
CREATE INDEX IF NOT EXISTS rider_series_rider_idx ON rider_series(rider_id);

-- 4. Backfill rider_series from existing riders for SX
INSERT INTO rider_series (rider_id, series, class, number, team, status)
SELECT id, 'sx', class, number, team, COALESCE(status, 'active')
FROM riders
ON CONFLICT (rider_id, series) DO NOTHING;

COMMIT;
