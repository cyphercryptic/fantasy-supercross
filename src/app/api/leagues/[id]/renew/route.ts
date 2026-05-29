import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

// POST /api/leagues/[id]/renew
// Archives the current league and creates a fresh one for the next season.
// Same members, same settings (adjustable), new draft, new series.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const { id } = await params;
  const leagueId = parseInt(id);

  const { data: league } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .maybeSingle();

  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
  if (league.commissioner_id !== user.id) return NextResponse.json({ error: "Commissioner access required" }, { status: 403 });
  if (league.draft_status !== "completed") return NextResponse.json({ error: "Can only renew a league that has completed its draft" }, { status: 400 });
  if (league.archived_at) return NextResponse.json({ error: "League is already archived" }, { status: 400 });

  const body = await req.json();
  const newSeries: string = body.series ?? "mx";
  const newSeasonYear: number = body.season_year ?? new Date().getFullYear();
  const lineup450: number = body.lineup_450 ?? league.lineup_450;
  // For MX/SMX, caller sends lineup_250 (no E/W split) → stored in lineup_250e, lineup_250w = 0
  const lineup250e: number = body.lineup_250e ?? (body.lineup_250 ?? league.lineup_250e);
  const lineup250w: number = body.lineup_250w ?? (newSeries === "sx" ? league.lineup_250w : 0);

  // Ensure a franchise group exists so both seasons are linked
  let groupId: number = league.group_id;
  if (!groupId) {
    const { data: newGroup } = await supabase
      .from("league_groups")
      .insert({ name: league.name, created_by: user.id })
      .select("id")
      .single();
    groupId = newGroup!.id;
  }

  // Archive the old league and link it to the franchise
  await supabase
    .from("leagues")
    .update({
      archived_at: new Date().toISOString(),
      group_id: groupId,
      season_year: league.season_year ?? newSeasonYear,
    })
    .eq("id", leagueId);

  // Copy all current members
  const { data: members } = await supabase
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId);

  // Create the new season league
  const newInviteCode = uuidv4().slice(0, 8).toUpperCase();
  const { data: newLeague } = await supabase
    .from("leagues")
    .insert({
      name: league.name,
      password_hash: league.password_hash,
      invite_code: newInviteCode,
      commissioner_id: user.id,
      max_members: league.max_members,
      roster_size: league.roster_size,
      lineup_450: lineup450,
      lineup_250e: lineup250e,
      lineup_250w: lineup250w,
      series: newSeries,
      season_year: newSeasonYear,
      group_id: groupId,
      draft_status: "waiting",
    })
    .select("id")
    .single();

  const newLeagueId = newLeague!.id;

  // Add all old members to the new league
  if (members && members.length > 0) {
    await supabase
      .from("league_members")
      .insert(members.map((m) => ({ league_id: newLeagueId, user_id: m.user_id })));
  }

  return NextResponse.json({ success: true, id: newLeagueId });
}
