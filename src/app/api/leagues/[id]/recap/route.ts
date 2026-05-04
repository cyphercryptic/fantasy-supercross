import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/leagues/[id]/recap?raceId=X — race recap with top finishers, bonuses, and user team scores
// If no raceId provided, returns the most recent completed race
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

  const raceIdParam = req.nextUrl.searchParams.get("raceId");

  // Get target race
  let race;
  if (raceIdParam) {
    const { data } = await supabase
      .from("races")
      .select("id, name, round_number, date, location, race_time, status")
      .eq("id", raceIdParam)
      .maybeSingle();
    race = data;
  } else {
    // Most recent completed race
    const { data } = await supabase
      .from("races")
      .select("id, name, round_number, date, location, race_time, status")
      .eq("status", "completed")
      .order("round_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    race = data;
  }

  if (!race) {
    return NextResponse.json({ error: "No completed race found" }, { status: 404 });
  }

  // Get all completed races (for prev/next navigation)
  const { data: allCompleted } = await supabase
    .from("races")
    .select("id, name, round_number")
    .eq("status", "completed")
    .order("round_number", { ascending: true });

  // Get race results with rider info (include rider id for ownership lookup)
  const { data: results } = await supabase
    .from("race_results")
    .select("position, points, riders(id, name, number, team, class)")
    .eq("race_id", race.id)
    .order("position");

  // Get bonuses with rider info — defined later, but we need to ensure rider ids are returned
  // (already in select)

  // Get bonuses with rider info
  const { data: bonuses } = await supabase
    .from("race_bonuses")
    .select("bonus_type, points, riders(id, name, number, team, class)")
    .eq("race_id", race.id);

  // Split results by class
  type RiderInfo = { id: number; name: string; number: number | null; team: string | null; class: string };
  type ResultRow = { position: number; points: number; riders: RiderInfo | null };
  type BonusRow = { bonus_type: string; points: number; riders: RiderInfo | null };

  const all = (results || []) as unknown as ResultRow[];
  const top450 = all.filter((r) => r.riders?.class === "450").slice(0, 10);
  const top250 = all.filter((r) => r.riders?.class !== "450").slice(0, 10);

  // Categorize bonuses
  const allBonuses = (bonuses || []) as unknown as BonusRow[];
  const heatWinners450 = allBonuses.filter((b) => b.bonus_type.startsWith("heat") && b.bonus_type.includes("450"));
  const heatWinners250 = allBonuses.filter((b) => b.bonus_type.startsWith("heat") && b.bonus_type.includes("250"));
  const lcq450 = allBonuses.find((b) => b.bonus_type === "lcq_450");
  const lcq250 = allBonuses.find((b) => b.bonus_type === "lcq_250");
  const holeshots450 = allBonuses.filter((b) => b.bonus_type.startsWith("holeshot_450"));
  const holeshots250 = allBonuses.filter((b) => b.bonus_type.startsWith("holeshot_250"));

  // Calculate user team scores for this race
  const { data: leagueMembers } = await supabase
    .from("league_members")
    .select("user_id, team_name, team_logo, app_users(username)")
    .eq("league_id", id);

  type MemberRow = { user_id: number; team_name: string | null; team_logo: string | null; app_users: { username: string } | null };
  const members = (leagueMembers || []) as unknown as MemberRow[];

  // Get every rostered rider and which user owns them (for highlighting in recap)
  const { data: rosterEntries } = await supabase
    .from("league_rosters")
    .select("user_id, rider_id")
    .eq("league_id", id);
  const riderToUser: Record<number, number> = {};
  for (const r of rosterEntries || []) {
    riderToUser[r.rider_id] = r.user_id;
  }

  const { data: lineups } = await supabase
    .from("weekly_lineups")
    .select("user_id, rider_id")
    .eq("league_id", id)
    .eq("race_id", race.id);

  // Build rider points lookup (results + bonuses)
  const riderPoints: Record<number, { name: string; number: number | null; class: string; resultPoints: number; bonusPoints: number; position: number | null }> = {};
  for (const r of all) {
    if (!r.riders) continue;
    if (!riderPoints[r.riders.id]) {
      riderPoints[r.riders.id] = {
        name: r.riders.name,
        number: r.riders.number,
        class: r.riders.class,
        resultPoints: 0,
        bonusPoints: 0,
        position: null,
      };
    }
    riderPoints[r.riders.id].resultPoints += r.points;
    riderPoints[r.riders.id].position = r.position;
  }
  for (const b of allBonuses) {
    if (!b.riders) continue;
    if (!riderPoints[b.riders.id]) {
      riderPoints[b.riders.id] = {
        name: b.riders.name,
        number: b.riders.number,
        class: b.riders.class,
        resultPoints: 0,
        bonusPoints: 0,
        position: null,
      };
    }
    riderPoints[b.riders.id].bonusPoints += b.points;
  }

  const userScores: {
    user_id: number;
    username: string;
    team_name: string | null;
    team_logo: string | null;
    total: number;
    riders: { name: string; number: number | null; class: string; position: number | null; points: number; bonusPoints: number }[];
  }[] = [];

  for (const m of members) {
    const userLineupRiderIds = (lineups || []).filter((l) => l.user_id === m.user_id).map((l) => l.rider_id);
    const userRiders = userLineupRiderIds
      .map((rid) => {
        const rp = riderPoints[rid];
        if (!rp) return null;
        return {
          name: rp.name,
          number: rp.number,
          class: rp.class,
          position: rp.position,
          points: rp.resultPoints,
          bonusPoints: rp.bonusPoints,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const total = userRiders.reduce((sum, r) => sum + r.points + r.bonusPoints, 0);

    userScores.push({
      user_id: m.user_id,
      username: m.app_users?.username || "Unknown",
      team_name: m.team_name,
      team_logo: m.team_logo,
      total,
      riders: userRiders.sort((a, b) => (b.points + b.bonusPoints) - (a.points + a.bonusPoints)),
    });
  }

  userScores.sort((a, b) => b.total - a.total);

  // Detect race format
  const heatCount = allBonuses.filter((b) => b.bonus_type.startsWith("heat")).length;
  const holeshotCount = allBonuses.filter((b) => b.bonus_type.startsWith("holeshot")).length;
  const isTripleCrown = holeshotCount >= 4; // 3+ holeshots usually means TC
  const has250E = all.some((r) => r.riders?.class === "250E");
  const has250W = all.some((r) => r.riders?.class === "250W");
  const isShowdown = has250E && has250W;
  let format: "triple_crown" | "showdown" | "regular" = "regular";
  if (isTripleCrown) format = "triple_crown";
  else if (isShowdown) format = "showdown";

  return NextResponse.json({
    race: {
      id: race.id,
      name: race.name,
      round_number: race.round_number,
      date: race.date,
      location: race.location,
      race_time: race.race_time,
      format,
    },
    navigation: (allCompleted || []).map((r) => ({ id: r.id, name: r.name, round_number: r.round_number })),
    top450: top450.map((r) => ({
      position: r.position,
      points: r.points,
      rider: r.riders ? { id: r.riders.id, name: r.riders.name, number: r.riders.number, team: r.riders.team, class: r.riders.class } : null,
    })),
    top250: top250.map((r) => ({
      position: r.position,
      points: r.points,
      rider: r.riders ? { id: r.riders.id, name: r.riders.name, number: r.riders.number, team: r.riders.team, class: r.riders.class } : null,
    })),
    bonuses: {
      heat_450: heatWinners450.map((b) => ({ type: b.bonus_type, rider: b.riders })),
      heat_250: heatWinners250.map((b) => ({ type: b.bonus_type, rider: b.riders })),
      lcq_450: lcq450?.riders || null,
      lcq_250: lcq250?.riders || null,
      holeshots_450: holeshots450.map((b) => b.riders),
      holeshots_250: holeshots250.map((b) => b.riders),
    },
    bonusSummary: { heatCount, holeshotCount },
    riderToUser, // map of rider_id → user_id (who has them on roster)
    userScores,
  });
}
