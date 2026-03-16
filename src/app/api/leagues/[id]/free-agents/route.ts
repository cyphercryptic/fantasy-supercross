import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET — list all free agents (riders not on any roster in this league)
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

  // Free agents = riders NOT on any team's roster in this league
  const freeAgents = db.prepare(`
    SELECT r.* FROM riders r
    WHERE r.id NOT IN (
      SELECT rider_id FROM league_rosters WHERE league_id = ?
    )
    ORDER BY r.class, r.name ASC
  `).all(id);

  // Also get user's current roster
  const myRoster = db.prepare(`
    SELECT r.* FROM league_rosters lr
    JOIN riders r ON r.id = lr.rider_id
    WHERE lr.league_id = ? AND lr.user_id = ?
    ORDER BY r.class, r.number ASC
  `).all(id, user.id);

  // Get recent transactions for this league
  const transactions = db.prepare(`
    SELECT t.*, u.username,
      ar.name as added_rider_name, ar.number as added_rider_number, ar.class as added_rider_class,
      dr.name as dropped_rider_name, dr.number as dropped_rider_number, dr.class as dropped_rider_class
    FROM transactions t
    JOIN users u ON u.id = t.user_id
    LEFT JOIN riders ar ON ar.id = t.added_rider_id
    LEFT JOIN riders dr ON dr.id = t.dropped_rider_id
    WHERE t.league_id = ?
    ORDER BY t.created_at DESC
    LIMIT 20
  `).all(id);

  // Get league roster size
  const league = db.prepare("SELECT roster_size FROM leagues WHERE id = ?").get(id) as { roster_size: number };

  return NextResponse.json({ freeAgents, myRoster, transactions, rosterSize: league.roster_size });
}

// POST — add/drop transaction
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;
  const { addRiderId, dropRiderId } = await req.json();
  const db = getDb();

  const member = db.prepare("SELECT id FROM league_members WHERE league_id = ? AND user_id = ?").get(id, user.id);
  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const league = db.prepare("SELECT roster_size, draft_status FROM leagues WHERE id = ?").get(id) as {
    roster_size: number;
    draft_status: string;
  };

  if (league.draft_status !== "completed") {
    return NextResponse.json({ error: "Draft must be completed before making transactions" }, { status: 400 });
  }

  if (!addRiderId && !dropRiderId) {
    return NextResponse.json({ error: "Must specify a rider to add or drop" }, { status: 400 });
  }

  const currentRoster = db.prepare(
    "SELECT COUNT(*) as cnt FROM league_rosters WHERE league_id = ? AND user_id = ?"
  ).get(id, user.id) as { cnt: number };

  // If adding a rider, verify they're a free agent
  if (addRiderId) {
    const onRoster = db.prepare(
      "SELECT id FROM league_rosters WHERE league_id = ? AND rider_id = ?"
    ).get(id, addRiderId);
    if (onRoster) {
      return NextResponse.json({ error: "Rider is already on a team's roster" }, { status: 400 });
    }

    const riderExists = db.prepare("SELECT id FROM riders WHERE id = ?").get(addRiderId);
    if (!riderExists) {
      return NextResponse.json({ error: "Rider not found" }, { status: 404 });
    }

    // Check roster limit: if not dropping, must have room
    if (!dropRiderId && currentRoster.cnt >= league.roster_size) {
      return NextResponse.json({ error: `Roster is full (${league.roster_size}). You must drop a rider first.` }, { status: 400 });
    }
  }

  // If dropping a rider, verify they're on user's roster
  if (dropRiderId) {
    const onMyRoster = db.prepare(
      "SELECT id FROM league_rosters WHERE league_id = ? AND user_id = ? AND rider_id = ?"
    ).get(id, user.id, dropRiderId);
    if (!onMyRoster) {
      return NextResponse.json({ error: "Rider is not on your roster" }, { status: 400 });
    }
  }

  // Execute the transaction atomically
  const txn = db.transaction(() => {
    // Drop rider
    if (dropRiderId) {
      db.prepare("DELETE FROM league_rosters WHERE league_id = ? AND user_id = ? AND rider_id = ?")
        .run(id, user.id, dropRiderId);
      // Remove from upcoming lineups
      db.prepare(`
        DELETE FROM weekly_lineups
        WHERE league_id = ? AND user_id = ? AND rider_id = ?
        AND race_id IN (SELECT id FROM races WHERE status = 'upcoming')
      `).run(id, user.id, dropRiderId);
    }

    // Add rider
    if (addRiderId) {
      db.prepare("INSERT INTO league_rosters (league_id, user_id, rider_id) VALUES (?, ?, ?)")
        .run(id, user.id, addRiderId);
    }

    // Log the transaction
    let type = "add_drop";
    if (addRiderId && !dropRiderId) type = "add";
    if (!addRiderId && dropRiderId) type = "drop";

    db.prepare(
      "INSERT INTO transactions (league_id, user_id, type, added_rider_id, dropped_rider_id) VALUES (?, ?, ?, ?, ?)"
    ).run(id, user.id, type, addRiderId || null, dropRiderId || null);
  });

  txn();

  return NextResponse.json({ success: true });
}
