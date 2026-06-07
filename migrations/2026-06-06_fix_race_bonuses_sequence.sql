-- Fix race_bonuses id sequence drift.
-- Root cause: the race_bonuses id sequence had fallen behind max(id) (same class
-- of bug as the races table in 2026-05-30_fix_mx_races.sql — rows imported with
-- explicit ids without advancing the sequence). Every auto-import bonus insert
-- then hit a duplicate-key (23505) on race_bonuses_pkey and silently failed,
-- because the importer did not check the insert error. Net effect: Hangtown
-- (race 21) finished "completed" with 0 bonuses — all 4 holeshots missing —
-- even though the holeshots were detected correctly.
--
-- The data was repaired at runtime (the 4 Hangtown holeshots were re-inserted,
-- which also advanced the sequence past max(id)). This migration makes the
-- resync explicit/idempotent for the record and as belt-and-suspenders.
--
-- The importer (src/app/api/cron/auto-import/route.ts) now also surfaces any
-- bonus-insert error in its response/logs instead of failing silently.

BEGIN;

SELECT setval(
  pg_get_serial_sequence('race_bonuses', 'id'),
  GREATEST((SELECT MAX(id) FROM race_bonuses), 1)
);

COMMIT;
