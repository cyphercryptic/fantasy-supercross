-- Add Carson Wood ahead of Round 4, flagged by the "Unmatched Riders" webhook
-- after Round 3, Thunder Valley National (Jun 13 2026). Carson Wood made his
-- 250 pro debut for Star Yamaha at Thunder Valley (motos 27-10) and scored 3 pts
-- (P10, moto 2) that didn't count because he wasn't in the database:
--   Carson Wood  #226 — 250MX  (Monster Energy Yamaha Star Racing)
--
-- #226 is from the Racer X Star Yamaha 2026 250SMX roster table; the importer
-- matches by NAME only (case-insensitive), so the next import will link him
-- regardless — the number/team are cosmetic (UI plate + Yamaha-blue TeamLogo).
--
-- Idempotent: skips the rider/series row if already present (matched
-- case-insensitively). team carries the "Yamaha" keyword so TeamLogo renders blue,
-- and matches the exact string used by the other Star Yamaha riders.

BEGIN;

-- Resync the SERIAL sequences to max(id) FIRST. The Coenen brothers were inserted
-- with explicit ids (245/246, 392/393), which left these sequences pointing at an
-- already-used id — so a default-id INSERT below would 23505 on nextval (id=245).
-- Resyncing up front makes nextval return max+1.
SELECT setval(pg_get_serial_sequence('riders', 'id'),
              (SELECT MAX(id) FROM riders));
SELECT setval(pg_get_serial_sequence('rider_series', 'id'),
              (SELECT MAX(id) FROM rider_series));

WITH new_riders(name, number, team, base_class, mx_class) AS (VALUES
  ('Carson Wood', 226, 'Monster Energy Yamaha Star Racing', '250', '250MX')
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
-- (keeps the Admin add-rider endpoint, POST /api/riders, safe on its next insert).
SELECT setval(pg_get_serial_sequence('riders', 'id'),
              (SELECT MAX(id) FROM riders));
SELECT setval(pg_get_serial_sequence('rider_series', 'id'),
              (SELECT MAX(id) FROM rider_series));

COMMIT;
