-- Fix MX schedule: only R4 (High Point) survived the original seed.
-- Root cause: the races id sequence was behind max(id) (SX races were imported
-- with explicit ids without advancing the sequence), so every generated id in
-- the MX seed collided with an existing row and ON CONFLICT DO NOTHING skipped
-- it — R4 just happened to land on a free id.
--
-- 1. Resync the sequence so new inserts get safe ids.
-- 2. Re-insert any missing MX rounds (idempotent: skips rounds already present).

BEGIN;

SELECT setval('races_id_seq', (SELECT MAX(id) FROM races));

INSERT INTO races (name, round_number, date, location, status, series)
SELECT v.name, v.round_number, v.date, v.location, 'upcoming', 'mx'
FROM (VALUES
  ('Fox Raceway National',      1,  DATE '2026-05-30', 'Pala, CA'),
  ('Prairie City National',     2,  DATE '2026-06-06', 'Rancho Cordova, CA'),
  ('Thunder Valley National',   3,  DATE '2026-06-13', 'Lakewood, CO'),
  ('High Point National',       4,  DATE '2026-06-20', 'Mt. Morris, PA'),
  ('RedBud National',           5,  DATE '2026-07-04', 'Buchanan, MI'),
  ('Southwick National',        6,  DATE '2026-07-11', 'Southwick, MA'),
  ('Spring Creek National',     7,  DATE '2026-07-18', 'Millville, MN'),
  ('Washougal National',        8,  DATE '2026-07-25', 'Washougal, WA'),
  ('Unadilla National',         9,  DATE '2026-08-15', 'New Berlin, NY'),
  ('Budds Creek National',      10, DATE '2026-08-22', 'Mechanicsville, MD'),
  ('Ironman National',          11, DATE '2026-08-29', 'Crawfordsville, IN')
) AS v(name, round_number, date, location)
WHERE NOT EXISTS (
  SELECT 1 FROM races r WHERE r.series = 'mx' AND r.round_number = v.round_number
);

COMMIT;
