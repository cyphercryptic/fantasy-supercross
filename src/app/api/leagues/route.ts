import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

const MAX_LEAGUES = 5;

// GET /api/leagues — list current user's leagues
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const db = getDb();
  const search = req.nextUrl.searchParams.get("search");

  if (search) {
    const leagues = db.prepare(`
      SELECT l.id, l.name, l.max_members, l.draft_status, l.created_at,
        (SELECT COUNT(*) FROM league_members WHERE league_id = l.id) as member_count
      FROM leagues l
      WHERE l.name LIKE ?
      ORDER BY l.name ASC
      LIMIT 20
    `).all(`%${search}%`);
    return NextResponse.json(leagues);
  }

  const leagues = db.prepare(`
    SELECT l.*, lm.joined_at, lm.team_name, lm.team_logo,
      (SELECT COUNT(*) FROM league_members WHERE league_id = l.id) as member_count,
      (l.commissioner_id = ?) as is_commissioner
    FROM leagues l
    JOIN league_members lm ON lm.league_id = l.id
    WHERE lm.user_id = ?
    ORDER BY lm.joined_at DESC
  `).all(user.id, user.id);

  return NextResponse.json(leagues);
}

// POST /api/leagues — create, join, start draft
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const body = await req.json();
  const db = getDb();

  // Check league limit
  const userLeagueCount = db.prepare(
    "SELECT COUNT(*) as cnt FROM league_members WHERE user_id = ?"
  ).get(user.id) as { cnt: number };

  if (body.action === "create") {
    if (userLeagueCount.cnt >= MAX_LEAGUES) {
      return NextResponse.json({ error: `You can only be in ${MAX_LEAGUES} leagues` }, { status: 400 });
    }

    const { name, password, max_members, roster_size, lineup_450, lineup_250e, lineup_250w } = body;
    if (!name || !password) {
      return NextResponse.json({ error: "Name and password are required" }, { status: 400 });
    }

    const mm = Math.max(2, Math.min(20, max_members || 4));
    const rs = Math.max(1, Math.min(30, roster_size || 8));
    const l450 = Math.max(1, Math.min(10, lineup_450 || 3));
    const l250e = Math.max(1, Math.min(10, lineup_250e || 2));
    const l250w = Math.max(1, Math.min(10, lineup_250w || 2));

    if (rs < l450 + l250e + l250w) {
      return NextResponse.json({ error: "Roster size must be at least the total lineup slots" }, { status: 400 });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const inviteCode = uuidv4().slice(0, 8).toUpperCase();

    const result = db.prepare(`
      INSERT INTO leagues (name, password_hash, invite_code, commissioner_id, max_members, roster_size, lineup_450, lineup_250e, lineup_250w)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, passwordHash, inviteCode, user.id, mm, rs, l450, l250e, l250w);

    const leagueId = result.lastInsertRowid;
    db.prepare("INSERT INTO league_members (league_id, user_id) VALUES (?, ?)").run(leagueId, user.id);

    return NextResponse.json({ success: true, id: leagueId, invite_code: inviteCode });
  }

  if (body.action === "join" || body.action === "join_by_name") {
    if (userLeagueCount.cnt >= MAX_LEAGUES) {
      return NextResponse.json({ error: `You can only be in ${MAX_LEAGUES} leagues` }, { status: 400 });
    }

    let leagueId: number;

    if (body.action === "join") {
      const league = db.prepare("SELECT id FROM leagues WHERE invite_code = ?").get(body.inviteCode) as { id: number } | undefined;
      if (!league) return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
      leagueId = league.id;
    } else {
      const league = db.prepare("SELECT * FROM leagues WHERE id = ?").get(body.leagueId) as { id: number; password_hash: string } | undefined;
      if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
      if (!bcrypt.compareSync(body.password, league.password_hash)) {
        return NextResponse.json({ error: "Wrong password" }, { status: 403 });
      }
      leagueId = league.id;
    }

    const existing = db.prepare("SELECT id FROM league_members WHERE league_id = ? AND user_id = ?").get(leagueId, user.id);
    if (existing) return NextResponse.json({ error: "Already a member" }, { status: 400 });

    // Check if league is full
    const league = db.prepare("SELECT max_members, draft_status FROM leagues WHERE id = ?").get(leagueId) as { max_members: number; draft_status: string };
    const currentMembers = db.prepare("SELECT COUNT(*) as cnt FROM league_members WHERE league_id = ?").get(leagueId) as { cnt: number };

    if (currentMembers.cnt >= league.max_members) {
      return NextResponse.json({ error: "League is full" }, { status: 400 });
    }
    if (league.draft_status !== "waiting") {
      return NextResponse.json({ error: "Draft has already started — cannot join" }, { status: 400 });
    }

    db.prepare("INSERT INTO league_members (league_id, user_id) VALUES (?, ?)").run(leagueId, user.id);
    return NextResponse.json({ success: true, id: leagueId });
  }

  if (body.action === "start_draft") {
    const { leagueId } = body;
    const league = db.prepare("SELECT * FROM leagues WHERE id = ?").get(leagueId) as {
      id: number; commissioner_id: number; max_members: number; draft_status: string; roster_size: number;
    } | undefined;

    if (!league || league.commissioner_id !== user.id) {
      return NextResponse.json({ error: "Commissioner access required" }, { status: 403 });
    }
    if (league.draft_status !== "waiting") {
      return NextResponse.json({ error: "Draft already started" }, { status: 400 });
    }

    const members = db.prepare("SELECT user_id FROM league_members WHERE league_id = ?").all(leagueId) as { user_id: number }[];
    if (members.length < league.max_members) {
      return NextResponse.json({ error: `Waiting for ${league.max_members - members.length} more member(s) to join` }, { status: 400 });
    }

    // Randomize draft order
    const userIds = members.map((m) => m.user_id);
    for (let i = userIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [userIds[i], userIds[j]] = [userIds[j], userIds[i]];
    }

    db.prepare("UPDATE leagues SET draft_status = 'drafting', draft_order = ?, last_pick_at = datetime('now') WHERE id = ?")
      .run(JSON.stringify(userIds), leagueId);

    return NextResponse.json({ success: true, draft_order: userIds });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
