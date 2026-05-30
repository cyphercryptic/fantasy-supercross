import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/leagues/[id]/rider-stats — stats for all riders (used by team + free-agents pages)
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

  // Scope stats to this league's series so an MX team doesn't show SX-season
  // points (and vice versa).
  const { data: league } = await supabase
    .from("leagues")
    .select("series")
    .eq("id", id)
    .single();
  const series = (league?.series as string) || "sx";

  // Fetch in parallel: race metadata (this series only), results, bonuses
  const [racesRes, resultsRes, bonusesRes] = await Promise.all([
    supabase.from("races").select("id, round_number, name").eq("series", series),
    supabase.from("race_results").select("rider_id, race_id, position, points"),
    supabase.from("race_bonuses").select("rider_id, race_id, points"),
  ]);

  const races = racesRes.data || [];
  // Only count results/bonuses from races in this series.
  const seriesRaceIds = new Set(races.map((r) => r.id));
  const allResults = (resultsRes.data || []).filter((r) => seriesRaceIds.has(r.race_id));
  const allBonuses = (bonusesRes.data || []).filter((b) => seriesRaceIds.has(b.race_id));

  // Build race lookup map
  const raceMap = new Map<number, { round_number: number; name: string }>();
  for (const r of races) {
    raceMap.set(r.id, { round_number: r.round_number, name: r.name });
  }

  // Aggregate per rider
  const statsMap = new Map<number, {
    racesRaced: number;
    totalPositionPoints: number;
    totalBonus: number;
    positionSum: number;
    recent: { round: number; raceName: string; position: number; points: number }[];
  }>();

  function getOrInit(riderId: number) {
    let s = statsMap.get(riderId);
    if (!s) {
      s = { racesRaced: 0, totalPositionPoints: 0, totalBonus: 0, positionSum: 0, recent: [] };
      statsMap.set(riderId, s);
    }
    return s;
  }

  // Group results per rider
  const resultsByRider = new Map<number, typeof allResults>();
  for (const r of allResults) {
    const arr = resultsByRider.get(r.rider_id) || [];
    arr.push(r);
    resultsByRider.set(r.rider_id, arr);
  }

  for (const [riderId, results] of resultsByRider) {
    const stat = getOrInit(riderId);
    stat.racesRaced = results.length;
    let positionSum = 0;
    let totalPoints = 0;
    for (const r of results) {
      positionSum += r.position || 0;
      totalPoints += r.points;
    }
    stat.positionSum = positionSum;
    stat.totalPositionPoints = totalPoints;

    // Build recent (top 5 most recent rounds)
    const sorted = [...results].sort((a, b) => {
      const aRound = raceMap.get(a.race_id)?.round_number || 0;
      const bRound = raceMap.get(b.race_id)?.round_number || 0;
      return bRound - aRound;
    });
    stat.recent = sorted.slice(0, 5).map((r) => {
      const race = raceMap.get(r.race_id);
      return {
        round: race?.round_number || 0,
        raceName: race?.name || "",
        position: r.position,
        points: r.points,
      };
    });
  }

  // Apply bonuses
  for (const b of allBonuses) {
    const stat = statsMap.get(b.rider_id);
    if (stat) stat.totalBonus += b.points;
  }

  // Build response (only riders with results)
  const result: Record<number, {
    avgFinish: number;
    totalPoints: number;
    totalBonus: number;
    racesRaced: number;
    recent: { round: number; raceName: string; position: number; points: number }[];
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

  // Cache for 60 seconds — stats don't change between races
  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
