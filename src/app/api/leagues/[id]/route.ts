import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/leagues/[id] — league details
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;

  const { data: league } = await supabase
    .from("leagues")
    .select("*, league_groups(id, name)")
    .eq("id", id)
    .maybeSingle();
  if (!league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const { data: member } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const { data: rawMembers } = await supabase
    .from("league_members")
    .select("joined_at, app_users(id, username)")
    .eq("league_id", id)
    .order("joined_at", { ascending: true });

  const members = (rawMembers || []).map((m) => ({
    id: (m.app_users as unknown as unknown as Record<string, unknown>).id,
    username: (m.app_users as unknown as unknown as Record<string, unknown>).username,
    joined_at: m.joined_at,
  }));

  return NextResponse.json({
    ...league,
    is_commissioner: league.commissioner_id === user.id,
    members,
  });
}

// PATCH /api/leagues/[id] — edit league settings (commissioner only, before draft starts)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;

  const { data: league } = await supabase
    .from("leagues")
    .select("commissioner_id, draft_status, max_members")
    .eq("id", id)
    .maybeSingle();
  if (!league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }
  if (league.commissioner_id !== user.id) {
    return NextResponse.json({ error: "Commissioner access required" }, { status: 403 });
  }
  if (league.draft_status !== "waiting") {
    return NextResponse.json({ error: "Cannot edit settings after the draft has started" }, { status: 400 });
  }

  const body = await req.json();

  // Whitelist editable fields
  const update: Record<string, string | number> = {};
  if (typeof body.name === "string" && body.name.trim().length > 0) {
    update.name = body.name.trim().slice(0, 60);
  }
  if (typeof body.max_members === "number" && body.max_members >= 2 && body.max_members <= 20) {
    // Don't allow shrinking below current member count
    const { count } = await supabase
      .from("league_members")
      .select("*", { count: "exact", head: true })
      .eq("league_id", id);
    if ((count || 0) > body.max_members) {
      return NextResponse.json(
        { error: `Cannot set max members below current member count (${count})` },
        { status: 400 },
      );
    }
    update.max_members = body.max_members;
  }
  if (typeof body.roster_size === "number" && body.roster_size >= 8 && body.roster_size <= 40) {
    update.roster_size = body.roster_size;
  }
  if (typeof body.lineup_450 === "number" && body.lineup_450 >= 1 && body.lineup_450 <= 22) {
    update.lineup_450 = body.lineup_450;
  }
  if (typeof body.lineup_250e === "number" && body.lineup_250e >= 0 && body.lineup_250e <= 22) {
    update.lineup_250e = body.lineup_250e;
  }
  if (typeof body.lineup_250w === "number" && body.lineup_250w >= 0 && body.lineup_250w <= 22) {
    update.lineup_250w = body.lineup_250w;
  }
  if (typeof body.draft_pick_timer === "number" && body.draft_pick_timer >= 15 && body.draft_pick_timer <= 600) {
    update.draft_pick_timer = body.draft_pick_timer;
  }

  // Sanity: roster size must accommodate the lineup size
  const finalRosterSize = (update.roster_size as number) ?? null;
  const finalLineup =
    ((update.lineup_450 as number) ?? null) +
    ((update.lineup_250e as number) ?? null) +
    ((update.lineup_250w as number) ?? null);
  if (finalRosterSize != null && finalLineup > 0 && finalLineup > finalRosterSize) {
    return NextResponse.json(
      { error: `Roster size must be at least ${finalLineup} to fit the lineup composition` },
      { status: 400 },
    );
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { error } = await supabase.from("leagues").update(update).eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Update failed: " + error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, updated: Object.keys(update) });
}

// DELETE /api/leagues/[id] — delete league (commissioner only)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;

  const { data: league } = await supabase
    .from("leagues")
    .select("commissioner_id")
    .eq("id", id)
    .maybeSingle();
  if (!league || league.commissioner_id !== user.id) {
    return NextResponse.json({ error: "Commissioner access required" }, { status: 403 });
  }

  await supabase.from("leagues").delete().eq("id", id);
  return NextResponse.json({ success: true });
}
