import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/leagues/[id]/roster — get user's roster for this league
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const member = db.prepare("SELECT id FROM league_members WHERE league_id = ? AND user_id = ?").get(id, user.id);
  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const roster = db.prepare(`
    SELECT r.* FROM league_rosters lr
    JOIN riders r ON r.id = lr.rider_id
    WHERE lr.league_id = ? AND lr.user_id = ?
    ORDER BY r.class, r.number ASC
  `).all(id, user.id);

  return NextResponse.json(roster);
}

// POST /api/leagues/[id]/roster — draft rider to roster
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;
  const { riderId } = await req.json();
  const db = getDb();

  const member = db.prepare("SELECT id FROM league_members WHERE league_id = ? AND user_id = ?").get(id, user.id);
  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const league = db.prepare("SELECT roster_size FROM leagues WHERE id = ?").get(id) as { roster_size: number };

  const currentCount = db.prepare(
    "SELECT COUNT(*) as cnt FROM league_rosters WHERE league_id = ? AND user_id = ?"
  ).get(id, user.id) as { cnt: number };

  if (currentCount.cnt >= league.roster_size) {
    return NextResponse.json({ error: `Roster is full (${league.roster_size} max)` }, { status: 400 });
  }

  const rider = db.prepare("SELECT id FROM riders WHERE id = ?").get(riderId);
  if (!rider) {
    return NextResponse.json({ error: "Rider not found" }, { status: 404 });
  }

  const existing = db.prepare(
    "SELECT id FROM league_rosters WHERE league_id = ? AND user_id = ? AND rider_id = ?"
  ).get(id, user.id, riderId);
  if (existing) {
    return NextResponse.json({ error: "Already on your roster" }, { status: 400 });
  }

  db.prepare("INSERT INTO league_rosters (league_id, user_id, rider_id) VALUES (?, ?, ?)").run(id, user.id, riderId);
  return NextResponse.json({ success: true });
}

// DELETE /api/leagues/[id]/roster — drop rider from roster
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;
  const { riderId } = await req.json();
  const db = getDb();

  db.prepare(
    "DELETE FROM league_rosters WHERE league_id = ? AND user_id = ? AND rider_id = ?"
  ).run(id, user.id, riderId);

  // Also remove from upcoming lineups
  db.prepare(`
    DELETE FROM weekly_lineups
    WHERE league_id = ? AND user_id = ? AND rider_id = ?
    AND race_id IN (SELECT id FROM races WHERE status = 'upcoming')
  `).run(id, user.id, riderId);

  return NextResponse.json({ success: true });
}
