import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

// GET /api/leagues/[id]/leaderboard — league standings
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

  // Get all league members
  const { data: rawMembers } = await supabase
    .from("league_members")
    .select("user_id, team_name, app_users(id, username)")
    .eq("league_id", id);

  // Get all lineups for this league
  const { data: lineups } = await supabase
    .from("weekly_lineups")
    .select("user_id, race_id, rider_id")
    .eq("league_id", id);

  // Get race results and bonuses for relevant rider/race combos
  const riderIds = [...new Set((lineups || []).map((l) => l.rider_id))];
  const raceIds = [...new Set((lineups || []).map((l) => l.race_id))];

  let results: { race_id: number; rider_id: number; points: number }[] = [];
  let bonuses: { race_id: number; rider_id: number; points: number }[] = [];

  if (riderIds.length > 0 && raceIds.length > 0) {
    const { data: r } = await supabase
      .from("race_results")
      .select("race_id, rider_id, points")
      .in("rider_id", riderIds)
      .in("race_id", raceIds);
    results = r || [];

    const { data: b } = await supabase
      .from("race_bonuses")
      .select("race_id, rider_id, points")
      .in("rider_id", riderIds)
      .in("race_id", raceIds);
    bonuses = b || [];
  }

  // Build lookup maps
  const resultMap = new Map<string, number>();
  for (const r of results) {
    resultMap.set(`${r.race_id}-${r.rider_id}`, r.points);
  }
  const bonusMap = new Map<string, number>();
  for (const b of bonuses) {
    const key = `${b.race_id}-${b.rider_id}`;
    bonusMap.set(key, (bonusMap.get(key) || 0) + b.points);
  }

  // Find the most recently completed race
  const { data: lastCompletedRace } = await supabase
    .from("races")
    .select("id")
    .eq("status", "completed")
    .order("round_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Calculate standings
  const standings = (rawMembers || []).map((m) => {
    const userId = m.user_id;
    const userLineups = (lineups || []).filter((l) => l.user_id === userId);

    let totalPoints = 0;
    let lastWeekPoints = 0;
    const playedRaces = new Set<number>();

    for (const l of userLineups) {
      const pts = resultMap.get(`${l.race_id}-${l.rider_id}`) || 0;
      const bonus = bonusMap.get(`${l.race_id}-${l.rider_id}`) || 0;
      totalPoints += pts + bonus;
      if (pts > 0 || bonus > 0) playedRaces.add(l.race_id);

      if (lastCompletedRace && l.race_id === lastCompletedRace.id) {
        lastWeekPoints += pts + bonus;
      }
    }

    return {
      id: (m.app_users as unknown as unknown as Record<string, unknown>).id,
      username: (m.app_users as unknown as unknown as Record<string, unknown>).username,
      team_name: m.team_name,
      total_points: totalPoints,
      races_played: playedRaces.size,
      last_week_points: lastWeekPoints,
    };
  });

  standings.sort((a, b) => b.total_points - a.total_points);

  return NextResponse.json(standings);
}
