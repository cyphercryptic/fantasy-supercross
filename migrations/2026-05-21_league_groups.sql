BEGIN;

-- Persistent franchise identity that spans multiple season-leagues
CREATE TABLE IF NOT EXISTS league_groups (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Link each season-league to its franchise + track which season it is
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES league_groups(id) ON DELETE SET NULL;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS season_year INTEGER;

CREATE INDEX IF NOT EXISTS leagues_group_id_idx ON leagues(group_id);

-- Backfill: all existing leagues are from the 2026 SX season
UPDATE leagues SET season_year = 2026 WHERE season_year IS NULL;

COMMIT;
