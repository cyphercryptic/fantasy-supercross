-- Add the Coenen brothers (Red Bull KTM Factory Racing) ahead of Round 3,
-- Thunder Valley National (Jun 13 2026). Both are new to the 2026 Pro Motocross
-- entry list:
--   Lucas Coenen  #104 — 450MX  (number is a nod to fellow Belgian Roger De Coster)
--   Sacha Coenen  #109 — 250MX
--
-- Already applied to prod via the service-role script on 2026-06-10; this file is
-- the record and is idempotent (skips any rider/series row already present, matched
-- case-insensitively). team carries the "KTM" keyword so TeamLogo renders orange.

BEGIN;

WITH new_riders(name, number, team, base_class, mx_class) AS (VALUES
  ('Lucas Coenen', 104, 'Red Bull KTM Factory Racing', '450', '450MX'),
  ('Sacha Coenen', 109, 'Red Bull KTM Factory Racing', '250', '250MX')
),
ins AS (
  INSERT INTO riders (name, number, team, class, status)
  SELECT nr.name, nr.number, nr.team, nr.base_class, 'active'
  FROM new_riders nr
  WHERE NOT EXISTS (SELECT 1 FROM riders r WHERE lower(r.name) = lower(nr.name))
  RETURNING id, name
)
INSERT INTO rider_series (rider_id, series, class, number, team, status)
SELECT COALESCE(i.id, r.id), 'mx', nr.mx_class, nr.number, nr.team, 'active'
FROM new_riders nr
LEFT JOIN ins i ON lower(i.name) = lower(nr.name)
LEFT JOIN riders r ON lower(r.name) = lower(nr.name)
WHERE NOT EXISTS (
  SELECT 1 FROM rider_series rs
  JOIN riders rr ON rr.id = rs.rider_id
  WHERE rs.series = 'mx' AND lower(rr.name) = lower(nr.name)
);

-- The prod inserts used explicit ids (245/246, 392/393) to sidestep drift, which
-- leaves the SERIAL sequences behind max(id). The Admin add-rider endpoint
-- (POST /api/riders) inserts without an id, so resync or the next add 23505s.
SELECT setval(pg_get_serial_sequence('riders', 'id'),
              (SELECT MAX(id) FROM riders));
SELECT setval(pg_get_serial_sequence('rider_series', 'id'),
              (SELECT MAX(id) FROM rider_series));

COMMIT;
