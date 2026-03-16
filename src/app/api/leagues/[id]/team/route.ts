import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";



// GET /api/leagues/[id]/team — get team info + starting lineup for upcoming race
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const member = db.prepare(
    "SELECT team_name, team_logo FROM league_members WHERE league_id = ? AND user_id = ?"
  ).get(id, user.id) as { team_name: string | null; team_logo: string | null } | undefined;

  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const league = db.prepare("SELECT * FROM leagues WHERE id = ?").get(id) as {
    id: number; name: string; lineup_450: number; lineup_250e: number; lineup_250w: number; draft_status: string;
  };

  // Get upcoming race
  const upcomingRace = db.prepare("SELECT * FROM races WHERE status = 'upcoming' ORDER BY round_number ASC LIMIT 1").get() as {
    id: number; name: string; round_number: number | null;
  } | undefined;

  // Get lineup for upcoming race
  let lineup: { id: number; name: string; number: number | null; team: string | null; class: string }[] = [];
  if (upcomingRace) {
    lineup = db.prepare(`
      SELECT r.id, r.name, r.number, r.team, r.class FROM weekly_lineups wl
      JOIN riders r ON r.id = wl.rider_id
      WHERE wl.league_id = ? AND wl.user_id = ? AND wl.race_id = ?
      ORDER BY r.class, r.number ASC
    `).all(id, user.id, upcomingRace.id) as typeof lineup;
  }

  // Get full roster
  const roster = db.prepare(`
    SELECT r.id, r.name, r.number, r.team, r.class FROM league_rosters lr
    JOIN riders r ON r.id = lr.rider_id
    WHERE lr.league_id = ? AND lr.user_id = ?
    ORDER BY r.class, r.number ASC
  `).all(id, user.id) as { id: number; name: string; number: number | null; team: string | null; class: string }[];

  return NextResponse.json({
    team_name: member.team_name,
    team_logo: member.team_logo,
    league,
    upcoming_race: upcomingRace || null,
    lineup,
    roster,
  });
}

// POST /api/leagues/[id]/team — update team name/logo
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const member = db.prepare(
    "SELECT id FROM league_members WHERE league_id = ? AND user_id = ?"
  ).get(id, user.id);

  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const body = await req.json();

  if (body.team_name !== undefined) {
    const name = (body.team_name as string).trim().slice(0, 30);
    db.prepare("UPDATE league_members SET team_name = ? WHERE league_id = ? AND user_id = ?")
      .run(name || null, id, user.id);
  }

  if (body.team_logo !== undefined) {
    const logoData = body.team_logo as string;
    if (logoData) {
      // Store bike config JSON directly
      db.prepare("UPDATE league_members SET team_logo = ? WHERE league_id = ? AND user_id = ?")
        .run(logoData, id, user.id);
    } else {
      db.prepare("UPDATE league_members SET team_logo = NULL WHERE league_id = ? AND user_id = ?")
        .run(id, user.id);
    }
  }

  return NextResponse.json({ success: true });
}
