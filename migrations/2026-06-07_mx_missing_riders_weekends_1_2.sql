-- Add MX riders that appeared in results across the first two 2026 Pro Motocross
-- weekends (Fox Raceway #506003 + Hangtown #507221) but were not yet in the DB.
-- Source: every 250/450 session (qualifying groups, LCQ, motos) on
-- results.promotocross.com — name, bike number, manufacturer/team. WMX excluded.
--
-- 20 riders. Already applied to prod via the service-role script on 2026-06-07;
-- this file is the record and is idempotent (skips any rider/series row already
-- present, matched case-insensitively). team includes the manufacturer keyword so
-- the TeamLogo brand colour renders even for privateer team names.

BEGIN;

WITH new_riders(name, number, team, base_class, mx_class) AS (VALUES
  ('Alvin Hillan',     301, 'SLR Honda',                                                      '250', '250MX'),
  ('Carson Burns',     907, 'Burns Racing KTM',                                               '250', '250MX'),
  ('Chase Forsberg',   779, 'Forsberg Racing Triumph',                                        '250', '250MX'),
  ('Enzo Temmerman',    92, 'Monster Energy Kawasaki Team Green',                             '250', '250MX'),
  ('Logan Edwards',    612, 'Western Ag Yamaha',                                              '250', '250MX'),
  ('Nate Freehill',    416, 'Roseville Motorsports Racing Kawasaki',                          '250', '250MX'),
  ('Austin Black',     377, 'Austin Black Racing Yamaha',                                     '450', '450MX'),
  ('Derik Denzin',     194, 'Grateful Ones MC/Roseville Motorsports / Denzin Racing Yamaha',  '450', '450MX'),
  ('Eric Rivera',      766, 'Revenant Honda',                                                 '450', '450MX'),
  ('Italo Vaccaro',    868, 'Vaccaro Racing KTM',                                             '450', '450MX'),
  ('Jeffrey Gorman',   821, 'Factory Moto Kids Honda',                                        '450', '450MX'),
  ('Jimmy Hazel',      517, 'Clastic Designs Kawasaki',                                       '450', '450MX'),
  ('Jonah Schmidt',    481, 'Jonah Schmidt Racing Yamaha',                                    '450', '450MX'),
  ('Jordan Isola',     571, 'Jordan Isola Racing Honda',                                      '450', '450MX'),
  ('Kaiser Strode',    714, 'Strode Racing Honda',                                            '450', '450MX'),
  ('Reece Hamalainen', 855, 'Hamalainen Racing KTM',                                          '450', '450MX'),
  ('Shane Heywood',    626, 'Thompsons Family of Dealerships Yamaha',                          '450', '450MX'),
  ('Talon Gorman',     618, 'Factory Moto Kids Honda',                                        '450', '450MX'),
  ('Tyler Ducray',     671, 'AwakenCo KTM',                                                   '450', '450MX'),
  ('Wyatt Fields',     212, '2 Roosters Racing Yamaha',                                       '450', '450MX')
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

COMMIT;
