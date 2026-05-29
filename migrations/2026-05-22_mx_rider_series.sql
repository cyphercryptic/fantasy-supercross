-- 2026 Pro Motocross — Rider seeder
-- Source: promotocross.com/teams (2026 confirmed)
--
-- SAFE by design:
--   - Existing riders table rows are NEVER modified (SX data preserved)
--   - Only rider_series rows for series='mx' are inserted/updated
--   - Brand-new riders (not in SX DB) are inserted into riders table only
--
-- NOTE: matching is done by LOWER(name). If a rider's name is stored
-- differently in your DB (e.g. "R.J. Hampshire" vs "RJ Hampshire"), they
-- will get inserted as a new row. Check for duplicates after running:
--   SELECT name FROM riders GROUP BY name HAVING COUNT(*) > 1;

BEGIN;

CREATE TEMP TABLE mx_seed (
  name  TEXT,
  num   INTEGER,
  team  TEXT,
  class TEXT  -- '450MX' or '250MX'
);

INSERT INTO mx_seed (name, num, team, class) VALUES
  -- ── 450 MX ──────────────────────────────────────────────────────
  ('Benny Bloss',        54,  'Liqui Moly Beta Factory Racing',                  '450MX'),
  ('Mitchell Oldenburg', 52,  'Liqui Moly Beta Factory Racing',                  '450MX'),
  ('Justin Barcia',      51,  'Troy Lee Designs Red Bull Ducati Factory Racing',  '450MX'),
  ('Dylan Ferrandis',    14,  'Troy Lee Designs Red Bull Ducati Factory Racing',  '450MX'),
  ('Hunter Lawrence',    96,  'Honda HRC Progressive',                            '450MX'),
  ('Jett Lawrence',      1,   'Honda HRC Progressive',                            '450MX'),
  ('Christian Craig',    28,  'Quad Lock Honda Racing',                           '450MX'),
  ('Shane McElrath',     12,  'Quad Lock Honda Racing',                           '450MX'),
  ('Joey Savatgy',       17,  'Quad Lock Honda Racing',                           '450MX'),
  ('RJ Hampshire',       24,  'Rockstar Energy Husqvarna Factory Racing',         '450MX'),
  ('Malcolm Stewart',    27,  'Rockstar Energy Husqvarna Factory Racing',         '450MX'),
  ('Garrett Marchbanks', 36,  'Monster Energy Kawasaki',                          '450MX'),
  ('Chase Sexton',       4,   'Monster Energy Kawasaki',                          '450MX'),
  ('Aaron Plessinger',   7,   'Red Bull KTM Factory Racing',                      '450MX'),
  ('Jorge Prado',        26,  'Red Bull KTM Factory Racing',                      '450MX'),
  ('Eli Tomac',          3,   'Red Bull KTM Factory Racing',                      '450MX'),
  ('Ken Roczen',         94,  'Progressive Insurance Cycle Gear Suzuki',          '450MX'),
  ('Colt Nichols',       45,  'Twisted Tea Suzuki/Progressive Insurance',         '450MX'),
  ('Mikkel Haarup',      31,  'Triumph Factory Racing',                           '450MX'),
  ('Jordon Smith',       20,  'Triumph Factory Racing',                           '450MX'),
  ('Justin Cooper',      32,  'Monster Energy Yamaha Star Racing',                '450MX'),
  ('Haiden Deegan',      38,  'Monster Energy Yamaha Star Racing',                '450MX'),
  ('Cooper Webb',        2,   'Monster Energy Yamaha Star Racing',                '450MX'),
  ('Derek Drake',        98,  'Toyota Redlands BarX Yamaha',                      '450MX'),

  -- ── 250 MX ──────────────────────────────────────────────────────
  ('Chance Hymas',       29,  'Honda HRC Progressive',                            '250MX'),
  ('Jo Shimoda',         30,  'Honda HRC Progressive',                            '250MX'),
  ('Evan Ferry',         751, 'Phoenix Racing Honda',                             '250MX'),
  ('Cullin Park',        49,  'Phoenix Racing Honda',                             '250MX'),
  ('Gavin Towers',       73,  'Phoenix Racing Honda',                             '250MX'),
  ('Daxton Bennick',     58,  'Rockstar Energy Husqvarna Factory Racing',         '250MX'),
  ('Casey Cochran',      59,  'Rockstar Energy Husqvarna Factory Racing',         '250MX'),
  ('Ryder DiFrancesco',  34,  'Rockstar Energy Husqvarna Factory Racing',         '250MX'),
  ('Drew Adams',         35,  'Monster Energy Pro Circuit Kawasaki',              '250MX'),
  ('Seth Hammaker',      10,  'Monster Energy Pro Circuit Kawasaki',              '250MX'),
  ('Levi Kitchen',       47,  'Monster Energy Pro Circuit Kawasaki',              '250MX'),
  ('Cameron McAdoo',     142, 'Monster Energy Pro Circuit Kawasaki',              '250MX'),
  ('Julien Beaumer',     13,  'Red Bull KTM Factory Racing',                      '250MX'),
  ('Austin Forkner',     33,  'Triumph Factory Racing',                           '250MX'),
  ('Gage Linville',      74,  'Triumph Factory Racing',                           '250MX'),
  ('Jalek Swoll',        56,  'Triumph Factory Racing',                           '250MX'),
  ('Max Anstie',         61,  'Monster Energy Yamaha Star Racing',                '250MX'),
  ('Pierce Brown',       163, 'Monster Energy Yamaha Star Racing',                '250MX'),
  ('Cole Davies',        37,  'Monster Energy Yamaha Star Racing',                '250MX'),
  ('Michael Mosiman',    23,  'Monster Energy Yamaha Star Racing',                '250MX'),
  ('Nate Thrasher',      25,  'Monster Energy Yamaha Star Racing',                '250MX'),
  ('Coty Schock',        22,  'ClubMX Yamaha',                                    '250MX'),
  ('Maximus Vohland',    19,  'ClubMX Yamaha',                                    '250MX'),
  ('Hunter Yoder',       60,  'ClubMX Yamaha',                                    '250MX'),
  ('Parker Ross',        40,  'Toyota Redlands BarX Yamaha',                      '250MX'),
  ('Dilan Schwartz',     42,  'Toyota Redlands BarX Yamaha',                      '250MX'),
  ('Leo Tucker',         154, 'Toyota Redlands BarX Yamaha',                      '250MX'),
  ('Lux Turner',         43,  'Toyota Redlands BarX Yamaha',                      '250MX');

-- Step 1: Insert brand-new riders (not already in the DB) into riders table
-- Existing riders are untouched.
INSERT INTO riders (name, number, team, class, status)
SELECT s.name, s.num, s.team,
       CASE WHEN s.class = '450MX' THEN '450' ELSE '250' END,
       'active'
FROM mx_seed s
WHERE NOT EXISTS (
  SELECT 1 FROM riders r WHERE LOWER(r.name) = LOWER(s.name)
);

-- Step 2: Upsert rider_series for 'mx' — updates if row exists, inserts if not
INSERT INTO rider_series (rider_id, series, class, number, team, status)
SELECT r.id, 'mx', s.class, s.num, s.team, 'active'
FROM mx_seed s
JOIN riders r ON LOWER(r.name) = LOWER(s.name)
ON CONFLICT (rider_id, series) DO UPDATE SET
  class  = EXCLUDED.class,
  number = EXCLUDED.number,
  team   = EXCLUDED.team,
  status = EXCLUDED.status;

DROP TABLE mx_seed;

-- Quick check — run this after to verify counts:
-- SELECT class, COUNT(*) FROM rider_series WHERE series = 'mx' GROUP BY class;
-- SELECT name FROM riders GROUP BY name HAVING COUNT(*) > 1;

COMMIT;
