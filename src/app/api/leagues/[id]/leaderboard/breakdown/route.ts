import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/leagues/[id]/leaderboard/breakdown?userId=X — rider-level scoring breakdown
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const targetUserId = req.nextUrl.searchParams.get("userId");
  if (!targetUserId) {
    return NextResponse.json({ error: "userId query param required" }, { status: 400 });
  }

  const { data: targetMember } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", id)
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (!targetMember) {
    return NextResponse.json({ error: "Target user is not a member of this league" }, { status: 404 });
  }

  // Get all riders on the target user's roster
  const { data: rosterEntries } = await supabase
    .from("league_rosters")
    .select("rider_id, riders(name, number, class, team)")
    .eq("league_id", id)
    .eq("user_id", targetUserId);

  const rosterRiders = (rosterEntries || []).map((e) => {
    const r = e.riders as unknown as { name: string; number: number | null; class: string; team: string | null } | null;
    return {
      rider_id: e.rider_id,
      name: r?.name ?? "",
      number: r?.number ?? null,
      class: r?.class ?? "450",
      team: r?.team ?? null,
    };
  });

  // Get all completed races
  const { data: completedRaces } = await supabase
    .from("races")
    .select("id, name, round_number")
    .eq("status", "completed")
    .order("round_number", { ascending: true });

  const races = completedRaces || [];
  const riderIds = rosterRiders.map((r) => r.rider_id);
  const raceIds = races.map((r) => r.id);

  // Bulk fetch lineups, results, and bonuses
  let lineupSet = new Set<string>();
  let resultMap = new Map<string, { position: number | null; points: number }>();
  let bonusMap = new Map<string, number>();

  if (riderIds.length > 0 && raceIds.length > 0) {
    const { data: lineups } = await supabase
      .from("weekly_lineups")
      .select("race_id, rider_id")
      .eq("league_id", id)
      .eq("user_id", targetUserId)
      .in("rider_id", riderIds)
      .in("race_id", raceIds);

    lineupSet = new Set((lineups || []).map((l) => `${l.race_id}-${l.rider_id}`));

    const { data: results } = await supabase
      .from("race_results")
      .select("race_id, rider_id, position, points")
      .in("rider_id", riderIds)
      .in("race_id", raceIds);

    for (const r of results || []) {
      resultMap.set(`${r.race_id}-${r.rider_id}`, { position: r.position, points: r.points });
    }

    const { data: bonuses } = await supabase
      .from("race_bonuses")
      .select("race_id, rider_id, points")
      .in("rider_id", riderIds)
      .in("race_id", raceIds);

    for (const b of bonuses || []) {
      const key = `${b.race_id}-${b.rider_id}`;
      bonusMap.set(key, (bonusMap.get(key) || 0) + b.points);
    }
  }

  // Build breakdown
  const breakdown = rosterRiders.map((rider) => {
    let totalPoints = 0;

    const raceBreakdown = races.map((race) => {
      const key = `${race.id}-${rider.rider_id}`;
      const inLineup = lineupSet.has(key);

      if (!inLineup) {
        return {
          race_id: race.id, race_name: race.name, round_number: race.round_number,
          position: null, points: 0, bonus_points: 0, in_lineup: false,
        };
      }

      const result = resultMap.get(key);
      const positionPoints = result?.points ?? 0;
      const bonusPoints = bonusMap.get(key) || 0;
      totalPoints += positionPoints + bonusPoints;

      return {
        race_id: race.id, race_name: race.name, round_number: race.round_number,
        position: result?.position ?? null, points: positionPoints, bonus_points: bonusPoints, in_lineup: true,
      };
    });

    return {
      rider_id: rider.rider_id, name: rider.name, number: rider.number,
      class: rider.class, team: rider.team, total_points: totalPoints, races: raceBreakdown,
    };
  });

  breakdown.sort((a, b) => b.total_points - a.total_points);

  return NextResponse.json(breakdown);
}
