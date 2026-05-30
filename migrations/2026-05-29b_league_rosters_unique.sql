-- Fix: draft never populated league_rosters (2026-05-29)
-- The draft POST/PATCH upsert into league_rosters uses
--   ON CONFLICT (league_id, user_id, rider_id)
-- but no matching unique constraint existed, so every upsert failed with
-- 42P10 and was swallowed (error unchecked) -> 0 roster rows after a draft.
-- Adding the constraint makes the existing upsert work as intended.
-- Verified 0 existing duplicate (league_id,user_id,rider_id) rows before adding.

ALTER TABLE league_rosters
  ADD CONSTRAINT league_rosters_league_user_rider_unique
  UNIQUE (league_id, user_id, rider_id);
