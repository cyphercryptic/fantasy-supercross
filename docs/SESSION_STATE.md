# Session State — pick up here next time

**Last updated:** 2026-05-29

## Status: Ready to draft (full rider pool loaded)

All infrastructure for the MX 2026 season is in place. The league has been renewed. Draft can start any time before Round 1 (May 30, Fox Raceway).

**2026-05-29:** Rider pool expanded to the **complete Fox Raceway Round 1 entry list** — 146 riders total (71×450MX, 75×250MX), all `active`. Added 78 riders (41×450MX, 37×250MX) from the official racerxonline.com 450/250 entry lists. All existing SX-era riders kept; marquee names not on the Round 1 entry list (Tomac, Roczen, Prado, Plessinger, Hampshire, M.Stewart, Savatgy, McElrath; Beaumer, Swoll, Bennick, Adams) left `active` by decision — they may race later rounds. Applied via service-role script; recorded in `migrations/2026-05-29_mx_full_entry_list.sql`.

**2026-05-29 (mock-draft test + bug fixes):** Ran a full 44-pick mock draft through the real API and fixed several issues found:
- **`league_rosters` never populated** — the draft upsert used `ON CONFLICT (league_id,user_id,rider_id)` but no matching unique constraint existed, so every upsert silently failed → empty rosters after a draft. Added the constraint (`migrations/2026-05-29b_league_rosters_unique.sql`). **Connor ran this in the Supabase SQL editor.**
- **Auto-pick pool leak** — the timeout auto-pick (`draft/route.ts` PATCH) picked the lowest global rider id with no series filter; for MX it could assign an SX-only rider with no MX class. Now picks from the `rider_series` pool for the league's series. *(code change, uncommitted)*
- **Draft timer dead** — timer parsing did `pickStartedAt + "Z"` but Supabase returns `+00:00` offsets → `Invalid Date` → NaN. Now detects existing tz info. *(code change)*
- **Draft page crash/hang resilience** — `loadDraft` now ignores non-200 responses (kept crashing render on transient error bodies lacking `members`); 401 shows a "Please log in" screen; polls while `draft` is null so it self-recovers. *(code change)*
- **Recent Picks + Coming Up ticker** now highlighted in each team's assigned color (`BIKE_BRANDS[brand].color` from `team_logo`). *(code change)*
- **Rider bikes backfilled** — 93 MX riders had null `team` (no bike icon on the draft board); filled from entry-list bikes (`migrations/2026-05-29c_mx_rider_bikes.sql`, applied via script).
- Same `+ "Z"` timestamp bug still latent (display-only) in `team/page.tsx:1096` and `free-agents/page.tsx:459` — NOT yet fixed.
- Code changes are live in the running dev server but **uncommitted** as of handoff.

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
| `2026-05-29_mx_full_entry_list.sql` | ✅ (78 riders added → 146 total, full Round 1 entry list) |
| `2026-05-29b_league_rosters_unique.sql` | ✅ (unique constraint so draft populates rosters) |
| `2026-05-29c_mx_rider_bikes.sql` | ✅ (backfilled bikes for 93 null-team MX riders, applied via script) |

## What was built this session

- **Auto-import cron adapted for MX** — Series-aware base URL (`results.promotocross.com` for MX), classifies "Moto 1"/"Moto 2" race types, emits correct bonus types (`moto1_winner_450`, `holeshot_moto1_450`, etc.), waits for overall before scoring.
- **Draft page fixed for MX** — `/api/riders?series=mx` returns only MX riders with correct `450MX`/`250MX` classes. Draft picks show correct class labels. Class filter dropdown is series-aware.
- **Lineup validation fixed for MX** — Reads class from `rider_series` for MX leagues instead of `riders` table (which has stale SX classes). Validates `450MX`/`250MX` counts against `lineup_450`/`lineup_250e`.
- **Free agents fixed for MX** — Only shows riders in the MX series pool. Season points scoped to MX races only.
- **Rider pool expanded** — 68 riders total (30×450MX, 38×250MX). Added 16 competitive non-factory riders from the Fox Raceway entry list. Jett Lawrence number corrected (#1 → #18).
- **Injuries reset** — All 68 MX riders are `status='active'` in `rider_series`.

## Immediate next steps (in order)

1. ✅ **Rider pool complete** — Full Round 1 entry list loaded (146 riders). For later rounds, re-check entry lists as the series moves venues and add any new confirmed entries.
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
