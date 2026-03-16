import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

interface Rider {
  id: number;
  class: string;
}

// GET /api/leagues/[id]/lineup?raceId=X — get user's lineup for a race
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;
  const raceId = req.nextUrl.searchParams.get("raceId");
  const db = getDb();

  const member = db.prepare("SELECT id FROM league_members WHERE league_id = ? AND user_id = ?").get(id, user.id);
  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  if (!raceId) {
    return NextResponse.json({ error: "raceId required" }, { status: 400 });
  }

  const lineup = db.prepare(`
    SELECT r.* FROM weekly_lineups wl
    JOIN riders r ON r.id = wl.rider_id
    WHERE wl.league_id = ? AND wl.user_id = ? AND wl.race_id = ?
    ORDER BY r.class, r.number ASC
  `).all(id, user.id, raceId);

  return NextResponse.json(lineup);
}

// POST /api/leagues/[id]/lineup — set lineup for a race
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;
  const { raceId, riderIds, raceRegion } = await req.json();
  const db = getDb();

  const member = db.prepare("SELECT id FROM league_members WHERE league_id = ? AND user_id = ?").get(id, user.id);
  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const race = db.prepare("SELECT * FROM races WHERE id = ?").get(raceId) as { status: string; race_time: string | null } | undefined;
  if (!race) {
    return NextResponse.json({ error: "Race not found" }, { status: 404 });
  }
  const raceStarted = race.race_time && new Date(race.race_time) <= new Date();
  if (race.status === "completed" || raceStarted) {
    return NextResponse.json({ error: "Lineup is locked — race has started" }, { status: 400 });
  }

  const league = db.prepare("SELECT * FROM leagues WHERE id = ?").get(id) as {
    lineup_450: number;
    lineup_250e: number;
    lineup_250w: number;
  };

  // Validate all riders are on roster
  const rosterRiders = db.prepare(`
    SELECT r.id, r.class FROM league_rosters lr
    JOIN riders r ON r.id = lr.rider_id
    WHERE lr.league_id = ? AND lr.user_id = ?
  `).all(id, user.id) as Rider[];

  const rosterSet = new Set(rosterRiders.map((r) => r.id));
  const riderClassMap = new Map(rosterRiders.map((r) => [r.id, r.class]));

  for (const rid of riderIds) {
    if (!rosterSet.has(rid)) {
      return NextResponse.json({ error: "All riders must be on your roster" }, { status: 400 });
    }
  }

  // Count per class
  const classCounts: Record<string, number> = { "450": 0, "250E": 0, "250W": 0 };
  for (const rid of riderIds) {
    const cls = riderClassMap.get(rid) || "";
    if (cls in classCounts) classCounts[cls]++;
  }

  // Determine which 250 classes are active based on race region
  const need250E = raceRegion === "east" || raceRegion === "showdown" || !raceRegion;
  const need250W = raceRegion === "west" || raceRegion === "showdown" || !raceRegion;

  if (classCounts["450"] !== league.lineup_450) {
    return NextResponse.json({ error: `Must select exactly ${league.lineup_450} rider(s) from 450 class` }, { status: 400 });
  }
  if (need250E && classCounts["250E"] !== league.lineup_250e) {
    return NextResponse.json({ error: `Must select exactly ${league.lineup_250e} rider(s) from 250E class` }, { status: 400 });
  }
  if (need250W && classCounts["250W"] !== league.lineup_250w) {
    return NextResponse.json({ error: `Must select exactly ${league.lineup_250w} rider(s) from 250W class` }, { status: 400 });
  }

  // Transaction: clear old lineup, insert new
  const insertLineup = db.prepare(
    "INSERT INTO weekly_lineups (league_id, user_id, race_id, rider_id) VALUES (?, ?, ?, ?)"
  );
  const deleteLineup = db.prepare(
    "DELETE FROM weekly_lineups WHERE league_id = ? AND user_id = ? AND race_id = ?"
  );

  db.transaction(() => {
    deleteLineup.run(id, user.id, raceId);
    for (const rid of riderIds) {
      insertLineup.run(id, user.id, raceId, rid);
    }
  })();

  return NextResponse.json({ success: true });
}
