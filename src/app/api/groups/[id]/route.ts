import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/groups/[id] — franchise details with all linked season-leagues
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const { id } = await params;
  const groupId = parseInt(id);
  if (isNaN(groupId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { data: group } = await supabase
    .from("league_groups")
    .select("id, name, created_by, created_at")
    .eq("id", groupId)
    .maybeSingle();

  if (!group) return NextResponse.json({ error: "Franchise not found" }, { status: 404 });

  const { data: leagues } = await supabase
    .from("leagues")
    .select("id, name, series, season_year, draft_status, max_members, commissioner_id, created_at")
    .eq("group_id", groupId)
    .order("season_year", { ascending: false });

  const leagueIds = (leagues || []).map((l) => l.id);

  // Verify access — user must be in at least one league in this franchise, or be the creator
  if (leagueIds.length > 0) {
    const { data: membership } = await supabase
      .from("league_members")
      .select("id")
      .in("league_id", leagueIds)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!membership && group.created_by !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
  } else if (group.created_by !== user.id) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const memberCounts = new Map<number, number>();
  if (leagueIds.length > 0) {
    const { data: members } = await supabase
      .from("league_members")
      .select("league_id")
      .in("league_id", leagueIds);
    for (const m of members || []) {
      memberCounts.set(m.league_id, (memberCounts.get(m.league_id) || 0) + 1);
    }
  }

  return NextResponse.json({
    ...group,
    leagues: (leagues || []).map((l) => ({
      ...l,
      member_count: memberCounts.get(l.id) || 0,
    })),
  });
}
