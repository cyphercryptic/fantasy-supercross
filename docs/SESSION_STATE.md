# Session State — pick up here next time

**Last updated:** 2026-05-30

## Status: MX 2026 season underway — Round 1 (Fox Raceway) is TODAY

Draft is complete, rosters saved, lineups locking at gate drop. The app is fully MX-aware end to end (draft, lineup, schedule, settings, stats, status). Everything below is live in production (`fantasy-supercross.vercel.app`, auto-deploys from `main`).

## MX scoring model (changed 2026-05-30)

- **Each moto scored individually and summed per rider** (not the combined overall). A 1-1 = 20 pts/class. Points table (per moto): `1→10, 2→8, 3→7, 4→6, 5→5, 6-7→4, 8-10→3, 11-14→2, 15-20→1, 21+→0` (`getMxMotoPoints`). **SX is unchanged** (`getPointsForPosition`, pays 21-22 = 1).
- **No moto-winner bonus.** **Holeshot = +1 per moto** (so up to 2/class/event).
- Stored `race_results.position` = rider's running **average finish** across their motos (drives the avg-finish stat).
- **Incremental import:** the cron scores whatever motos are posted and recomputes each run (idempotent). MX races stay `status='upcoming'` (so scoring keeps refreshing) until the **overall** posts, then flip to `completed`.
- **Live refresh:** `POST /api/cron/auto-import` (session-authed, delegates to the nightly GET) + a **"Refresh results"** button on the league Standings card — pull results live as motos finish. Note the nightly cron only runs once at 06:00 UTC, so use the button (or a future frequent cron) to watch live. Import only acts once `race_time` (gate drop) has passed.
- **Import verified live (Round 1, 2026-05-30):** 250 Moto 1 scored correctly. Two bugs fixed along the way: event-id city matching (exact substrings → shared-word `cityMatchesRace`, fixes verify + auto-discover) and moto parsing (`classifyRace` now allows "Moto **#**1"). Fox Raceway `event_id=506003` set. Promotocross moto links are named "250 Class Moto #1".

## Open items

1. **Round 1 (Fox Raceway) is scored & complete.** Final: Elbows Out 129, KTM Dad 94. Imported live via the Refresh button. Round 2 = Hangtown (Jun 6) — watch that it auto-discovers (event name "Hangtown Motocross Classic" vs venue "Prairie City"; `cityMatchesRace` should handle it, but verify race day).
2. **MX injury status is manual** — the injury cron (`/api/cron/injury-report`) is SX-only. Set `rider_series.status='out'` manually when MX riders get hurt. `riders.status` holds stale SX injuries (24 riders incl. Jett Lawrence) — MX UI reads `rider_series.status` everywhere, so ignore `riders.status` for MX.
3. **Remaining low-priority SX-isms** (audited 2026-05-30, NOT fixed — non-user-facing): standalone `/lineup` and `/roster` pages still use SX class logic but **nothing links to them**; the **Admin → Riders** class dropdown is 450/250E/250W (only matters if manually adding MX riders there).

### Fixed in the 2026-05-30 MX-awareness audit
Standings breakdown, weekly recap, season recap all now override class from `rider_series` and scope races to the league's series (recap previously defaulted to the SX finale and mis-bucketed 450MX riders into 250 / mistook 4 moto holeshots for a Triple Crown). Transaction-date "Invalid Date" (`+ "Z"`) fixed on team + free-agents. Renew/"Start New Season" button now gated on `seasonOver` (all races completed), not just draft-complete.

## What was done 2026-05-30 (this session)

All committed/pushed to `main` and live:
- **Full rider pool** — 146 riders (71×450MX, 75×250MX) from the official Fox Raceway entry list; bikes backfilled (drives team color). All `active` in `rider_series`.
- **Roster size → 20** (was 22), kept 8×450 / 8×250. League settings card made series-aware (single "250 Slots" for MX, not East/West).
- **Draft fixes:** `league_rosters` unique constraint (draft now saves rosters), auto-pick draws from series pool, dead timer fixed (`+00:00` parsing), draft-page resilience (ignores non-200, login screen on 401, self-recovers), Recent Picks + Coming Up ticker tinted with each team's bike-brand color.
- **Schedule fixed:** `races` id sequence was behind `max(id)`, so the original MX seed silently dropped 10 of 11 rounds (only R4 survived); resynced sequence + restored all 11. Made `/schedule` series-aware (SX/MX toggle, no bogus "250 WEST" on MX).
- **Race times set** — all 11 rounds have `race_time` = first-moto gate drop (1 PM local per promotocross TV schedule). Lineups lock at gate drop. Round 2 renamed to official "Hangtown Motocross Classic".
- **Lineup (team page) made MX-aware** — race picker scoped to series + auto-selects next race; team API returns `series`, scopes upcoming race, and remaps roster/lineup **class + status** from `rider_series` (riders.class/status are stale SX). 450MX/250MX groups, no East/West.
- **Stats scoped to series** — rider-stats only counts the league's series races (no more SX-season points on MX teams).
- **Lineup lock fix** — `isRaceLocked` no longer locks at midnight of race day when `race_time` is unset (now that all races have race_time this is moot, but it's the correct fallback).

## MX league (DB)

- League ID: **3**, `series='mx'`, `draft_status='completed'`, `roster_size=20`
- `lineup_450=8` (450MX starters/wk), `lineup_250e=8` (250MX starters — column repurposed), `lineup_250w=0` (unused)
- Members: user **4** = connorfranklin499 (commissioner, Connor), user **6** = tsfranklin (Connor's dad, real user)
- 40 roster rows (20 per user)

## MX schedule (live, race_time = gate drop)

| R | Name | Date | race_time (UTC) | Local gate drop |
|---|---|---|---|---|
| 1 | Fox Raceway National | May 30 | 20:00 | 1 PM PT |
| 2 | Hangtown Motocross Classic | Jun 6 | 20:00 | 1 PM PT |
| 3 | Thunder Valley National | Jun 13 | 19:00 | 1 PM MT |
| 4 | High Point National | Jun 20 | 17:00 | 1 PM ET |
| 5 | RedBud National | Jul 4 | 17:00 | 1 PM ET |
| 6 | Southwick National | Jul 11 | 17:00 | 1 PM ET |
| 7 | Spring Creek National | Jul 18 | 18:00 | 1 PM CT |
| 8 | Washougal National | Jul 25 | 20:00 | 1 PM PT |
| 9 | Unadilla National | Aug 15 | 17:00 | 1 PM ET |
| 10 | Budds Creek National | Aug 22 | 17:00 | 1 PM ET |
| 11 | Ironman National | Aug 29 | 17:00 | 1 PM ET |

## Migrations (all run)

| Migration | Status |
|---|---|
| `2026-05-04_unique_rider_per_league_roster.sql` | ✅ |
| `2026-05-04b_outdoor_motocross_schema.sql` | ✅ |
| `2026-05-21_league_groups.sql` | ✅ |
| `2026-05-22_mx_races.sql` | ✅ |
| `2026-05-22_mx_rider_series.sql` | ✅ |
| `2026-05-28_league_archived.sql` | ✅ |
| `2026-05-28_mx_rider_additions.sql` | ✅ |
| `2026-05-29_mx_full_entry_list.sql` | ✅ (→146 riders) |
| `2026-05-29b_league_rosters_unique.sql` | ✅ (draft saves rosters) |
| `2026-05-29c_mx_rider_bikes.sql` | ✅ (bikes/colors) |
| `2026-05-30_fix_mx_races.sql` | ✅ (seq resync + restore 11 rounds) |
| `2026-05-30_mx_race_times.sql` | ✅ (gate-drop locks + Hangtown rename) |

## Key files

| Topic | File |
|---|---|
| Auto-import cron (SX + MX) | `src/app/api/cron/auto-import/route.ts` |
| Draft API / page | `src/app/api/leagues/[id]/draft/route.ts` · `src/app/leagues/[id]/draft/page.tsx` |
| Team page (roster + Edit Lineup modal) | `src/app/leagues/[id]/team/page.tsx` |
| Team API (series class/status override) | `src/app/api/leagues/[id]/team/route.ts` |
| Lineup validation | `src/app/api/leagues/[id]/lineup/route.ts` |
| Free agents | `src/app/api/leagues/[id]/free-agents/route.ts` |
| Rider stats (series-scoped) | `src/app/api/leagues/[id]/rider-stats/route.ts` |
| Race lock | `src/lib/race-lock.ts` |
| Schedule page (series toggle) | `src/app/schedule/page.tsx` |
| Riders endpoint | `src/app/api/riders/route.ts` |
| Series helpers | `src/lib/series.ts` |
| Supabase project | `vprgvmtbxqunijwlnoui` (MCP can't reach it — use service-role key / paste SQL) |
| Production | `fantasy-supercross.vercel.app` (Vercel, git auto-deploy; MCP can't see it — use `vercel` CLI) |
