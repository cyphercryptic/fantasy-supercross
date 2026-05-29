-- 2026 Pro Motocross — Race schedule only
-- Source: promotocross.com/schedule (confirmed 2026)
-- 11 rounds, May 30 – Aug 29

INSERT INTO races (name, round_number, date, location, status, series) VALUES
  ('Fox Raceway National',      1,  '2026-05-30', 'Pala, CA',             'upcoming', 'mx'),
  ('Prairie City National',     2,  '2026-06-06', 'Rancho Cordova, CA',   'upcoming', 'mx'),
  ('Thunder Valley National',   3,  '2026-06-13', 'Lakewood, CO',         'upcoming', 'mx'),
  ('High Point National',       4,  '2026-06-20', 'Mt. Morris, PA',       'upcoming', 'mx'),
  ('RedBud National',           5,  '2026-07-04', 'Buchanan, MI',         'upcoming', 'mx'),
  ('Southwick National',        6,  '2026-07-11', 'Southwick, MA',        'upcoming', 'mx'),
  ('Spring Creek National',     7,  '2026-07-18', 'Millville, MN',        'upcoming', 'mx'),
  ('Washougal National',        8,  '2026-07-25', 'Washougal, WA',        'upcoming', 'mx'),
  ('Unadilla National',         9,  '2026-08-15', 'New Berlin, NY',       'upcoming', 'mx'),
  ('Budds Creek National',      10, '2026-08-22', 'Mechanicsville, MD',   'upcoming', 'mx'),
  ('Ironman National',          11, '2026-08-29', 'Crawfordsville, IN',   'upcoming', 'mx')
ON CONFLICT DO NOTHING;
