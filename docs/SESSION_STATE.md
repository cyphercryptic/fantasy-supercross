# Session State — pick up here next time

**Last updated:** 2026-05-22

## Where we left off

All three pending migrations have been run successfully in Supabase:
- `2026-05-04_unique_rider_per_league_roster.sql` ✅
- `2026-05-04b_outdoor_motocross_schema.sql` ✅ (MX schema — adds `series` to races/leagues, creates `rider_series`)
- `2026-05-21_league_groups.sql` ✅ (franchise history — adds `league_groups` table, `group_id` + `season_year` to leagues)

SX 2026 season is complete (Salt Lake City, round 17, May 9). Season Recap page is live.

MX Round 1 (Fox Raceway, Pala CA) is **next weekend** (~May 30). Plenty of time.

## Next priorities (in order)

1. ~~**Insert the MX race schedule**~~ ✅ Done 2026-05-22 (11 rounds in `races` table with `series='mx'`)
2. **Seed MX riders** — entry list not published yet (stale 2025 data found online). Check promotocross.com mid-week. Once live, run the rider seeder SQL (template in `migrations/2026-05-22_mx_races.sql` — riders portion still needs to be written against the real list).
3. **Create the MX league** in the app (commissioner creates league with `series='mx'`, links it to franchise "Bar 9 Fantasy", season year 2026).
4. **Draft.**
5. **Adapt the auto-import cron** for MX result format (2 motos per class + combined overall).

## League franchise history (just built)

New feature: `league_groups` table links multiple season-leagues under one franchise.

- New page: `/groups/[id]` — shows all seasons in a franchise
- Create league form now has Season Year + Franchise dropdown
- League dashboard shows franchise breadcrumb if linked
- When creating the MX league, link it to the same franchise as the SX league (create "Bar 9 Fantasy" franchise from the create form)

## Key files & references

| Topic | File |
|---|---|
| Outdoor MX plan | `docs/PLAN_OUTDOOR_MOTOCROSS.md` |
| Series helpers | `src/lib/series.ts` |
| Race region helpers | `src/lib/race-region.ts` |
| Auto-import cron | `src/app/api/cron/auto-import/route.ts` |
| Franchise API | `src/app/api/groups/route.ts` |
| Franchise history page | `src/app/groups/[id]/page.tsx` |
| Season recap page | `src/app/leagues/[id]/season-recap/page.tsx` |
| Supabase project | `vprgvmtbxqunijwlnoui` |

## MX schedule (confirm exact dates vs AMA)

| Round | Name | Date | Track |
|---|---|---|---|
| 1 | Fox Raceway | ~May 30 | Pala, CA |
| 2 | Thunder Valley | May 30 | Lakewood, CO |
| 3 | High Point | Jun 6 | Mt Morris, PA |
| 4 | RedBud | Jul 4 | Buchanan, MI |
| 5 | Southwick | Jul 11 | Southwick, MA |
| 6 | Spring Creek | Jul 18 | Millville, MN |
| 7 | Washougal | Jul 25 | Washougal, WA |
| 8 | Unadilla | Aug 8 | New Berlin, NY |
| 9 | Budds Creek | Aug 15 | Mechanicsville, MD |
| 10 | Ironman | Aug 22 | Crawfordsville, IN |
| 11 | Glen Helen | Aug 29 | San Bernardino, CA |
