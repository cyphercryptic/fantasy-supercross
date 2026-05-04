# Pro Motocross (Outdoors) Expansion — Implementation Plan

**Status:** In progress (started 2026-05-04 evening). Decisions locked, building
behind the scenes while SX season finishes. **No SX data will be deleted or
modified** — all changes are additive.

---

## Locked decisions

1. **Separate league per series.** Existing SX league stays as-is. A new
   `series='mx'` league will be created when MX starts. Same user accounts can
   join both.
2. **Re-draft for outdoors.** Fresh rosters per season.
3. **Same scoring table** (10-8-7-6-5-4-4-3-3-3-2-2-2-2-1×8). Points come from
   the **official overall finish** (combined motos), not from individual motos.
4. **Bonuses (4 per class per round)**:
   - **Holeshot Moto 1** (1 pt)
   - **Holeshot Moto 2** (1 pt)
   - **Moto 1 winner** (1 pt)
   - **Moto 2 winner** (1 pt)
5. **Class structure:** 450 MX and 250 MX only — no East/West split. All 250
   riders race together every round; all 450 riders race together. 4 motos per
   race day.
6. **Riders can change** numbers, teams, AND class between SX and MX seasons.
   Some 250 riders graduate to 450. We track everything per-series via a
   `rider_series` table; the existing `riders` table stays untouched.

---

## Format cheat sheet

| | Supercross | Pro Motocross | SMX Playoffs |
|---|---|---|---|
| Season | Jan – early May | mid-May – late Aug | late Aug – mid Sep |
| Rounds | 17 | 11 | 3 |
| Race format | 1 main event | 2 motos, combined finish = race result | Triple Crown style (3 mains) |
| Classes | 450 SX, 250 SX East, 250 SX West | **450 MX, 250 MX (no E/W)** | Combined 450 SMX, 250 SMX |
| Heats | Yes | No (gates straight to motos) | No |
| LCQ | Yes | No (motos gated by qualifying) | Yes |
| Bonuses per class per round | 1 holeshot + 2 heat winners + 1 LCQ winner = 4 | **2 holeshots + 2 moto winners = 4** | 3 holeshots (Triple Crown) |

---

## Phase 1 — Schema & migrations

**Goal:** Add a `series` dimension. Make every existing query series-aware
without breaking SX. Riders table stays untouched.

### SQL migration (`migrations/2026-05-04b_outdoor_motocross_schema.sql`)

```sql
BEGIN;

-- 1. Per-series flag on races. Default 'sx' so all existing rows stay valid.
ALTER TABLE races ADD COLUMN IF NOT EXISTS series TEXT NOT NULL DEFAULT 'sx';
CREATE INDEX IF NOT EXISTS races_series_status_idx ON races(series, status);
CREATE INDEX IF NOT EXISTS races_series_round_idx ON races(series, round_number);

-- 2. Per-series flag on leagues. Default 'sx' for existing leagues.
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS series TEXT NOT NULL DEFAULT 'sx';

-- 3. Per-series rider data (number, team, class, status all may differ between SX and MX)
CREATE TABLE IF NOT EXISTS rider_series (
  id SERIAL PRIMARY KEY,
  rider_id INTEGER NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  series TEXT NOT NULL,                    -- 'sx' | 'mx' | 'smx'
  class TEXT NOT NULL,                     -- '450', '250', '250E', '250W', '450MX', '250MX'
  number INTEGER,
  team TEXT,
  status TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'questionable' | 'out'
  UNIQUE (rider_id, series)
);
CREATE INDEX IF NOT EXISTS rider_series_series_idx ON rider_series(series);

-- 4. Backfill rider_series from existing riders table for SX
INSERT INTO rider_series (rider_id, series, class, number, team, status)
SELECT id, 'sx', class, number, team, status
FROM riders
ON CONFLICT (rider_id, series) DO NOTHING;

-- 5. Bonus type expansion (additive — no schema change needed since bonus_type is TEXT)
-- New types we'll use for MX:
--   'moto1_winner_450', 'moto2_winner_450', 'holeshot_moto1_450', 'holeshot_moto2_450'
--   'moto1_winner_250', 'moto2_winner_250', 'holeshot_moto1_250', 'holeshot_moto2_250'

COMMIT;
```

### Code changes — make queries series-aware

Every query that touches `races` or `riders` needs to know which series the
current league belongs to. Two approaches:

- **For SX-only data (existing):** existing code keeps working because the new
  `series` column defaults to `'sx'` everywhere. No code change required.
- **For MX league pages:** each league page resolves `league.series` from DB
  and passes it down. Race/rider queries filter by series.

Concrete file-by-file changes (Phase 1 only — UI comes in later phases):

| File | Change |
|---|---|
| `src/app/api/races/route.ts` | Accept optional `?series=` query param, default to caller's league series if known. |
| `src/app/api/leagues/[id]/team/route.ts` | Filter `riders` joins through `rider_series` to get the per-series number/team/class. |
| `src/app/api/leagues/[id]/free-agents/route.ts` | Same — show riders in this league's series only, with their series-specific numbers. |
| `src/app/api/leagues/[id]/lineup/route.ts` | Validate against series-specific class names. |
| `src/lib/race-region.ts` | `get250Region` returns null for non-SX series (MX has no East/West). |

### MX schedule (11 rounds — 2026)

To insert at start of MX season, NOT during Phase 1:

| Round | Name | Date | Track |
|---|---|---|---|
| 1 | Fox Raceway | May 23 | Pala, CA |
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

Confirm exact dates against AMA closer to season.

---

## Phase 2 — Rider classes & numbers for MX

Build a one-time admin script that:

1. Scrapes the official MX entry list for round 1 (Fox Raceway).
2. For each rider on the entry list:
   - Match against existing `riders` table by name (using existing alias system).
   - Insert/update a `rider_series` row with `series='mx'`, the MX class
     (`450MX` or `250MX`), the MX number, and the MX team.
3. Riders not on the MX entry list get NO `rider_series` row for MX → won't
   appear as draftable for the MX league.
4. Brand-new riders not in our DB yet get inserted into `riders` first, then
   into `rider_series`.

We'll run this script once before the MX league draft.

---

## Phase 3 — Scraping MX results

The supercrosslive event_id system covers both SX and MX. URL patterns may
differ slightly (`promotocross.com` vs `supercrosslive.com`). To verify when
we get there.

### What to scrape per MX round

For each class:
- **Moto 1** → finishing order + holeshot
- **Moto 2** → finishing order + holeshot
- **Overall** → combined finish (the official result we score)

Reuse existing helpers (`fetchOverallResults`, `fetchRaceResults`, holeshot
detection). Adapt:

1. `classifyRace` to recognize "Moto" as a main-event marker for MX.
2. Bonus generation:
   - Holeshot Moto 1 → `holeshot_moto1_<class>`
   - Holeshot Moto 2 → `holeshot_moto2_<class>`
   - Moto 1 winner (P1 of that moto) → `moto1_winner_<class>`
   - Moto 2 winner (P1 of that moto) → `moto2_winner_<class>`
3. The `overall` link is what scores positions — same as Triple Crown.

### Cron schedule for MX

MX races run Saturday afternoons (~1 PM ET first moto, ~3:30 PM ET second
moto, overall posted shortly after). Update GitHub Actions:

- Existing race-day-import already runs Saturday — extend hours to cover
  earlier MX start (e.g. start polling at 17:00 UTC = 1 PM ET).
- News-sync schedule continues unchanged.

---

## Phase 4 — UI changes

### Schedule page
- Section by series (SX completed, MX upcoming).
- Race format badge: add "2-Moto" badge for MX rounds.
- Filter UI: "All / SX / MX / SMX".

### League dashboard
- League header shows series badge (e.g. "Bar 9 Fantasy MX").

### Lineup page
- Class options driven by league.series:
  - SX → 450, 250E, 250W
  - MX → 450MX, 250MX
- Showdown/Triple Crown badges only for SX rounds.
- "2-Moto" badge for MX rounds.

### Recap page
- For MX races, show: overall standings + Moto 1 + Moto 2 (collapsible).
- Holeshot section: 2 holeshots per class labeled Moto 1 / Moto 2.
- Moto-winner bonus section.

### Season recap
- Already series-scoped via league. Just confirm queries respect series.

### Team page (rider browser)
- Filter riders by current league.series.
- Numbers/teams pulled from `rider_series` for the league's series.
- Status badges read from `rider_series.status`.

---

## Phase 5 — User migration when MX starts

When MX season begins:

1. Commissioner creates a new league with `series='mx'`.
2. Same accounts (Connor, Tom) join via invite code.
3. New brand-color picks (independent of SX league).
4. Fresh draft.

Existing SX league stays read-only as a finished season. The Season Recap
page is permanent.

---

## What stays untouched (SX preservation guarantee)

To make sure nothing breaks:

- ✅ `riders` table is **never modified** by MX work. SX-specific data lives
  there forever.
- ✅ `races`, `weekly_lineups`, `race_results`, `race_bonuses`,
  `league_rosters` get a `series` filter via `races.series` — old rows are
  all `'sx'` and stay that way.
- ✅ `leagues` get a `series` column defaulting to `'sx'`. The Bar 9 league
  becomes `'sx'`; the new MX league becomes `'mx'`.
- ✅ Existing SX URLs and pages keep working unchanged.

---

## Status checklist

- [x] Plan locked (this doc)
- [ ] Phase 1 — schema migration written and applied
- [ ] Phase 1 — code: queries become series-aware
- [ ] Phase 2 — MX entry list scraping script
- [ ] Phase 3 — MX result scraping cron
- [ ] Phase 4 — UI updates
- [ ] Phase 5 — user-facing migration / new MX league creation

---

## Out of scope for v1 (revisit later)

- SMX playoff series — get MX working first
- Cross-series stats ("season-long combined SMX standings")
- Practice timing / weather / track conditions
