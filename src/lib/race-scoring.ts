import { supabase } from "@/lib/supabase";

// Shared race matchup scoring used by both the Race Recap (completed races) and
// the Live tracker (in-progress races). Given a race, it computes head-to-head
// user team scores, top finishers, and bonus winners from race_results +
// race_bonuses + weekly_lineups. Because MX scoring is incremental (the importer
// re-aggregates each run), this returns correct partial standings mid-race too.

export interface MatchupRace {
  id: number;
  name: string;
  round_number: number | null;
  date: string | null;
  location: string | null;
  race_time: string | null;
  status: string;
}

export interface RiderInfo {
  id: number;
  name: string;
  number: number | null;
  team: string | null;
  class: string;
}

export interface MotoResult {
  moto: number;
  position: number;
  points: number;
}

export interface MatchupResult {
  top450: { position: number; points: number; motoResults: MotoResult[] | null; rider: RiderInfo | null }[];
  top250: { position: number; points: number; motoResults: MotoResult[] | null; rider: RiderInfo | null }[];
  bonuses: {
    heat_450: { type: string; rider: RiderInfo | null }[];
    heat_250: { type: string; rider: RiderInfo | null }[];
    lcq_450: RiderInfo | null;
    lcq_250: RiderInfo | null;
    holeshots_450: (RiderInfo | null)[];
    holeshots_250: (RiderInfo | null)[];
  };
  bonusSummary: { heatCount: number; holeshotCount: number };
  riderToUser: Record<number, number>;
  userScores: {
    user_id: number;
    username: string;
    team_name: string | null;
    team_logo: string | null;
    total: number;
    riders: { name: string; number: number | null; class: string; position: number | null; points: number; bonusPoints: number }[];
  }[];
  format: "triple_crown" | "showdown" | "regular";
  // Which classes have any results posted yet — drives the live "250 in / 450 pending" status.
  classStatus: { has450: boolean; has250: boolean };
}

// Compute the full head-to-head matchup payload for a single race.
export async function computeRaceMatchup(
  leagueId: string | number,
  race: MatchupRace,
  series: string
): Promise<MatchupResult> {
  const isMX = series !== "sx";

  // Get race results with rider info (include rider id for ownership lookup)
  const { data: results } = await supabase
    .from("race_results")
    .select("position, points, moto_results, riders(id, name, number, team, class)")
    .eq("race_id", race.id)
    .order("position");

  // Get bonuses with rider info
  const { data: bonuses } = await supabase
    .from("race_bonuses")
    .select("bonus_type, points, riders(id, name, number, team, class)")
    .eq("race_id", race.id);

  type ResultRow = { position: number; points: number; moto_results: MotoResult[] | null; riders: RiderInfo | null };
  type BonusRow = { bonus_type: string; points: number; riders: RiderInfo | null };

  const all = (results || []) as unknown as ResultRow[];
  const allBonuses = (bonuses || []) as unknown as BonusRow[];

  // For non-SX series, riders.class is the stale SX class — override with the
  // per-series class so 450/250 buckets and labels are correct (e.g. Deegan
  // is 450MX, not his old 250W).
  if (isMX) {
    const ids = new Set<number>();
    for (const r of all) if (r.riders?.id) ids.add(r.riders.id);
    for (const b of allBonuses) if (b.riders?.id) ids.add(b.riders.id);
    if (ids.size > 0) {
      const { data: rs } = await supabase
        .from("rider_series")
        .select("rider_id, class")
        .eq("series", series)
        .in("rider_id", [...ids]);
      const cmap = new Map((rs || []).map((x) => [x.rider_id, x.class as string]));
      for (const r of all) if (r.riders && cmap.has(r.riders.id)) r.riders.class = cmap.get(r.riders.id)!;
      for (const b of allBonuses) if (b.riders && cmap.has(b.riders.id)) b.riders.class = cmap.get(b.riders.id)!;
    }
  }

  const is450 = (c?: string | null) => (c || "").includes("450");
  // SX `position` is the true finishing position, so the query's position-order is
  // correct. MX `position` is only the rounded AVERAGE moto finish (see auto-import
  // route), which produces ties (two riders → "P4") and an order that matches neither
  // points nor real finish — so rank MX by fantasy points, tie-broken by avg finish
  // then name. The real per-moto finishes ride along in moto_results for display.
  const byMxScore = (a: ResultRow, b: ResultRow) =>
    b.points - a.points ||
    (a.position ?? 99) - (b.position ?? 99) ||
    (a.riders?.name || "").localeCompare(b.riders?.name || "");
  const rank = (arr: ResultRow[]) => (isMX ? [...arr].sort(byMxScore) : arr);
  const top450 = rank(all.filter((r) => is450(r.riders?.class))).slice(0, 10);
  const top250 = rank(all.filter((r) => !is450(r.riders?.class))).slice(0, 10);

  // Which classes have posted (for the live status line)
  const classStatus = {
    has450: all.some((r) => is450(r.riders?.class)),
    has250: all.some((r) => !is450(r.riders?.class)),
  };

  // Categorize bonuses (holeshot types are e.g. "holeshot_450" for SX and
  // "holeshot_moto1_450" for MX — match on the class substring).
  const heatWinners450 = allBonuses.filter((b) => b.bonus_type.startsWith("heat") && b.bonus_type.includes("450"));
  const heatWinners250 = allBonuses.filter((b) => b.bonus_type.startsWith("heat") && b.bonus_type.includes("250"));
  const lcq450 = allBonuses.find((b) => b.bonus_type === "lcq_450");
  const lcq250 = allBonuses.find((b) => b.bonus_type === "lcq_250");
  const holeshots450 = allBonuses.filter((b) => b.bonus_type.startsWith("holeshot") && b.bonus_type.includes("450"));
  const holeshots250 = allBonuses.filter((b) => b.bonus_type.startsWith("holeshot") && b.bonus_type.includes("250"));

  // League members
  const { data: leagueMembers } = await supabase
    .from("league_members")
    .select("user_id, team_name, team_logo, app_users(username)")
    .eq("league_id", leagueId);

  type MemberRow = { user_id: number; team_name: string | null; team_logo: string | null; app_users: { username: string } | null };
  const members = (leagueMembers || []) as unknown as MemberRow[];

  // Get every rostered rider and which user owns them (for highlighting)
  const { data: rosterEntries } = await supabase
    .from("league_rosters")
    .select("user_id, rider_id")
    .eq("league_id", leagueId);
  const riderToUser: Record<number, number> = {};
  for (const r of rosterEntries || []) {
    riderToUser[r.rider_id] = r.user_id;
  }

  const { data: lineups } = await supabase
    .from("weekly_lineups")
    .select("user_id, rider_id")
    .eq("league_id", leagueId)
    .eq("race_id", race.id);

  // Build rider points lookup (results + bonuses)
  const riderPoints: Record<number, { name: string; number: number | null; class: string; resultPoints: number; bonusPoints: number; position: number | null }> = {};
  for (const r of all) {
    if (!r.riders) continue;
    if (!riderPoints[r.riders.id]) {
      riderPoints[r.riders.id] = { name: r.riders.name, number: r.riders.number, class: r.riders.class, resultPoints: 0, bonusPoints: 0, position: null };
    }
    riderPoints[r.riders.id].resultPoints += r.points;
    riderPoints[r.riders.id].position = r.position;
  }
  for (const b of allBonuses) {
    if (!b.riders) continue;
    if (!riderPoints[b.riders.id]) {
      riderPoints[b.riders.id] = { name: b.riders.name, number: b.riders.number, class: b.riders.class, resultPoints: 0, bonusPoints: 0, position: null };
    }
    riderPoints[b.riders.id].bonusPoints += b.points;
  }

  const userScores: MatchupResult["userScores"] = [];
  for (const m of members) {
    const userLineupRiderIds = (lineups || []).filter((l) => l.user_id === m.user_id).map((l) => l.rider_id);
    const userRiders = userLineupRiderIds
      .map((rid) => {
        const rp = riderPoints[rid];
        if (!rp) return null;
        return { name: rp.name, number: rp.number, class: rp.class, position: rp.position, points: rp.resultPoints, bonusPoints: rp.bonusPoints };
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

  // Detect race format (SX only — MX is always "regular"; its 4 moto holeshots
  // must NOT be mistaken for a Triple Crown, and it has no East/West showdown).
  const heatCount = allBonuses.filter((b) => b.bonus_type.startsWith("heat")).length;
  const holeshotCount = allBonuses.filter((b) => b.bonus_type.startsWith("holeshot")).length;
  const isTripleCrown = !isMX && holeshotCount >= 4;
  const has250E = !isMX && all.some((r) => r.riders?.class === "250E");
  const has250W = !isMX && all.some((r) => r.riders?.class === "250W");
  const isShowdown = has250E && has250W;
  let format: "triple_crown" | "showdown" | "regular" = "regular";
  if (isTripleCrown) format = "triple_crown";
  else if (isShowdown) format = "showdown";

  return {
    top450: top450.map((r) => ({
      position: r.position,
      points: r.points,
      motoResults: r.moto_results ?? null,
      rider: r.riders ? { id: r.riders.id, name: r.riders.name, number: r.riders.number, team: r.riders.team, class: r.riders.class } : null,
    })),
    top250: top250.map((r) => ({
      position: r.position,
      points: r.points,
      motoResults: r.moto_results ?? null,
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
    riderToUser,
    userScores,
    format,
    classStatus,
  };
}
