import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const MAX_TEAM_SIZE = 8;

// GET /api/draft — get current user's team
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const db = getDb();
  const team = db
    .prepare(
      `SELECT r.* FROM user_teams ut
       JOIN riders r ON r.id = ut.rider_id
       WHERE ut.user_id = ?`
    )
    .all(user.id);
  return NextResponse.json(team);
}

// POST /api/draft — draft a rider
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { riderId } = await req.json();
  const db = getDb();

  // Check team size
  const teamSize = db
    .prepare("SELECT COUNT(*) as count FROM user_teams WHERE user_id = ?")
    .get(user.id) as { count: number };

  if (teamSize.count >= MAX_TEAM_SIZE) {
    return NextResponse.json(
      { error: `Maximum team size is ${MAX_TEAM_SIZE} riders` },
      { status: 400 }
    );
  }

  // Check if already drafted
  const existing = db
    .prepare("SELECT id FROM user_teams WHERE user_id = ? AND rider_id = ?")
    .get(user.id, riderId);

  if (existing) {
    return NextResponse.json({ error: "Rider already on your team" }, { status: 400 });
  }

  db.prepare("INSERT INTO user_teams (user_id, rider_id) VALUES (?, ?)").run(user.id, riderId);
  return NextResponse.json({ success: true });
}

// DELETE /api/draft — drop a rider
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { riderId } = await req.json();
  const db = getDb();
  db.prepare("DELETE FROM user_teams WHERE user_id = ? AND rider_id = ?").run(user.id, riderId);
  return NextResponse.json({ success: true });
}
