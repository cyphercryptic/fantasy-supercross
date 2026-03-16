import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

// GET /api/leagues/[id]/roster — get user's roster for this league
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { data: entries } = await supabase
    .from("league_rosters")
    .select("riders(*)")
    .eq("league_id", id)
    .eq("user_id", user.id);

  const roster = (entries || []).map((e) => e.riders);
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

  const { data: member } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const { data: league } = await supabase
    .from("leagues")
    .select("roster_size")
    .eq("id", id)
    .single();

  const { count: currentCount } = await supabase
    .from("league_rosters")
    .select("*", { count: "exact", head: true })
    .eq("league_id", id)
    .eq("user_id", user.id);

  if ((currentCount || 0) >= league!.roster_size) {
    return NextResponse.json({ error: `Roster is full (${league!.roster_size} max)` }, { status: 400 });
  }

  const { data: rider } = await supabase
    .from("riders")
    .select("id")
    .eq("id", riderId)
    .maybeSingle();
  if (!rider) {
    return NextResponse.json({ error: "Rider not found" }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("league_rosters")
    .select("id")
    .eq("league_id", id)
    .eq("user_id", user.id)
    .eq("rider_id", riderId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "Already on your roster" }, { status: 400 });
  }

  await supabase.from("league_rosters").insert({ league_id: Number(id), user_id: user.id, rider_id: riderId });
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

  await supabase
    .from("league_rosters")
    .delete()
    .eq("league_id", id)
    .eq("user_id", user.id)
    .eq("rider_id", riderId);

  // Also remove from upcoming lineups
  const { data: upcomingRaces } = await supabase
    .from("races")
    .select("id")
    .eq("status", "upcoming");
  const upcomingIds = (upcomingRaces || []).map((r) => r.id);

  if (upcomingIds.length > 0) {
    await supabase
      .from("weekly_lineups")
      .delete()
      .eq("league_id", id)
      .eq("user_id", user.id)
      .eq("rider_id", riderId)
      .in("race_id", upcomingIds);
  }

  return NextResponse.json({ success: true });
}
