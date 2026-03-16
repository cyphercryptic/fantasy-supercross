import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

// GET /api/leagues/[id]/rider-stats — stats for all riders on user's roster
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

  // Get roster rider IDs
  const { data: rosterEntries } = await supabase
    .from("league_rosters")
    .select("rider_id")
    .eq("league_id", id)
    .eq("user_id", user.id);

  if (!rosterEntries || rosterEntries.length === 0) {
    return NextResponse.json({});
  }

  const riderIds = rosterEntries.map((r) => r.rider_id);

  // Get all race results for these riders
  const { data: allResults } = await supabase
    .from("race_results")
    .select("rider_id, position, points, races(round_number)")
    .in("rider_id", riderIds)
    .order("rider_id");

  // Get bonus stats
  const { data: allBonuses } = await supabase
    .from("race_bonuses")
    .select("rider_id, points")
    .in("rider_id", riderIds);

  // Aggregate stats per rider
  const statsMap = new Map<number, {
    racesRaced: number;
    totalPositionPoints: number;
    totalBonus: number;
    positionSum: number;
    recent: { round: number; position: number; points: number }[];
  }>();

  for (const riderId of riderIds) {
    statsMap.set(riderId, { racesRaced: 0, totalPositionPoints: 0, totalBonus: 0, positionSum: 0, recent: [] });
  }

  // Process results
  const resultsByRider = new Map<number, typeof allResults>();
  for (const r of allResults || []) {
    const arr = resultsByRider.get(r.rider_id) || [];
    arr.push(r);
    resultsByRider.set(r.rider_id, arr);
  }

  for (const [riderId, results] of resultsByRider) {
    if (!results) continue;
    const stat = statsMap.get(riderId)!;
    stat.racesRaced = results.length;
    stat.totalPositionPoints = results.reduce((sum, r) => sum + r.points, 0);
    stat.positionSum = results.reduce((sum, r) => sum + (r.position || 0), 0);

    // Recent results (sorted by round_number desc, take 3)
    const sorted = [...results].sort((a, b) => {
      const aRound = (a.races as unknown as unknown as Record<string, unknown>)?.round_number as number || 0;
      const bRound = (b.races as unknown as unknown as Record<string, unknown>)?.round_number as number || 0;
      return bRound - aRound;
    });
    stat.recent = sorted.slice(0, 3).map((r) => ({
      round: (r.races as unknown as unknown as Record<string, unknown>)?.round_number as number || 0,
      position: r.position,
      points: r.points,
    }));
  }

  // Process bonuses
  for (const b of allBonuses || []) {
    const stat = statsMap.get(b.rider_id);
    if (stat) stat.totalBonus += b.points;
  }

  // Build response
  const result: Record<number, {
    avgFinish: number;
    totalPoints: number;
    totalBonus: number;
    racesRaced: number;
    recent: { round: number; position: number; points: number }[];
  }> = {};

  for (const [riderId, stat] of statsMap) {
    if (stat.racesRaced > 0) {
      result[riderId] = {
        avgFinish: Math.round((stat.positionSum / stat.racesRaced) * 10) / 10,
        totalPoints: stat.totalPositionPoints + stat.totalBonus,
        totalBonus: stat.totalBonus,
        racesRaced: stat.racesRaced,
        recent: stat.recent,
      };
    }
  }

  return NextResponse.json(result);
}
