-- Add Tony Cairoli ahead of Round 5, RedBud National (Jul 4 2026).
--   Tony Cairoli  #222 — 450MX  (Troy Lee Designs/Red Bull Ducati)
--
-- 9-time MXGP world champ joining the 450 class mid-season. Confirmed a genuinely
-- new rider: no existing "Cairoli"/"Tony <x>" row and #222 is unused (the only
-- "Tony" in the pool is Tony Usko #689, a 250 privateer — unrelated).
--
-- The importer matches by NAME only (case-insensitive), so the next results import
-- links him regardless; number/team are cosmetic (UI plate + TeamLogo color).
-- team string carries the "Ducati" keyword so TeamLogo renders the white/red "D".
--
-- Idempotent: skips the rider/series row if already present (matched case-insensitively).

BEGIN;

-- Resync the SERIAL sequences to max(id) FIRST so a default-id INSERT below returns
-- max+1 rather than 23505-ing on nextval. See 2026-06-17_mx_high_point_debuts.sql.
SELECT setval(pg_get_serial_sequence('riders', 'id'),
              (SELECT MAX(id) FROM riders));
SELECT setval(pg_get_serial_sequence('rider_series', 'id'),
              (SELECT MAX(id) FROM rider_series));

WITH new_riders(name, number, team, base_class, mx_class) AS (VALUES
  ('Tony Cairoli', 222, 'Troy Lee Designs/Red Bull Ducati', '450', '450MX')
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

-- Resync again AFTER the insert so the sequences point past the new row
-- (keeps POST /api/riders safe on its next insert).
SELECT setval(pg_get_serial_sequence('riders', 'id'),
              (SELECT MAX(id) FROM riders));
SELECT setval(pg_get_serial_sequence('rider_series', 'id'),
              (SELECT MAX(id) FROM rider_series));

COMMIT;
