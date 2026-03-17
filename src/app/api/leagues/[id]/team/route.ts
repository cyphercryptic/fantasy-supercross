import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

// GET /api/leagues/[id]/team — get team info + starting lineup for upcoming race
// Optional ?userId=X to view another user's roster (read-only)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;

  // Verify the requesting user is a league member
  const { data: selfMember } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!selfMember) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  // Determine which user's team to view
  const viewUserId = req.nextUrl.searchParams.get("userId");
  const targetUserId = viewUserId ? parseInt(viewUserId) : user.id;
  const isViewingOther = targetUserId !== user.id;

  const { data: member } = await supabase
    .from("league_members")
    .select("team_name, team_logo")
    .eq("league_id", id)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "User not found in league" }, { status: 404 });
  }

  const { data: league } = await supabase
    .from("leagues")
    .select("id, name, lineup_450, lineup_250e, lineup_250w, draft_status")
    .eq("id", id)
    .single();

  // Get all league members for the selector dropdown
  const { data: allMembers } = await supabase
    .from("league_members")
    .select("user_id, team_name, app_users(username)")
    .eq("league_id", id);

  const members = (allMembers || []).map((m) => ({
    user_id: (m as Record<string, unknown>).user_id as number,
    team_name: (m as Record<string, unknown>).team_name as string | null,
    username: ((m as Record<string, unknown>).app_users as Record<string, unknown>)?.username as string || "Unknown",
  }));

  // Get upcoming race
  const { data: upcomingRace } = await supabase
    .from("races")
    .select("*")
    .eq("status", "upcoming")
    .order("round_number", { ascending: true })
    .limit(1)
    .maybeSingle();

  // Get lineup for upcoming race
  let lineup: Record<string, unknown>[] = [];
  if (upcomingRace) {
    const { data: lineupEntries } = await supabase
      .from("weekly_lineups")
      .select("riders(id, name, number, team, class)")
      .eq("league_id", id)
      .eq("user_id", targetUserId)
      .eq("race_id", upcomingRace.id);

    lineup = (lineupEntries || []).map((e) => e.riders as unknown as unknown as Record<string, unknown>);
  }

  // Get full roster
  const { data: rosterEntries } = await supabase
    .from("league_rosters")
    .select("riders(id, name, number, team, class)")
    .eq("league_id", id)
    .eq("user_id", targetUserId);

  const roster = (rosterEntries || []).map((e) => e.riders as unknown as unknown as Record<string, unknown>);

  return NextResponse.json({
    team_name: member.team_name,
    team_logo: member.team_logo,
    league,
    upcoming_race: upcomingRace || null,
    lineup,
    roster,
    members,
    viewing_user_id: targetUserId,
    is_own_team: !isViewingOther,
  });
}

// POST /api/leagues/[id]/team — update team name/logo
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;

  const { data: member } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const body = await req.json();

  if (body.team_name !== undefined) {
    const name = (body.team_name as string).trim().slice(0, 30);
    await supabase
      .from("league_members")
      .update({ team_name: name || null })
      .eq("league_id", id)
      .eq("user_id", user.id);
  }

  if (body.team_logo !== undefined) {
    const logoData = body.team_logo as string;
    await supabase
      .from("league_members")
      .update({ team_logo: logoData || null })
      .eq("league_id", id)
      .eq("user_id", user.id);
  }

  return NextResponse.json({ success: true });
}
