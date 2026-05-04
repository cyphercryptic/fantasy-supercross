# Pro Motocross (Outdoors) Expansion — Implementation Plan

**Status:** Planned. Do not implement until after the 2026 SX season ends (Salt Lake City, May 9, 2026).

This doc captures everything we need to add Pro Motocross support to the app
without breaking existing Supercross functionality.

---

## Open questions to resolve before starting

These came up while scoping. Defaults are noted but should be confirmed before
the work starts.

1. **One league or two?**
   - **Default:** Separate league per series. Cleaner standings, allows different
     drafts, mirrors how AMA actually treats the seasons.
   - Alternative: Single league with combined SX + MX standings (SMX-style).

2. **Re-draft for outdoors?**
   - **Default:** Yes. Outdoor rosters always change — some SX-only riders sit
     out, some MX specialists return, rookies join. A new draft keeps it fair.

3. **Scoring**
   - **Default:** Reuse existing scoring table (10-8-7-6-5-4-4-3-3-3-2-2-2-2-1×8).
     Treat the official "overall" as the result, same as Triple Crown logic.
   - Each moto has its own holeshot — both should award bonuses.

4. **SMX playoffs (Aug 30 / Sep 6 / Sep 13, 2026)**
   - **Default:** Treat as a third "series" (`smx`) with its own 3-round
     mini-season after MX ends. Or skip and revisit next year.

5. **Number plates**
   - SX riders carry SX numbers (1, 2, 3...), MX riders carry MX career numbers.
     For most pros these match; some differ. Decide whether to track per-series
     numbers or use one canonical number per rider.

---

## Format differences cheat sheet

| | Supercross | Pro Motocross | SMX Playoffs |
|---|---|---|---|
| Season | Jan – early May | mid-May – late Aug | late Aug – mid Sep |
| Rounds | 17 | 11 | 3 |
| Race format | 1 main event | 2 motos, combined finish = race result | Triple Crown style (3 mains) |
| Classes | 450 SX, 250 SX East, 250 SX West | 450 MX, 250 MX (no E/W split) | Combined 450 SMX, 250 SMX |
| Heats | Yes | No (gates straight to motos) | No |
| LCQ | Yes | No (motos are gated by qualifying time) | Yes |
| Holeshots | 1 per class per main | 2 per class per round (one per moto) | 1 per class per main × 3 mains |

---

## Phase 1 — Schema & data model

**Goal:** Add a `series` dimension to existing tables without breaking SX.

### Migrations

```sql
-- New column on races; default 'sx' so existing records stay valid
ALTER TABLE races ADD COLUMN series TEXT NOT NULL DEFAULT 'sx';
CREATE INDEX races_series_status_idx ON races(series, status);

-- Same on leagues so a league is locked to a series
ALTER TABLE leagues ADD COLUMN series TEXT NOT NULL DEFAULT 'sx';

-- Riders may participate in multiple series with different classes
CREATE TABLE rider_series (
  rider_id INTEGER NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  series TEXT NOT NULL,           -- 'sx' | 'mx' | 'smx'
  class TEXT NOT NULL,            -- '450', '450MX', '250E', '250W', '250MX', etc
  status TEXT DEFAULT 'active',   -- per-series status (Q/OUT/active)
  PRIMARY KEY (rider_id, series)
);

-- Backfill existing rider rows into rider_series for SX
INSERT INTO rider_series (rider_id, series, class, status)
SELECT id, 'sx', class, status FROM riders;
```

### Code changes (data layer)

- Every existing query that touches `races` adds `.eq("series", series)` based
  on the league's series.
- Standings/leaderboard scoped to the league's series (already implicit since
  the league is series-locked).
- `riders.class` and `riders.status` are deprecated in favor of `rider_series`
  rows. Keep the columns for now to not break SX mid-implementation.

### New 11 MX races to insert (2026 schedule)

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

Confirm exact dates and venue order against AMA when we start.

---

## Phase 2 — Rider classes for MX

Pull the official MX entry list (or use rider announcements) to populate
`rider_series` for the MX season.

- 450 MX class roster: ~40 riders typically
- 250 MX class roster: ~40 riders typically
- A handful race both classes; we treat them as one entry per series (e.g.,
  Levi Kitchen does 250 MX but does some 450 SX rounds too)

Build a one-time admin script (similar to how we updated team names from
Racer X) that scrapes the MX entry lists and inserts/updates `rider_series`.

---

## Phase 3 — Scraping MX results

The supercrosslive.com results system also covers Pro Motocross under the
same domain (or possibly `results.promotocross.com` — to be verified).

### What to scrape per MX round

For each class:
- **Moto 1** → finishing order + holeshot
- **Moto 2** → finishing order + holeshot
- **Overall** → combined finish (the official result we score)

This is exactly the Triple Crown scraping pattern we already built. We can
reuse `fetchOverallResults`, `fetchRaceResults`, and the existing holeshot
detection. The main work is:

1. Find the MX event_id for each round.
2. Map race links by name pattern: `/250 Moto #1/`, `/450 Moto #2/`,
   `/250 Overall Results/`.
3. Adapt `classifyRace` to recognize "Moto" as a main-event marker.
4. Save 2 holeshot bonuses per class instead of 1 (we already support N
   holeshots from Triple Crown work).

### Cron schedule for MX

MX races are typically Saturday afternoons. Update GitHub Actions:
- Existing race-day-import cron schedule already covers Saturday — extend the
  hours to cover earlier MX start times (~1 PM ET first moto).
- Same news-sync schedule continues.
- Same daily Vercel auto-import + injury-report continues.

---

## Phase 4 — UI changes

### Schedule page
- Tab or filter for SX / MX / SMX.
- Schedule grouped by series.
- Format badges: add a "2-Moto" badge, distinct from Triple Crown.

### Lineup page
- Class options change based on series:
  - SX league → 450, 250E, 250W
  - MX league → 450MX, 250MX
- Lineup composition fields on the league config drive what's required.

### Recap page
- For MX races, show overall + both motos.
- Holeshot section displays "Moto 1 holeshot" / "Moto 2 holeshot" per class.
- Format badge "2-Moto" on header.

### Season recap
- Already series-scoped via league; no changes needed beyond making sure
  the data queries respect series.

### Team page (rider browser)
- Filter riders by current league's series.
- Status badges (Q/OUT) read from `rider_series.status` not `riders.status`.

---

## Phase 5 — Migration of existing user

When MX season starts, the user (and their dad) will:

1. Create a new league with `series = 'mx'`.
2. Use the SAME existing app accounts (no signup needed).
3. Re-pick brand colors (could persist across leagues or pick fresh per league).
4. Draft fresh roster.

The existing SX league stays read-only as a finished season archive (with
the season recap page available indefinitely).

---

## Estimated effort

Rough breakdown assuming I'm doing the work in normal flow:

| Phase | Estimate |
|---|---|
| 1. Schema + migrations + race insert | 1 hour |
| 2. Rider class scraping & insert | 1 hour |
| 3. MX result scraping (cron logic) | 2 hours |
| 4. UI updates (schedule/lineup/recap) | 2 hours |
| 5. Polish + testing during round 1 | ongoing |
| **Total** | **~6 hours of focused work** |

---

## Out of scope for v1 (revisit later)

- SMX playoff series — get MX working first
- Cross-series stats ("season-long combined SMX standings")
- Fantasy contests across leagues (head-to-head between SX and MX leagues)
- Weather/track condition data
- Practice timing
