# Session State — pick up here next time

**Last updated:** 2026-05-28

## Status: Ready to draft

All infrastructure for the MX 2026 season is in place. The league has been renewed. Draft can start any time before Round 1 (May 30, Fox Raceway).

## All migrations run ✅

| Migration | Status |
|---|---|
| `2026-05-04_unique_rider_per_league_roster.sql` | ✅ |
| `2026-05-04b_outdoor_motocross_schema.sql` | ✅ |
| `2026-05-21_league_groups.sql` | ✅ |
| `2026-05-22_mx_races.sql` | ✅ (11 MX rounds in races table) |
| `2026-05-22_mx_rider_series.sql` | ✅ (52 factory riders seeded) |
| `2026-05-28_league_archived.sql` | ✅ |
| `2026-05-28_mx_rider_additions.sql` | ✅ (16 more riders added, Jett Lawrence # fixed) |

## What was built this session

- **Auto-import cron adapted for MX** — Series-aware base URL (`results.promotocross.com` for MX), classifies "Moto 1"/"Moto 2" race types, emits correct bonus types (`moto1_winner_450`, `holeshot_moto1_450`, etc.), waits for overall before scoring.
- **Draft page fixed for MX** — `/api/riders?series=mx` returns only MX riders with correct `450MX`/`250MX` classes. Draft picks show correct class labels. Class filter dropdown is series-aware.
- **Lineup validation fixed for MX** — Reads class from `rider_series` for MX leagues instead of `riders` table (which has stale SX classes). Validates `450MX`/`250MX` counts against `lineup_450`/`lineup_250e`.
- **Free agents fixed for MX** — Only shows riders in the MX series pool. Season points scoped to MX races only.
- **Rider pool expanded** — 68 riders total (30×450MX, 38×250MX). Added 16 competitive non-factory riders from the Fox Raceway entry list. Jett Lawrence number corrected (#1 → #18).
- **Injuries reset** — All 68 MX riders are `status='active'` in `rider_series`.

## Immediate next steps (in order)

1. **Add more riders** — Many competitive riders from the full entry list still need to be added. Do this before drafting, ideally by checking entry list round-by-round as riders confirm. Focus on anyone who could realistically finish top 20-25.
2. **Draft** — Both members draft in the MX league before Round 1 (May 30, Fox Raceway). `draft_status='waiting'`, roster_size=22, 8×450MX + 8×250MX starters.
3. **Verify auto-import cron URL** — After Round 1 results post, check if `results.promotocross.com` is the correct base URL. If results don't auto-import, check the domain. May need a small URL fix.
4. **Injury cron for MX** — The existing injury cron (`/api/cron/injury-report`) is SX-specific (scrapes supercrosslive.com entry lists). It will do nothing useful for MX. MX injury status management is manual for now (set status via admin or wait for post-race cron to mark riders out).

## MX league (DB)

- League ID: 3
- `series`: 'mx'
- `draft_status`: 'waiting'
- `roster_size`: 22
- `lineup_450`: 8 (450MX starters per week)
- `lineup_250e`: 8 (250MX starters per week — column repurposed)
- `lineup_250w`: 0 (not used for MX)

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
| Auto-import cron (SX + MX) | `src/app/api/cron/auto-import/route.ts` |
| Draft API | `src/app/api/leagues/[id]/draft/route.ts` |
| Draft page | `src/app/leagues/[id]/draft/page.tsx` |
| Lineup validation | `src/app/api/leagues/[id]/lineup/route.ts` |
| Free agents | `src/app/api/leagues/[id]/free-agents/route.ts` |
| Riders endpoint | `src/app/api/riders/route.ts` |
| MX expansion plan | `docs/PLAN_OUTDOOR_MOTOCROSS.md` |
| Series helpers | `src/lib/series.ts` |
| Supabase project | `vprgvmtbxqunijwlnoui` |
