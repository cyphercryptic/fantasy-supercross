import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/leagues/[id]/season-recap — full-season awards & superlatives for a league
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

  const { data: leagueRow } = await supabase.from("leagues").select("series").eq("id", id).single();
  const series = (leagueRow?.series as string) || "sx";

  // League members
  const { data: rawMembers } = await supabase
    .from("league_members")
    .select("user_id, team_name, team_logo, app_users(username)")
    .eq("league_id", id);

  type MemberRow = { user_id: number; team_name: string | null; team_logo: string | null; app_users: { username: string } | null };
  const members = (rawMembers || []) as unknown as MemberRow[];

  // All completed races in this league's series
  const { data: races } = await supabase
    .from("races")
    .select("id, name, round_number, date, status")
    .eq("status", "completed")
    .eq("series", series)
    .order("round_number", { ascending: true });

  if (!races || races.length === 0) {
    return NextResponse.json({ error: "No completed races yet" }, { status: 404 });
  }

  // All weekly lineups for the league
  const { data: lineups } = await supabase
    .from("weekly_lineups")
    .select("user_id, race_id, rider_id")
    .eq("league_id", id);

  // All draft picks
  const { data: draftPicks } = await supabase
    .from("draft_picks")
    .select("user_id, rider_id, pick_number, round")
    .eq("league_id", id)
    .order("pick_number", { ascending: true });

  // All race results + bonuses (we score every rider, since some awards span all rostered riders)
  const { data: allResults } = await supabase
    .from("race_results")
    .select("race_id, rider_id, points, position");
  const { data: allBonuses } = await supabase
    .from("race_bonuses")
    .select("race_id, rider_id, points, bonus_type");

  // All riders (for name/team/class lookup)
  const { data: allRiders } = await supabase
    .from("riders")
    .select("id, name, number, team, class");
  type Rider = { id: number; name: string; number: number | null; team: string | null; class: string };
  const riderById = new Map<number, Rider>();
  for (const r of allRiders || []) riderById.set(r.id, r as Rider);

  // For non-SX series, riders.class is the stale SX class — override with the
  // per-series class so 450/250 buckets and labels are correct.
  if (series !== "sx") {
    const { data: rs } = await supabase.from("rider_series").select("rider_id, class").eq("series", series);
    for (const x of rs || []) {
      const r = riderById.get(x.rider_id);
      if (r) r.class = x.class as string;
    }
  }

  // Roster (full season-ending roster per user)
  const { data: rosterEntries } = await supabase
    .from("league_rosters")
    .select("user_id, rider_id")
    .eq("league_id", id);

  // === Build lookup maps ===
  const resultByRace = new Map<string, { points: number; position: number | null }>();
  for (const r of allResults || []) {
    resultByRace.set(`${r.race_id}-${r.rider_id}`, { points: r.points, position: r.position });
  }
  const bonusByRace = new Map<string, number>();
  for (const b of allBonuses || []) {
    const key = `${b.race_id}-${b.rider_id}`;
    bonusByRace.set(key, (bonusByRace.get(key) || 0) + b.points);
  }

  // Per-rider season totals
  type RiderSeason = {
    rider_id: number;
    name: string;
    number: number | null;
    team: string | null;
    class: string;
    total_points: number;
    bonus_points: number;
    races_raced: number;
    avg_finish: number;
    podiums: number;
    wins: number;
  };
  const riderSeason = new Map<number, RiderSeason>();
  function getRiderSeason(rid: number): RiderSeason {
    let rs = riderSeason.get(rid);
    if (!rs) {
      const info = riderById.get(rid);
      rs = {
        rider_id: rid,
        name: info?.name || "Unknown",
        number: info?.number || null,
        team: info?.team || null,
        class: info?.class || "?",
        total_points: 0,
        bonus_points: 0,
        races_raced: 0,
        avg_finish: 0,
        podiums: 0,
        wins: 0,
      };
      riderSeason.set(rid, rs);
    }
    return rs;
  }
  // Aggregate finishing data per rider
  const riderPositions = new Map<number, number[]>();
  for (const r of allResults || []) {
    const rs = getRiderSeason(r.rider_id);
    rs.total_points += r.points;
    rs.races_raced++;
    if (r.position != null) {
      const arr = riderPositions.get(r.rider_id) || [];
      arr.push(r.position);
      riderPositions.set(r.rider_id, arr);
      if (r.position === 1) rs.wins++;
      if (r.position <= 3) rs.podiums++;
    }
  }
  for (const b of allBonuses || []) {
    const rs = getRiderSeason(b.rider_id);
    rs.bonus_points += b.points;
    rs.total_points += b.points;
  }
  for (const [rid, positions] of riderPositions) {
    const rs = getRiderSeason(rid);
    if (positions.length > 0) {
      rs.avg_finish = Math.round((positions.reduce((s, p) => s + p, 0) / positions.length) * 10) / 10;
    }
  }

  // === Per-user breakdown ===
  type WeekScore = { race_id: number; race_name: string; round_number: number; points: number };
  type UserStats = {
    user_id: number;
    username: string;
    team_name: string | null;
    team_logo: string | null;
    total_points: number;
    avg_per_race: number;
    best_week: WeekScore | null;
    worst_week: WeekScore | null;
    weekly: WeekScore[];
    most_used_riders: { rider_id: number; name: string; number: number | null; class: string; uses: number; total_contribution: number }[];
    best_pick: { rider_id: number; name: string; number: number | null; round: number; pick_number: number; total_points: number } | null;
    worst_pick: { rider_id: number; name: string; number: number | null; round: number; pick_number: number; total_points: number } | null;
  };

  const userStats: UserStats[] = members.map((m) => {
    const userLineups = (lineups || []).filter((l) => l.user_id === m.user_id);
    const userDraft = (draftPicks || []).filter((p) => p.user_id === m.user_id);

    // Weekly scores
    const byRace = new Map<number, number>();
    for (const l of userLineups) {
      const r = resultByRace.get(`${l.race_id}-${l.rider_id}`);
      const bonus = bonusByRace.get(`${l.race_id}-${l.rider_id}`) || 0;
      const pts = (r?.points || 0) + bonus;
      byRace.set(l.race_id, (byRace.get(l.race_id) || 0) + pts);
    }
    const weekly: WeekScore[] = (races || [])
      .filter((race) => byRace.has(race.id))
      .map((race) => ({
        race_id: race.id,
        race_name: race.name,
        round_number: race.round_number || 0,
        points: byRace.get(race.id) || 0,
      }));

    let bestWeek: WeekScore | null = null;
    let worstWeek: WeekScore | null = null;
    for (const w of weekly) {
      if (!bestWeek || w.points > bestWeek.points) bestWeek = w;
      if (!worstWeek || w.points < worstWeek.points) worstWeek = w;
    }

    const totalPoints = weekly.reduce((s, w) => s + w.points, 0);
    const racesPlayed = weekly.filter((w) => w.points > 0).length || weekly.length;
    const avgPerRace = racesPlayed > 0 ? Math.round((totalPoints / racesPlayed) * 10) / 10 : 0;

    // Most-used riders (count appearances in lineup AND total points contributed)
    const usageMap = new Map<number, { uses: number; contribution: number }>();
    for (const l of userLineups) {
      const r = resultByRace.get(`${l.race_id}-${l.rider_id}`);
      const bonus = bonusByRace.get(`${l.race_id}-${l.rider_id}`) || 0;
      const pts = (r?.points || 0) + bonus;
      const cur = usageMap.get(l.rider_id) || { uses: 0, contribution: 0 };
      cur.uses += 1;
      cur.contribution += pts;
      usageMap.set(l.rider_id, cur);
    }
    const mostUsed = [...usageMap.entries()]
      .sort((a, b) => b[1].contribution - a[1].contribution)
      .slice(0, 5)
      .map(([rid, data]) => {
        const ri = riderById.get(rid);
        return {
          rider_id: rid,
          name: ri?.name || "Unknown",
          number: ri?.number || null,
          class: ri?.class || "?",
          uses: data.uses,
          total_contribution: data.contribution,
        };
      });

    // Best/worst draft pick — among this user's draft picks, judged by total season points
    let bestPick: UserStats["best_pick"] = null;
    let worstPick: UserStats["worst_pick"] = null;
    for (const p of userDraft) {
      const rs = riderSeason.get(p.rider_id);
      const pts = rs?.total_points || 0;
      const ri = riderById.get(p.rider_id);
      const entry = {
        rider_id: p.rider_id,
        name: ri?.name || "Unknown",
        number: ri?.number || null,
        round: p.round,
        pick_number: p.pick_number,
        total_points: pts,
      };
      // Best: high points relative to how late they were drafted (later round is better)
      // Use a simple "value" score: total_points * round (later rounds weighted higher)
      if (!bestPick || pts * p.round > bestPick.total_points * bestPick.round) {
        bestPick = entry;
      }
      // Worst: drafted early (low round number) but earned few points
      if (!worstPick || pts * p.round < worstPick.total_points * worstPick.round) {
        worstPick = entry;
      }
    }

    return {
      user_id: m.user_id,
      username: m.app_users?.username || "Unknown",
      team_name: m.team_name,
      team_logo: m.team_logo,
      total_points: totalPoints,
      avg_per_race: avgPerRace,
      best_week: bestWeek,
      worst_week: worstWeek,
      weekly,
      most_used_riders: mostUsed,
      best_pick: bestPick,
      worst_pick: worstPick,
    };
  });

  userStats.sort((a, b) => b.total_points - a.total_points);

  // === League-wide superlatives ===
  // Top scoring riders (overall)
  const seasonRiderArr = [...riderSeason.values()].filter((r) => r.races_raced > 0);
  seasonRiderArr.sort((a, b) => b.total_points - a.total_points);
  const top10Overall = seasonRiderArr.slice(0, 10);
  const top5_450 = seasonRiderArr.filter((r) => (r.class || "").includes("450")).slice(0, 5);
  const top5_250 = seasonRiderArr.filter((r) => !(r.class || "").includes("450")).slice(0, 5);

  // Most wins / podiums / holeshots
  const mostWins = [...seasonRiderArr].sort((a, b) => b.wins - a.wins).filter((r) => r.wins > 0).slice(0, 3);
  const mostPodiums = [...seasonRiderArr].sort((a, b) => b.podiums - a.podiums).filter((r) => r.podiums > 0).slice(0, 3);

  // Holeshot leader (count holeshot bonuses)
  const holeshotCounts = new Map<number, number>();
  for (const b of allBonuses || []) {
    if (b.bonus_type.startsWith("holeshot")) {
      holeshotCounts.set(b.rider_id, (holeshotCounts.get(b.rider_id) || 0) + 1);
    }
  }
  const holeshotLeaders = [...holeshotCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([rid, count]) => {
      const info = riderById.get(rid);
      return { rider_id: rid, name: info?.name || "Unknown", number: info?.number || null, team: info?.team || null, class: info?.class || "?", holeshots: count };
    });

  // === Awards ===
  // Only awards if there's enough data
  const allWeeklyScores = userStats.flatMap((u) => u.weekly.map((w) => ({ ...w, user_id: u.user_id, username: u.username })));
  const bestWeekOverall = allWeeklyScores.length > 0
    ? allWeeklyScores.reduce((best, cur) => (cur.points > best.points ? cur : best))
    : null;

  // Champion: highest total points
  const champion = userStats[0] || null;
  const runnerUp = userStats[1] || null;

  // Heartbreaker: smallest gap between champion and runner-up
  const championGap = champion && runnerUp ? champion.total_points - runnerUp.total_points : 0;

  return NextResponse.json({
    league_id: parseInt(id),
    races_completed: races.length,
    final_standings: userStats.map((u, i) => ({
      rank: i + 1,
      user_id: u.user_id,
      username: u.username,
      team_name: u.team_name,
      team_logo: u.team_logo,
      total_points: u.total_points,
      avg_per_race: u.avg_per_race,
    })),
    user_breakdowns: userStats,
    awards: {
      champion,
      runner_up: runnerUp,
      championship_gap: championGap,
      best_week_overall: bestWeekOverall,
    },
    league_riders: {
      top_overall: top10Overall,
      top_450: top5_450,
      top_250: top5_250,
      most_wins: mostWins,
      most_podiums: mostPodiums,
      holeshot_leaders: holeshotLeaders,
    },
    rosters_total: (rosterEntries || []).length,
  });
}
