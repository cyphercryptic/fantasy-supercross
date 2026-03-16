import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/leagues/[id]/leaderboard — league standings
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

  // Find the most recently completed race
  const lastCompletedRace = db.prepare(
    "SELECT id FROM races WHERE status = 'completed' ORDER BY round_number DESC LIMIT 1"
  ).get() as { id: number } | undefined;

  // Total points: position points + bonus points for riders in the user's lineup
  const standings = db.prepare(`
    SELECT
      u.id,
      u.username,
      lm.team_name,
      COALESCE(
        (SELECT SUM(rr.points) FROM weekly_lineups wl2
         JOIN race_results rr ON rr.rider_id = wl2.rider_id AND rr.race_id = wl2.race_id
         WHERE wl2.league_id = lm.league_id AND wl2.user_id = lm.user_id), 0
      ) + COALESCE(
        (SELECT SUM(rb.points) FROM weekly_lineups wl3
         JOIN race_bonuses rb ON rb.rider_id = wl3.rider_id AND rb.race_id = wl3.race_id
         WHERE wl3.league_id = lm.league_id AND wl3.user_id = lm.user_id), 0
      ) as total_points,
      COUNT(DISTINCT wl.race_id) as races_played
    FROM league_members lm
    JOIN users u ON u.id = lm.user_id
    LEFT JOIN weekly_lineups wl ON wl.league_id = lm.league_id AND wl.user_id = lm.user_id
    WHERE lm.league_id = ?
    GROUP BY u.id
    ORDER BY total_points DESC
  `).all(id) as { id: number; username: string; team_name: string | null; total_points: number; races_played: number }[];

  // Last week's score for each user (position points + bonuses from last completed race)
  if (lastCompletedRace) {
    for (const s of standings) {
      const lastWeek = db.prepare(`
        SELECT COALESCE(SUM(rr.points), 0) as position_pts
        FROM weekly_lineups wl
        JOIN race_results rr ON rr.rider_id = wl.rider_id AND rr.race_id = wl.race_id
        WHERE wl.league_id = ? AND wl.user_id = ? AND wl.race_id = ?
      `).get(id, s.id, lastCompletedRace.id) as { position_pts: number };

      const lastWeekBonus = db.prepare(`
        SELECT COALESCE(SUM(rb.points), 0) as bonus_pts
        FROM weekly_lineups wl
        JOIN race_bonuses rb ON rb.rider_id = wl.rider_id AND rb.race_id = wl.race_id
        WHERE wl.league_id = ? AND wl.user_id = ? AND wl.race_id = ?
      `).get(id, s.id, lastCompletedRace.id) as { bonus_pts: number };

      (s as Record<string, unknown>).last_week_points = lastWeek.position_pts + lastWeekBonus.bonus_pts;
    }
  } else {
    for (const s of standings) {
      (s as Record<string, unknown>).last_week_points = 0;
    }
  }

  return NextResponse.json(standings);
}
