-- Multi-league polish: a rider can only be on ONE user's roster per league.
-- Old constraint (league_id, user_id, rider_id) only prevented the same user
-- from owning a rider twice — it allowed two different users to claim the
-- same rider in the same league (race condition during free agency).

ALTER TABLE league_rosters
  DROP CONSTRAINT IF EXISTS league_rosters_league_id_user_id_rider_id_key;

ALTER TABLE league_rosters
  ADD CONSTRAINT league_rosters_league_id_rider_id_unique UNIQUE (league_id, rider_id);
