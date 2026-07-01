# Session State — pick up here next time

**Last updated:** 2026-07-01

## Status: MX 2026 season underway — Rounds 1–4 scored & audited, Round 5 (RedBud) is Jul 4

Draft complete, rosters saved, app fully MX-aware end to end. Everything is live in production (`fantasy-supercross.vercel.app`, auto-deploys from `main`).

### Current standings (after 4 rounds) — Elbows Out 461, KTM Dad 453
- **Round 1 (Fox Raceway):** Elbows Out 129, KTM Dad 102
- **Round 2 (Hangtown, race id 21, event 507221):** KTM Dad 118, Elbows Out 108 — both audited 0-mismatch vs the official source.
- **Round 3 (Thunder Valley, race id 26, event 507938):** KTM Dad 126, Elbows Out 108
- **Round 4 (High Point, race id 4, event 508725):** Elbows Out 116, KTM Dad 107
- **Season total: Elbows Out 461, KTM Dad 453.** Rounds 1–4 each have full results + all 4 holeshot bonuses (moto1/moto2 × 450/250). R5+ correctly still `upcoming`.

### New this session (2026-07-01) — recap highlight bug (live)
- **FIXED: race recaps highlighted riders picked up AFTER the race.** Connor's 2026-06-30 pickup of Casey Cochran (rider 143, dropped 121) made the R4 High Point recap show Cochran with Connor's blue highlight + his 8 pts, though he was in nobody's R4 lineup. Cause: `computeRaceMatchup`'s `riderToUser` map (recap + live-tracker highlighting) was built from `league_rosters` (current roster) instead of that race's `weekly_lineups`. Fix in `src/lib/race-scoring.ts`: build the map from the race's locked lineup. Commit `02434fe`, pushed/live.
- **Scoring verified unaffected** (prod DB): Cochran has zero `weekly_lineups` rows for race 4; dropped rider 121 still in the R4 lineup (drops only delete `upcoming`-race lineup rows); leaderboard/breakdown/season-recap all score strictly from `weekly_lineups`. Standings unchanged — display-only bug. Rule: any historical "who owned this rider" display must read `weekly_lineups`, never `league_rosters` (see memory [[roster-vs-weekly-lineups]]).

### Prior session (2026-06-30) — bug fixes + R3 backfill (all live)
- **FIXED: R4 results vanished from rider cards (PostgREST 1000-row cap).** `race_results` crossed 1000 rows (1041), and `rider-stats` + `season-recap` fetched it **unfiltered** then filtered in JS — so PostgREST silently truncated the newest rows (R4 High Point, highest ids): only 33/74 R4 rows survived, dropping ~41 riders' R4 from their profile cards. **Standings were never affected** (leaderboard filters server-side). Fix: scope both fetches by `race_id` server-side (`.in("race_id", seriesRaceIds)`). `season-recap` had the same latent bug (would've skewed final standings at season end). New memory [[postgrest-1000-row-cap]]. Commit `bab8436`.
- **FIXED: navbar showed "Login" while signed in.** Navbar is a client component in the root layout that checked `/api/auth/me` only on mount; login does a client-side `router.push` + `router.refresh()`, but `refresh()` only re-renders Server Components, so the Navbar kept its logged-out state until a hard reload. Fix: re-check auth on `usePathname()` change; load leagues on identity change. Also covers register. Commit `bab8436`.
- **FIXED: free-agents back button** now goes to `/leagues/[id]/team` ("Back to My Team"), was going to league home. Commit `bab8436`.
- **DONE: Carson Wood R3 backfill** (resolves old pending #5). His R3 debut (250 M1 P27=0, M2 P10=3 → 3 pts, avg P19) was never written because he joined the pool Jun 15, after the R3 import. Upserted his `race_results` row (race 26) via service-role PostgREST; record in `migrations/2026-06-30_mx_carson_wood_r3_backfill.sql`. Free agent → zero standings impact. Commit `1ab6001`.

### New this session (2026-06-17)
- **Rider pool → 173.** Added three 250MX riders for **Round 4 (High Point, Jun 20)**, per Racer X (2026-06-17): **Vincent Wey #270** + **Kade Johnson #801** (Monster Energy Kawasaki Team Green), **Luke Fauser #462** (Privateer KTM) — all pro debuts/early starts. Migration `2026-06-17_mx_high_point_debuts.sql` (idempotent record). None rostered yet, so no standings impact; they'll auto-link on the High Point import (name-match).
- **No SQL editor needed for rider-adds.** Applied via a throwaway service-role `node` script doing idempotent PostgREST inserts WITHOUT explicit ids — sequences were synced (post-Carson-Wood), so they landed clean at ids **248–250**, sequence self-advanced, no drift, no `setval` required. The committed `.sql` stays the record; pasting it later is a safe no-op. New feedback memory [[applying-rider-add-migrations]]. Fallback: if a no-id insert ever 23505s, use the SQL editor so the `setval`-FIRST guard runs.

### Prior session (2026-06-15)
- **Rider pool → 170.** Added **Carson Wood #226 (250MX, Monster Energy Yamaha Star Racing)** — flagged by the "Unmatched Riders" webhook after Round 3. He made his 250 pro debut at Thunder Valley (motos 27-10) and scored **3 pts (P10 moto 2)** that didn't count because he wasn't in the DB. Migration `2026-06-14_mx_carson_wood.sql` (applied to prod; idempotent record). **Not rostered by anyone**, so R3 standings are unaffected — but his `race_results` row won't exist until **Round 3 is re-imported** (use the "Refresh results" button or auto-import after this add).
- **Sequence drift is BACK** despite the 528fea8 resync. The Carson Wood insert first hit `23505 riders_pkey id=245` (Lucas Coenen's explicit id). Fix: the migration now resyncs `riders`/`rider_series` sequences **BEFORE** the insert (the old order put the resync after, so nextval collided before it ran). **Rule for any future explicit-id migration: resync the sequence FIRST.** See [[db-sequence-drift]].
- **n8n "Unmatched Rider Email" body was `undefined`** — the Send-Email node referenced `{{ $json.message }}` but the webhook nests the payload under `body`, so the field is `{{ $json.body.message }}`. **STILL NEEDS A MANUAL UI FIX** (n8n workflow id `Ooang1qN5BC4ruad`, node "Send an Email", html field): the n8n-MCP write path can't touch this instance (versioned-workflow API rejects the reconstructed body; validation passes but apply 400s). Also a subject typo: "Fanasy SX: UnMatched" → "Fantasy SX: Unmatched".
- **Removed the dead SX-only roster API route** (`src/app/api/leagues/[id]/roster/route.ts`) — it lingered as an untracked leftover after the 087bccf2/086a321 cleanup. Confirmed unreferenced; add/drop lives in `free-agents` (POST), draft in `draft`, roster reads in `team`. Recoverable from git history if ever needed.
- **RLS:** app uses the service-role key only (server-side, bypasses RLS), so RLS isn't needed for function — but enabled it on all `public` tables (no policies) as the security baseline so the public anon/PostgREST key can't hit tables directly. Service role still bypasses, so no app change. Verify Advisors → Security is clear.

### Previous session (2026-06-10)
- **Rider pool → 169.** Added the Coenen brothers (Red Bull KTM Factory Racing) for Round 3 (Thunder Valley): **Lucas Coenen #104 (450MX)**, **Sacha Coenen #109 (250MX)**. Migration `2026-06-10_mx_coenen_brothers.sql` (applied to prod; file is the idempotent record). Pool now 87×450MX + 82×250MX. Watch the Round 3 import matches both names vs promotocross spelling (the name-match strand risk).

### Previous session (2026-06-07)
- **"Track Race Live" tab** — `/leagues/[id]/live` shows the head-to-head matchup auto-refreshing every 60s during a race (gate drop → +6h, while status `upcoming`), then hands off to Race Recap. Red banner on the league dashboard when a race is live. Matchup math shared via `src/lib/race-scoring.ts` (`computeRaceMatchup`, used by Recap + Live).
- **Fixed silent bonus failure** — `race_bonuses` id sequence had drifted behind max(id), so holeshot inserts failed with 23505 and Hangtown finished with 0 holeshots. Resynced the sequence (data repaired) and the importer now surfaces `bonusError`. **Watch any seeded table for this drift** (see migrations + `db-sequence-drift` memory).
- **Rider pool → 167.** Added 20 riders missing from both weekends (scanned all 250/450 qualifying/LCQ/moto sessions). Every rider now has a number + manufacturer; privateers labeled "Privateer <Brand>". Enzo Temmerman now matches on import.
- **Per-moto finishes on rider profile.** New `race_results.moto_results` JSONB column (`[{moto,position,points}]`); importer writes it for MX, `RiderStatsModal` shows "M1 P3 · M2 P6" per MX race. Rounds 1 & 2 backfilled (also created 5 missing Hangtown rows for the late-added privateers — Enzo Temmerman had 4 uncounted pts; none rostered, standings unchanged).
- **Migrations added:** `2026-06-06_fix_race_bonuses_sequence.sql`, `2026-06-07_mx_missing_riders_weekends_1_2.sql`, `2026-06-07b_privateer_team_labels.sql`, `2026-06-07c_race_results_moto_breakdown.sql` (all applied to prod; files are the idempotent record).

## MX scoring model (changed 2026-05-30)

- **Each moto scored individually and summed per rider** (not the combined overall). A 1-1 = 20 pts/class. Points table (per moto): `1→10, 2→8, 3→7, 4→6, 5→5, 6-7→4, 8-10→3, 11-14→2, 15-20→1, 21+→0` (`getMxMotoPoints`). **SX is unchanged** (`getPointsForPosition`, pays 21-22 = 1).
- **No moto-winner bonus.** **Holeshot = +1 per moto** (so up to 2/class/event).
- Stored `race_results.position` = rider's running **average finish** across their motos (drives the avg-finish stat).
- **Incremental import:** the cron scores whatever motos are posted and recomputes each run (idempotent). MX races stay `status='upcoming'` (so scoring keeps refreshing) until the **overall** posts, then flip to `completed`.
- **Live refresh:** `POST /api/cron/auto-import` (session-authed, delegates to the nightly GET) + a **"Refresh results"** button on the league Standings card — pull results live as motos finish. Note the nightly cron only runs once at 06:00 UTC, so use the button (or a future frequent cron) to watch live. Import only acts once `race_time` (gate drop) has passed.
- **Import verified live (Round 1, 2026-05-30):** 250 Moto 1 scored correctly. Two bugs fixed along the way: event-id city matching (exact substrings → shared-word `cityMatchesRace`, fixes verify + auto-discover) and moto parsing (`classifyRace` now allows "Moto **#**1"). Fox Raceway `event_id=506003` set. Promotocross moto links are named "250 Class Moto #1".

## Round 1 audit + duplicate-rider fix (2026-06-03)

Audited every Round 1 moto score against the official source (results.promotocross.com event 506003, all 4 motos parsed from raw HTML). **All 83 result values + 4 holeshots imported correctly** — positions, summed moto points, avg finish all matched. The only defect was a **duplicate-rider** problem, not a scoring bug:

- The 2026-05-29 full-entry-list seed created **second `riders` rows** for 4 people who already existed from SX (Hampshire, Romano, Noren, Luhovey). The importer's `findRider` matches by **name across the whole `riders` table**, so promotocross's SX-style spelling ("Nicholas Romano", "R.J. Hampshire", "Freddie Noren", "Vinny Luhovey") matched the **original SX rows** — while the MX draft/rosters/lineups pointed at the **new duplicate** rows. Result: a rostered rider's correct points landed on a record the lineup didn't reference.
- **RJ Hampshire** (started by tsfranklin/KTM Dad) was the only rostered casualty → his 8 pts didn't count.
- **Fix applied (SQL, 2026-06-03):** merged each MX-dup back into its original/canonical id (Hampshire 150→126, Romano 198→140, Noren 154→16, Luhovey 178→68 — moved `rider_series` mx + roster/lineup/draft_pick, deleted the dup `riders` rows). Kept the **official timing-site spelling** as the canonical name so future imports exact-match with **no aliases** needed. Also added **Vince Friese** (#719) to the MX pool (`rider_series` row on existing id 33; raced R1 450, not rostered) and fixed **Jett Lawrence's** MX number **18→1** (#1 plate). No `race_results` edits were needed.
- **Corrected Round 1 final: Elbows Out 129, KTM Dad 102** (was 94). Verified in DB.
- **Watch for recurrence:** any rider with a duplicate `riders` row + name that differs from promotocross is the failure mode. All numbers verified accurate as of R1 (Webb #2, Deegan #38 already correct).

## Open items

1. **Round 1 (Fox Raceway) is scored, complete & audited.** Final: **Elbows Out 129, KTM Dad 102**. Round 2 = Hangtown (Jun 6) — watch that it auto-discovers (event name "Hangtown Motocross Classic" vs venue "Prairie City"; `cityMatchesRace` should handle it, but verify race day).
2. **MX injury status is manual** — the injury cron (`/api/cron/injury-report`) is SX-only. Set `rider_series.status='out'` manually when MX riders get hurt. `riders.status` holds stale SX injuries (24 riders incl. Jett Lawrence) — MX UI reads `rider_series.status` everywhere, so ignore `riders.status` for MX.
3. ~~Remaining low-priority SX-isms~~ **RESOLVED.** The orphaned `/lineup` + `/roster` pages and the roster API route are removed (87bccf2 + this session); Admin → Riders class dropdown is now 450/250.
4. **PENDING (this session): fix the n8n unmatched-rider email body in the UI** — `{{ $json.message }}` → `{{ $json.body.message }}` (workflow `Ooang1qN5BC4ruad`, node "Send an Email"). Until then the alert emails render "undefined" (the rider data still arrives in the webhook payload, so executions are recoverable via n8n).
5. ~~**PENDING: re-import Round 3** so Carson Wood's result row is written~~ **RESOLVED 2026-06-30** — backfilled his R3 row directly (`migrations/2026-06-30_mx_carson_wood_r3_backfill.sql`), no full re-import needed.

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
| `2026-06-10_mx_coenen_brothers.sql` | ✅ (Lucas #104 450MX + Sacha #109 250MX, Red Bull KTM) |
| `2026-06-14_mx_carson_wood.sql` | ✅ (Carson Wood #226 250MX, Star Yamaha; resync-seq-FIRST pattern) |

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
