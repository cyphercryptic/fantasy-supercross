-- Set MX race_time to first-moto gate drop so lineups lock at gate drop.
-- Source: promotocross.com/tv-schedule (2026). The published "Gate Drop" times
-- are Eastern and all equal 1:00 PM LOCAL at each venue; stored here as UTC.
-- (Summer DST offsets: PT=UTC-7, MT=UTC-6, CT=UTC-5, ET=UTC-4.)

UPDATE races r SET race_time = v.t
FROM (VALUES
  (1,  TIMESTAMPTZ '2026-05-30 20:00:00+00'),  -- Fox Raceway   1pm PT
  (2,  TIMESTAMPTZ '2026-06-06 20:00:00+00'),  -- Hangtown      1pm PT
  (3,  TIMESTAMPTZ '2026-06-13 19:00:00+00'),  -- Thunder Valley 1pm MT
  (4,  TIMESTAMPTZ '2026-06-20 17:00:00+00'),  -- High Point    1pm ET
  (5,  TIMESTAMPTZ '2026-07-04 17:00:00+00'),  -- RedBud        1pm ET
  (6,  TIMESTAMPTZ '2026-07-11 17:00:00+00'),  -- Southwick     1pm ET
  (7,  TIMESTAMPTZ '2026-07-18 18:00:00+00'),  -- Spring Creek  1pm CT
  (8,  TIMESTAMPTZ '2026-07-25 20:00:00+00'),  -- Washougal     1pm PT
  (9,  TIMESTAMPTZ '2026-08-15 17:00:00+00'),  -- Unadilla      1pm ET
  (10, TIMESTAMPTZ '2026-08-22 17:00:00+00'),  -- Budds Creek   1pm ET
  (11, TIMESTAMPTZ '2026-08-29 17:00:00+00')   -- Ironman       1pm ET
) AS v(round_number, t)
WHERE r.series = 'mx' AND r.round_number = v.round_number;

-- Round 2 official name (was seeded as "Prairie City National").
UPDATE races SET name = 'Hangtown Motocross Classic' WHERE series = 'mx' AND round_number = 2;
