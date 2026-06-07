-- Normalize privateer rider "teams" to "Privateer <Brand>".
-- Many MX riders had no real team — their rider_series.team held only a bike
-- model (e.g. "Yamaha YZ450F") from the 2026-05-29c bike backfill, and their
-- base riders.team was NULL. The bike model carried the brand (so colours
-- rendered) but read poorly. This relabels those bare bike-model entries to
-- "Privateer <Brand>" in both tables and fills the null base rows, so every
-- rider has a number and a manufacturer attached.
--
-- Already applied to prod via the service-role script on 2026-06-07; this is the
-- idempotent record (re-running matches nothing once values are normalized).

BEGIN;

WITH model_brand(model, brand) AS (VALUES
  ('Yamaha YZ450F','Yamaha'), ('Yamaha YZ250F','Yamaha'),
  ('Honda CRF450R','Honda'), ('Honda CRF250R','Honda'), ('Honda CRF450R Works Edition','Honda'),
  ('KTM 250 SX-F','KTM'), ('KTM 450 SX-F','KTM'), ('KTM 450 SX-F Factory Edition','KTM'), ('KTM 250 SX-F Factory Edition','KTM'),
  ('Kawasaki KX450','Kawasaki'), ('Kawasaki KX250','Kawasaki'),
  ('GasGas MC 450F Factory Edition','GasGas'), ('GasGas MC 125','GasGas'),
  ('Husqvarna FC 250','Husqvarna'), ('Husqvarna FC 450 Rockstar Edition','Husqvarna'), ('Husqvarna FC 250 Rockstar Edition','Husqvarna'),
  ('Triumph TF 250-X','Triumph'), ('Triumph TF 450-X','Triumph'),
  ('Beta 450 RX','Beta')
)
UPDATE rider_series rs
SET team = 'Privateer ' || mb.brand
FROM model_brand mb
WHERE rs.series = 'mx' AND rs.team = mb.model;

-- Mirror the privateer label into the base riders row (and fill any null base team).
UPDATE riders r
SET team = rs.team
FROM rider_series rs
WHERE rs.rider_id = r.id AND rs.series = 'mx'
  AND rs.team LIKE 'Privateer %'
  AND (r.team IS NULL OR r.team <> rs.team);

COMMIT;
