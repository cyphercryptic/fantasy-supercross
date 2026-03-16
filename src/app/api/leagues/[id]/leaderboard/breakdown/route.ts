import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/leagues/[id]/leaderboard/breakdown?userId=X — rider-level scoring breakdown
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const targetUserId = req.nextUrl.searchParams.get("userId");
  if (!targetUserId) {
    return NextResponse.json({ error: "userId query param required" }, { status: 400 });
  }

  // Verify target user is also a member of this league
  const targetMember = db.prepare("SELECT id FROM league_members WHERE league_id = ? AND user_id = ?").get(id, targetUserId);
  if (!targetMember) {
    return NextResponse.json({ error: "Target user is not a member of this league" }, { status: 404 });
  }

  // Get all riders on the target user's roster in this league
  const rosterRiders = db.prepare(`
    SELECT lr.rider_id, r.name, r.number, r.class, r.team
    FROM league_rosters lr
    JOIN riders r ON r.id = lr.rider_id
    WHERE lr.league_id = ? AND lr.user_id = ?
    ORDER BY r.class, r.name
  `).all(id, targetUserId) as {
    rider_id: number;
    name: string;
    number: number | null;
    class: string;
    team: string | null;
  }[];

  // Get all completed races
  const completedRaces = db.prepare(
    "SELECT id, name, round_number FROM races WHERE status = 'completed' ORDER BY round_number ASC"
  ).all() as { id: number; name: string; round_number: number }[];

  // Build breakdown for each rider
  const breakdown = rosterRiders.map((rider) => {
    let totalPoints = 0;

    const races = completedRaces.map((race) => {
      // Check if rider was in the user's lineup for this race
      const inLineup = db.prepare(
        "SELECT id FROM weekly_lineups WHERE league_id = ? AND user_id = ? AND race_id = ? AND rider_id = ?"
      ).get(id, targetUserId, race.id, rider.rider_id);

      if (!inLineup) {
        return {
          race_id: race.id,
          race_name: race.name,
          round_number: race.round_number,
          position: null,
          points: 0,
          bonus_points: 0,
          in_lineup: false,
        };
      }

      // Get race result for this rider
      const result = db.prepare(
        "SELECT position, points FROM race_results WHERE race_id = ? AND rider_id = ?"
      ).get(race.id, rider.rider_id) as { position: number | null; points: number } | undefined;

      // Get bonus points for this rider in this race
      const bonus = db.prepare(
        "SELECT COALESCE(SUM(points), 0) as bonus_points FROM race_bonuses WHERE race_id = ? AND rider_id = ?"
      ).get(race.id, rider.rider_id) as { bonus_points: number };

      const positionPoints = result?.points ?? 0;
      const bonusPoints = bonus.bonus_points;
      totalPoints += positionPoints + bonusPoints;

      return {
        race_id: race.id,
        race_name: race.name,
        round_number: race.round_number,
        position: result?.position ?? null,
        points: positionPoints,
        bonus_points: bonusPoints,
        in_lineup: true,
      };
    });

    return {
      rider_id: rider.rider_id,
      name: rider.name,
      number: rider.number,
      class: rider.class,
      team: rider.team,
      total_points: totalPoints,
      races,
    };
  });

  // Sort by total points descending so highest scorers are first
  breakdown.sort((a, b) => b.total_points - a.total_points);

  return NextResponse.json(breakdown);
}
