-- Add three 250MX riders ahead of Round 4, High Point National (Jun 20 2026),
-- per Racer X (2026-06-17):
--   Vincent Wey   #270 — 250MX  (Monster Energy Kawasaki Team Green) — USA pro debut
--   Kade Johnson  #801 — 250MX  (Monster Energy Kawasaki Team Green) — 2nd PM start
--   Luke Fauser   #462 — 250MX  (KTM-backed local privateer)         — pro debut
--
-- The importer matches by NAME only (case-insensitive), so the next results import
-- links them regardless; number/team are cosmetic (UI plate + TeamLogo color).
-- team strings carry the "Kawasaki"/"KTM" keyword so TeamLogo renders green/orange.
-- Fauser is KTM-backed (not factory), so he follows the "Privateer <Brand>"
-- convention (commit 2114221) — still renders KTM orange.
--
-- Idempotent: skips any rider/series row already present (matched case-insensitively).

BEGIN;

-- Resync the SERIAL sequences to max(id) FIRST. Prior explicit-id inserts (Coenen
-- brothers) left these sequences behind max(id), so a default-id INSERT below would
-- 23505 on nextval. Resyncing up front makes nextval return max+1. See
-- migrations/2026-06-14_mx_carson_wood.sql for the same guard.
SELECT setval(pg_get_serial_sequence('riders', 'id'),
              (SELECT MAX(id) FROM riders));
SELECT setval(pg_get_serial_sequence('rider_series', 'id'),
              (SELECT MAX(id) FROM rider_series));

WITH new_riders(name, number, team, base_class, mx_class) AS (VALUES
  ('Vincent Wey',  270, 'Monster Energy Kawasaki Team Green', '250', '250MX'),
  ('Kade Johnson', 801, 'Monster Energy Kawasaki Team Green', '250', '250MX'),
  ('Luke Fauser',  462, 'Privateer KTM',                      '250', '250MX')
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

-- Resync again AFTER the insert so the sequences point past the rows we just added
-- (keeps POST /api/riders safe on its next insert).
SELECT setval(pg_get_serial_sequence('riders', 'id'),
              (SELECT MAX(id) FROM riders));
SELECT setval(pg_get_serial_sequence('rider_series', 'id'),
              (SELECT MAX(id) FROM rider_series));

COMMIT;
