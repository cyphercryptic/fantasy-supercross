import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

interface League {
  id: number;
  roster_size: number;
  draft_status: string;
  draft_order: string;
  max_members: number;
  draft_pick_timer: number | null;
  last_pick_at: string | null;
  draft_auto_users: string | null;
}

// Helper: compute whose turn it is and what pick number we're on
function getSnakeDraftInfo(league: League, pickCount: number) {
  const order: number[] = JSON.parse(league.draft_order);
  const numUsers = order.length;
  const totalPicks = numUsers * league.roster_size;

  if (pickCount >= totalPicks) {
    return { completed: true, currentUserId: null, pickNumber: pickCount, round: 0, order };
  }

  const round = Math.floor(pickCount / numUsers) + 1;
  const posInRound = pickCount % numUsers;

  // Snake: odd rounds go forward, even rounds go backward
  const currentUserId = round % 2 === 1
    ? order[posInRound]
    : order[numUsers - 1 - posInRound];

  return { completed: false, currentUserId, pickNumber: pickCount + 1, round, order };
}

// GET /api/leagues/[id]/draft — get draft state
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

  const league = db.prepare("SELECT * FROM leagues WHERE id = ?").get(id) as League;

  if (league.draft_status === "waiting") {
    return NextResponse.json({ draft_status: "waiting" });
  }

  // Get all picks so far
  const picks = db.prepare(`
    SELECT dp.pick_number, dp.round, dp.user_id, dp.rider_id,
      r.name as rider_name, r.number as rider_number, r.team, r.class,
      u.username
    FROM draft_picks dp
    JOIN riders r ON r.id = dp.rider_id
    JOIN users u ON u.id = dp.user_id
    WHERE dp.league_id = ?
    ORDER BY dp.pick_number ASC
  `).all(id) as { rider_id: number; user_id: number; pick_number: number; rider_name: string; rider_number: number | null; rider_team: string | null; rider_class: string; username: string }[];

  const pickCount = picks.length;
  const info = getSnakeDraftInfo(league, pickCount);

  // Get all members with usernames and team logos
  const members = db.prepare(`
    SELECT u.id, u.username, lm.team_name, lm.team_logo FROM league_members lm
    JOIN users u ON u.id = lm.user_id
    WHERE lm.league_id = ?
  `).all(id) as { id: number; username: string; team_name: string | null; team_logo: string | null }[];

  // Get riders already drafted in this league
  const draftedRiderIds = picks.map((p) => p.rider_id);

  const autoUsers: number[] = JSON.parse(league.draft_auto_users || "[]");
  const baseTimer = league.draft_pick_timer || 60;
  const effectiveTimer = info.currentUserId && autoUsers.includes(info.currentUserId) ? 10 : baseTimer;

  return NextResponse.json({
    draft_status: info.completed ? "completed" : "drafting",
    draft_order: info.order,
    current_user_id: info.currentUserId,
    pick_number: info.pickNumber,
    round: info.round,
    total_picks: league.max_members * league.roster_size,
    roster_size: league.roster_size,
    picks,
    members,
    drafted_rider_ids: draftedRiderIds,
    is_my_turn: info.currentUserId === user.id,
    my_id: user.id,
    pick_timer: effectiveTimer,
    pick_started_at: league.last_pick_at,
    server_time: new Date().toISOString(),
    auto_pick_users: autoUsers,
  });
}

// POST /api/leagues/[id]/draft — make a pick
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

  const league = db.prepare("SELECT * FROM leagues WHERE id = ?").get(id) as League;

  if (league.draft_status !== "drafting") {
    return NextResponse.json({ error: "Draft is not active" }, { status: 400 });
  }

  const pickCount = (db.prepare("SELECT COUNT(*) as cnt FROM draft_picks WHERE league_id = ?").get(id) as { cnt: number }).cnt;
  const info = getSnakeDraftInfo(league, pickCount);

  if (info.completed) {
    return NextResponse.json({ error: "Draft is complete" }, { status: 400 });
  }

  if (info.currentUserId !== user.id) {
    return NextResponse.json({ error: "It's not your turn" }, { status: 400 });
  }

  // Check rider exists and isn't already drafted
  const rider = db.prepare("SELECT id FROM riders WHERE id = ?").get(riderId);
  if (!rider) {
    return NextResponse.json({ error: "Rider not found" }, { status: 404 });
  }

  const alreadyDrafted = db.prepare("SELECT id FROM draft_picks WHERE league_id = ? AND rider_id = ?").get(id, riderId);
  if (alreadyDrafted) {
    return NextResponse.json({ error: "Rider already drafted" }, { status: 400 });
  }

  // Make the pick
  db.prepare(
    "INSERT INTO draft_picks (league_id, pick_number, round, user_id, rider_id) VALUES (?, ?, ?, ?, ?)"
  ).run(id, info.pickNumber, info.round, user.id, riderId);

  // Also add to league_rosters
  db.prepare(
    "INSERT OR IGNORE INTO league_rosters (league_id, user_id, rider_id) VALUES (?, ?, ?)"
  ).run(id, user.id, riderId);

  // Remove user from auto-pick list (they manually picked)
  const currentAutoUsers: number[] = JSON.parse(league.draft_auto_users || "[]");
  if (currentAutoUsers.includes(user.id)) {
    const updated = currentAutoUsers.filter((uid) => uid !== user.id);
    db.prepare("UPDATE leagues SET draft_auto_users = ? WHERE id = ?").run(JSON.stringify(updated), id);
  }

  // Reset pick timer
  db.prepare("UPDATE leagues SET last_pick_at = datetime('now') WHERE id = ?").run(id);

  // Check if draft is now complete
  const newPickCount = pickCount + 1;
  const newInfo = getSnakeDraftInfo(league, newPickCount);
  if (newInfo.completed) {
    db.prepare("UPDATE leagues SET draft_status = 'completed' WHERE id = ?").run(id);
  }

  return NextResponse.json({ success: true, completed: newInfo.completed });
}

// PATCH /api/leagues/[id]/draft — auto-pick when timer expires
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const league = db.prepare("SELECT * FROM leagues WHERE id = ?").get(id) as League;

  if (league.draft_status !== "drafting") {
    return NextResponse.json({ error: "Draft is not active" }, { status: 400 });
  }

  // Verify timer has actually expired server-side
  if (league.last_pick_at && league.draft_pick_timer) {
    const started = new Date(league.last_pick_at + "Z").getTime();
    const now = Date.now();
    const elapsed = Math.floor((now - started) / 1000);
    if (elapsed < league.draft_pick_timer) {
      return NextResponse.json({ error: "Timer has not expired yet" }, { status: 400 });
    }
  }

  const pickCount = (db.prepare("SELECT COUNT(*) as cnt FROM draft_picks WHERE league_id = ?").get(id) as { cnt: number }).cnt;
  const info = getSnakeDraftInfo(league, pickCount);

  if (info.completed) {
    return NextResponse.json({ error: "Draft is complete" }, { status: 400 });
  }

  // Find the top available rider (first rider not yet drafted, ordered by id)
  const topRider = db.prepare(`
    SELECT r.id FROM riders r
    WHERE r.id NOT IN (SELECT rider_id FROM draft_picks WHERE league_id = ?)
    ORDER BY r.id ASC
    LIMIT 1
  `).get(id) as { id: number } | undefined;

  if (!topRider) {
    return NextResponse.json({ error: "No riders available" }, { status: 400 });
  }

  const currentUserId = info.currentUserId!;

  // Make the auto-pick
  db.prepare(
    "INSERT INTO draft_picks (league_id, pick_number, round, user_id, rider_id) VALUES (?, ?, ?, ?, ?)"
  ).run(id, info.pickNumber, info.round, currentUserId, topRider.id);

  db.prepare(
    "INSERT OR IGNORE INTO league_rosters (league_id, user_id, rider_id) VALUES (?, ?, ?)"
  ).run(id, currentUserId, topRider.id);

  // Add user to auto-pick list (10s timer until they manually pick)
  const currentAutoUsers: number[] = JSON.parse(league.draft_auto_users || "[]");
  if (!currentAutoUsers.includes(currentUserId)) {
    currentAutoUsers.push(currentUserId);
    db.prepare("UPDATE leagues SET draft_auto_users = ? WHERE id = ?").run(JSON.stringify(currentAutoUsers), id);
  }

  // Reset pick timer
  db.prepare("UPDATE leagues SET last_pick_at = datetime('now') WHERE id = ?").run(id);

  // Check if draft is now complete
  const newPickCount = pickCount + 1;
  const newInfo = getSnakeDraftInfo(league, newPickCount);
  if (newInfo.completed) {
    db.prepare("UPDATE leagues SET draft_status = 'completed' WHERE id = ?").run(id);
  }

  return NextResponse.json({ success: true, auto_pick: true, completed: newInfo.completed });
}
