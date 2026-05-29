-- MX rider additions based on Fox Raceway Round 1 entry list (2026-05-30)
-- 1. Fix Jett Lawrence MX number (#1 → #18, he's using his regular number not the championship #1)
-- 2. Add rider_series rows for competitive non-factory riders already in the riders table
-- 3. Insert brand-new riders (Fredrik Noren, Lorenzo Locurcio, Tre Fierro III, Brock Bennett)

BEGIN;

-- Fix Jett Lawrence MX number
UPDATE rider_series SET number = 18
WHERE series = 'mx' AND rider_id = (SELECT id FROM riders WHERE name = 'Jett Lawrence' LIMIT 1);

-- Add MX series rows for riders already in DB (from SX)
-- rider_id values confirmed by querying riders table 2026-05-28
INSERT INTO rider_series (rider_id, series, class, number, team, status) VALUES
  -- 450MX additions
  (57,  'mx', '450MX', 39,  null, 'active'),  -- Valentin Guillod
  (12,  'mx', '450MX', 41,  null, 'active'),  -- Mitchell Harrison
  (15,  'mx', '450MX', 62,  null, 'active'),  -- Grant Harlan
  (105, 'mx', '450MX', 83,  null, 'active'),  -- Justin Rodbell
  -- 250MX additions
  (103, 'mx', '250MX', 57,  null, 'active'),  -- Avery Long
  (74,  'mx', '250MX', 65,  null, 'active'),  -- Marshal Weltin
  (96,  'mx', '250MX', 71,  null, 'active'),  -- Carson Mumford
  (48,  'mx', '250MX', 77,  null, 'active'),  -- Derek Kelley
  (43,  'mx', '250MX', 82,  null, 'active'),  -- Caden Dudney
  (147, 'mx', '250MX', 99,  null, 'active'),  -- Kayden Minear
  (110, 'mx', '250MX', 155, null, 'active'),  -- Dylan Cunha
  (145, 'mx', '250MX', 180, null, 'active')   -- Landen Gordon
ON CONFLICT (rider_id, series) DO NOTHING;

-- Insert brand-new riders and their MX series rows
INSERT INTO riders (name, number, team, class) VALUES
  ('Fredrik Noren',     63,  'HEP Motorsports Suzuki', '450'),
  ('Lorenzo Locurcio',  50,  null,                      '450'),
  ('Tre Fierro III',    158, null,                      '250'),
  ('Brock Bennett',     159, null,                      '250');

INSERT INTO rider_series (rider_id, series, class, number, team, status)
SELECT r.id, 'mx', m.class, m.number, m.team, 'active'
FROM (VALUES
  ('Fredrik Noren',    '450MX', 63,  'HEP Motorsports Suzuki'),
  ('Lorenzo Locurcio', '450MX', 50,  null),
  ('Tre Fierro III',   '250MX', 158, null),
  ('Brock Bennett',    '250MX', 159, null)
) AS m(name, class, number, team)
JOIN riders r ON r.name = m.name
ON CONFLICT (rider_id, series) DO NOTHING;

COMMIT;
