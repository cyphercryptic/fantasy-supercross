import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/leagues/[id] — league details
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const league = db.prepare("SELECT * FROM leagues WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const member = db.prepare("SELECT id FROM league_members WHERE league_id = ? AND user_id = ?").get(id, user.id);
  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const members = db.prepare(`
    SELECT u.id, u.username, lm.joined_at
    FROM league_members lm
    JOIN users u ON u.id = lm.user_id
    WHERE lm.league_id = ?
    ORDER BY lm.joined_at ASC
  `).all(id);

  return NextResponse.json({
    ...league,
    is_commissioner: league.commissioner_id === user.id,
    members,
  });
}

// DELETE /api/leagues/[id] — delete league (commissioner only)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const league = db.prepare("SELECT commissioner_id FROM leagues WHERE id = ?").get(id) as { commissioner_id: number } | undefined;
  if (!league || league.commissioner_id !== user.id) {
    return NextResponse.json({ error: "Commissioner access required" }, { status: 403 });
  }

  db.prepare("DELETE FROM leagues WHERE id = ?").run(id);
  return NextResponse.json({ success: true });
}
