import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/groups — list franchises the current user belongs to
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const { data: memberships } = await supabase
    .from("league_members")
    .select("league_id")
    .eq("user_id", user.id);

  if (!memberships?.length) return NextResponse.json([]);

  const leagueIds = memberships.map((m) => m.league_id);

  const { data: leagues } = await supabase
    .from("leagues")
    .select("group_id")
    .in("id", leagueIds)
    .not("group_id", "is", null);

  const groupIds = [...new Set((leagues || []).map((l) => l.group_id).filter(Boolean))];
  if (!groupIds.length) return NextResponse.json([]);

  const { data: groups } = await supabase
    .from("league_groups")
    .select("id, name, created_at")
    .in("id", groupIds)
    .order("created_at", { ascending: false });

  return NextResponse.json(groups || []);
}

// POST /api/groups — create a new franchise
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const { data: group, error } = await supabase
    .from("league_groups")
    .insert({ name: name.trim(), created_by: user.id })
    .select("id, name")
    .single();

  if (error) return NextResponse.json({ error: "Failed to create franchise" }, { status: 500 });

  return NextResponse.json(group);
}
