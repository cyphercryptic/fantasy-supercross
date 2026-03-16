import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/leagues/[id]/rider-stats — stats for all riders on user's roster
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const member = db.prepare("SELECT id FROM league_members WHERE league_id = ? AND user_id = ?").get(id, user.id);
  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  // Get roster rider IDs
  const rosterRiders = db.prepare(
    "SELECT rider_id FROM league_rosters WHERE league_id = ? AND user_id = ?"
  ).all(id, user.id) as { rider_id: number }[];

  if (rosterRiders.length === 0) {
    return NextResponse.json({});
  }

  const riderIds = rosterRiders.map((r) => r.rider_id);
  const placeholders = riderIds.map(() => "?").join(",");

  // Aggregate stats per rider
  const stats = db.prepare(`
    SELECT
      rr.rider_id,
      COUNT(rr.id) as races_raced,
      ROUND(AVG(rr.position), 1) as avg_finish,
      SUM(rr.points) as total_points
    FROM race_results rr
    WHERE rr.rider_id IN (${placeholders})
    GROUP BY rr.rider_id
  `).all(...riderIds) as {
    rider_id: number;
    races_raced: number;
    avg_finish: number;
    total_points: number;
  }[];

  // Bonus points per rider
  const bonusStats = db.prepare(`
    SELECT rider_id, SUM(points) as total_bonus
    FROM race_bonuses
    WHERE rider_id IN (${placeholders})
    GROUP BY rider_id
  `).all(...riderIds) as { rider_id: number; total_bonus: number }[];

  const bonusMap = new Map(bonusStats.map((b) => [b.rider_id, b.total_bonus]));

  // Last 3 results per rider
  const recentResults = db.prepare(`
    SELECT rr.rider_id, rr.position, rr.points, r.round_number
    FROM race_results rr
    JOIN races r ON r.id = rr.race_id
    WHERE rr.rider_id IN (${placeholders})
    ORDER BY r.round_number DESC
  `).all(...riderIds) as {
    rider_id: number;
    position: number;
    points: number;
    round_number: number;
  }[];

  // Group recent results by rider, take last 3
  const recentByRider = new Map<number, typeof recentResults>();
  for (const r of recentResults) {
    const arr = recentByRider.get(r.rider_id) || [];
    if (arr.length < 3) arr.push(r);
    recentByRider.set(r.rider_id, arr);
  }

  // Build response
  const result: Record<number, {
    avgFinish: number;
    totalPoints: number;
    totalBonus: number;
    racesRaced: number;
    recent: { round: number; position: number; points: number }[];
  }> = {};

  for (const s of stats) {
    result[s.rider_id] = {
      avgFinish: s.avg_finish,
      totalPoints: s.total_points + (bonusMap.get(s.rider_id) || 0),
      totalBonus: bonusMap.get(s.rider_id) || 0,
      racesRaced: s.races_raced,
      recent: (recentByRider.get(s.rider_id) || []).map((r) => ({
        round: r.round_number,
        position: r.position,
        points: r.points,
      })),
    };
  }

  return NextResponse.json(result);
}
