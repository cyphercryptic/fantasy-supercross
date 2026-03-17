import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

const MAX_LEAGUES = 5;

// GET /api/leagues — list current user's leagues
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const search = req.nextUrl.searchParams.get("search");

  if (search) {
    const { data: leagues } = await supabase
      .from("leagues")
      .select("id, name, max_members, draft_status, created_at")
      .ilike("name", `%${search}%`)
      .order("name")
      .limit(20);

    if (leagues && leagues.length > 0) {
      const leagueIds = leagues.map((l) => l.id);
      const { data: members } = await supabase
        .from("league_members")
        .select("league_id")
        .in("league_id", leagueIds);

      const countMap = new Map<number, number>();
      for (const m of members || []) {
        countMap.set(m.league_id, (countMap.get(m.league_id) || 0) + 1);
      }

      return NextResponse.json(
        leagues.map((l) => ({ ...l, member_count: countMap.get(l.id) || 0 }))
      );
    }
    return NextResponse.json(leagues || []);
  }

  const { data: memberEntries } = await supabase
    .from("league_members")
    .select("league_id, joined_at, team_name, team_logo, leagues(*)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });

  if (!memberEntries || memberEntries.length === 0) {
    return NextResponse.json([]);
  }

  const leagueIds = memberEntries.map((m) => m.league_id);
  const { data: allMembers } = await supabase
    .from("league_members")
    .select("league_id")
    .in("league_id", leagueIds);

  const countMap = new Map<number, number>();
  for (const m of allMembers || []) {
    countMap.set(m.league_id, (countMap.get(m.league_id) || 0) + 1);
  }

  const leagues = memberEntries.map((m) => {
    const league = m.leagues as unknown as Record<string, unknown>;
    return {
      ...league,
      joined_at: m.joined_at,
      team_name: m.team_name,
      team_logo: m.team_logo,
      member_count: countMap.get(m.league_id) || 0,
      is_commissioner: (league.commissioner_id as number) === user.id ? 1 : 0,
    };
  });

  return NextResponse.json(leagues);
}

// POST /api/leagues — create, join, start draft
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const body = await req.json();

  const { count: userLeagueCount } = await supabase
    .from("league_members")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (body.action === "create") {
    if ((userLeagueCount || 0) >= MAX_LEAGUES) {
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

    const { data: newLeague } = await supabase
      .from("leagues")
      .insert({
        name, password_hash: passwordHash, invite_code: inviteCode, commissioner_id: user.id,
        max_members: mm, roster_size: rs, lineup_450: l450, lineup_250e: l250e, lineup_250w: l250w,
      })
      .select("id")
      .single();

    const leagueId = newLeague!.id;
    await supabase.from("league_members").insert({ league_id: leagueId, user_id: user.id });

    return NextResponse.json({ success: true, id: leagueId, invite_code: inviteCode });
  }

  if (body.action === "join" || body.action === "join_by_name") {
    if ((userLeagueCount || 0) >= MAX_LEAGUES) {
      return NextResponse.json({ error: `You can only be in ${MAX_LEAGUES} leagues` }, { status: 400 });
    }

    let leagueId: number;

    if (body.action === "join") {
      const { data: league } = await supabase
        .from("leagues")
        .select("id")
        .eq("invite_code", body.inviteCode)
        .maybeSingle();
      if (!league) return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
      leagueId = league.id;
    } else {
      const { data: league } = await supabase
        .from("leagues")
        .select("id, password_hash")
        .eq("id", body.leagueId)
        .maybeSingle();
      if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
      if (!bcrypt.compareSync(body.password, league.password_hash)) {
        return NextResponse.json({ error: "Wrong password" }, { status: 403 });
      }
      leagueId = league.id;
    }

    const { data: existing } = await supabase
      .from("league_members")
      .select("id")
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing) return NextResponse.json({ error: "Already a member" }, { status: 400 });

    const { data: league } = await supabase
      .from("leagues")
      .select("max_members, draft_status")
      .eq("id", leagueId)
      .single();

    const { count: currentMembers } = await supabase
      .from("league_members")
      .select("*", { count: "exact", head: true })
      .eq("league_id", leagueId);

    if ((currentMembers || 0) >= league!.max_members) {
      return NextResponse.json({ error: "League is full" }, { status: 400 });
    }
    if (league!.draft_status !== "waiting") {
      return NextResponse.json({ error: "Draft has already started — cannot join" }, { status: 400 });
    }

    await supabase.from("league_members").insert({ league_id: leagueId, user_id: user.id });
    return NextResponse.json({ success: true, id: leagueId });
  }

  if (body.action === "start_draft") {
    const { leagueId } = body;
    const { data: league } = await supabase
      .from("leagues")
      .select("id, commissioner_id, max_members, draft_status, roster_size")
      .eq("id", leagueId)
      .maybeSingle();

    if (!league || league.commissioner_id !== user.id) {
      return NextResponse.json({ error: "Commissioner access required" }, { status: 403 });
    }
    if (league.draft_status !== "waiting") {
      return NextResponse.json({ error: "Draft already started" }, { status: 400 });
    }

    const { data: members } = await supabase
      .from("league_members")
      .select("user_id")
      .eq("league_id", leagueId);

    if (!members || members.length < league.max_members) {
      return NextResponse.json({ error: `Waiting for ${league.max_members - (members?.length || 0)} more member(s) to join` }, { status: 400 });
    }

    const userIds = members.map((m) => m.user_id);
    for (let i = userIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [userIds[i], userIds[j]] = [userIds[j], userIds[i]];
    }

    await supabase
      .from("leagues")
      .update({ draft_status: "drafting", draft_order: userIds, last_pick_at: new Date().toISOString() })
      .eq("id", leagueId);

    return NextResponse.json({ success: true, draft_order: userIds });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
