# Session State — pick up here next time

**Last updated:** 2026-05-28

## Status: Ready to draft

All infrastructure for the MX 2026 season is in place. The next human action is to use the Renew Season button.

## All migrations run ✅

| Migration | Status |
|---|---|
| `2026-05-04_unique_rider_per_league_roster.sql` | ✅ |
| `2026-05-04b_outdoor_motocross_schema.sql` | ✅ |
| `2026-05-21_league_groups.sql` | ✅ |
| `2026-05-22_mx_races.sql` | ✅ (11 MX rounds in races table) |
| `2026-05-22_mx_rider_series.sql` | ✅ (52 riders: 24×450MX, 28×250MX) |
| `2026-05-28_league_archived.sql` | ✅ |

## What was built this session

- **League franchise history** — `league_groups` table links seasons together. Franchise history page at `/groups/[id]` shows all past/current seasons as cards with Season Recap links.
- **Renew Season flow** — Commissioner scrolls to bottom of league dashboard → "Renew Season" → picks series + lineup slots → archives SX league, clones it as MX league with same members, links both to franchise. No re-inviting needed.
- **MX race schedule** — 11 rounds seeded (May 30 – Aug 29, 2026). Source: promotocross.com/schedule.
- **MX rider seed** — 52 factory/semi-factory riders in `rider_series` with `series='mx'`. Source: promotocross.com/teams (2026 confirmed). Numbers and teams differ significantly from SX season.
- **Races API series filter** — `GET /api/races?series=mx` now works. League dashboard fetches races filtered by `league.series` so correct "Next Race" shows.
- **Leagues list** — archived leagues hidden from My Leagues.

## Immediate next steps (in order)

1. **Renew the SX league → MX** — Go to Bar 9 Fantasy league dashboard, scroll to bottom, click "Renew Season", pick Outdoor Motocross (MX), set lineup slots (suggest: 3×450MX, 2×250MX), confirm. This creates the MX league and archives SX.
2. **Draft** — Both members draft in the new MX league before Round 1 (May 30, Fox Raceway).
3. **Adapt auto-import cron for MX** — MX result format is different from SX: 2 motos per class + combined overall. The cron at `src/app/api/cron/auto-import/route.ts` needs to handle MX bonus types (`holeshot_moto1_450`, `moto1_winner_450`, etc.) and the promotocross.com result URLs.

## MX schedule (confirmed 2026)

| Round | Name | Date | Location |
|---|---|---|---|
| 1 | Fox Raceway National | May 30 | Pala, CA |
| 2 | Prairie City National | Jun 6 | Rancho Cordova, CA |
| 3 | Thunder Valley National | Jun 13 | Lakewood, CO |
| 4 | High Point National | Jun 20 | Mt. Morris, PA |
| 5 | RedBud National | Jul 4 | Buchanan, MI |
| 6 | Southwick National | Jul 11 | Southwick, MA |
| 7 | Spring Creek National | Jul 18 | Millville, MN |
| 8 | Washougal National | Jul 25 | Washougal, WA |
| 9 | Unadilla National | Aug 15 | New Berlin, NY |
| 10 | Budds Creek National | Aug 22 | Mechanicsville, MD |
| 11 | Ironman National | Aug 29 | Crawfordsville, IN |

## Key files

| Topic | File |
|---|---|
| MX expansion plan | `docs/PLAN_OUTDOOR_MOTOCROSS.md` |
| Franchise history page | `src/app/groups/[id]/page.tsx` |
| Franchise API | `src/app/api/groups/route.ts` |
| Renew season endpoint | `src/app/api/leagues/[id]/renew/route.ts` |
| Auto-import cron | `src/app/api/cron/auto-import/route.ts` |
| Series helpers | `src/lib/series.ts` |
| Supabase project | `vprgvmtbxqunijwlnoui` |
