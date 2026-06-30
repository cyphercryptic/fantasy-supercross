-- 2026-06-30_mx_carson_wood_r3_backfill.sql
--
-- Backfill Carson Wood's Round 3 (Thunder Valley National, race_id=26) 250 result.
--
-- He made his 250 pro debut at R3 (Jun 13) but wasn't added to the rider pool
-- until Jun 15 (see 2026-06-14_mx_carson_wood.sql), AFTER the R3 import had run,
-- so the importer's name-match couldn't find him and his R3 result row was never
-- written. His R4 (High Point) row imported fine since he was in the pool by then.
--
-- Official source (results.promotocross.com event 507938):
--   250 Moto 1: P27 -> getMxMotoPoints(27) = 0 pts
--   250 Moto 2: P10 -> getMxMotoPoints(10) = 3 pts
--   total = 3 pts; stored position = round((27+10)/2) = 19 (running avg finish)
--
-- Carson Wood (#226, id=247) is a FREE AGENT (unrostered) -> ZERO standings
-- impact. This is purely data completeness so his rider card shows his R3 debut.
--
-- Applied to prod via a service-role PostgREST upsert (no explicit id, so the
-- race_results sequence self-advances — same path the importer uses). This file
-- is the idempotent record; re-applying is a safe no-op.

insert into race_results (race_id, rider_id, position, points, moto_results)
values (
  26,   -- Thunder Valley National (R3)
  247,  -- Carson Wood #226
  19,   -- avg finish: round((27 + 10) / 2)
  3,
  '[{"moto":1,"position":27,"points":0},{"moto":2,"position":10,"points":3}]'::jsonb
)
on conflict (race_id, rider_id) do update
  set position     = excluded.position,
      points       = excluded.points,
      moto_results = excluded.moto_results;
