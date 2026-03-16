import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

// GET /api/leagues/[id] — league details
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;

  const { data: league } = await supabase
    .from("leagues")
    .select("*")
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
