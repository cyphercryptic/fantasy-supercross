import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { isAnyRaceActive } from "@/lib/race-lock";

export const dynamic = "force-dynamic";

// GET — list all free agents (riders not on any roster in this league)
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

  // Get league series to filter the right rider pool
  const { data: leagueInfo } = await supabase
    .from("leagues")
    .select("series")
    .eq("id", id)
    .single();
  const leagueSeries = (leagueInfo?.series as string) || "sx";

  // Get rostered rider IDs
  const { data: rostered } = await supabase
    .from("league_rosters")
    .select("rider_id")
    .eq("league_id", id);
  const rosteredIds = (rostered || []).map((r) => r.rider_id);

  // Free agents = riders in this series' pool NOT on any roster
  let freeAgents: { id: number; name: string; number: number | null; team: string | null; class: string; status: string }[];
  if (leagueSeries !== "sx") {
    const { data: seriesRiders } = await supabase
      .from("rider_series")
      .select("rider_id, class, number, team, status, riders(id, name)")
      .eq("series", leagueSeries)
      .order("number", { ascending: true, nullsFirst: false });
    freeAgents = (seriesRiders || [])
      .filter((rs) => !rosteredIds.includes(rs.rider_id))
      .map((rs) => {
        const r = rs.riders as unknown as { id: number; name: string };
        return { id: r.id, name: r.name, class: rs.class as string, number: rs.number as number | null, team: rs.team as string | null, status: rs.status as string };
      });
  } else {
    let freeAgentQuery = supabase.from("riders").select("*").order("number", { ascending: true, nullsFirst: false });
    if (rosteredIds.length > 0) {
      freeAgentQuery = freeAgentQuery.not("id", "in", `(${rosteredIds.join(",")})`);
    }
    const { data } = await freeAgentQuery;
    freeAgents = (data || []) as typeof freeAgents;
  }

  // Get season points for free agents — scoped to this series' races only
  const freeAgentIds = freeAgents.map((r) => r.id);
  let seasonPoints: Record<number, number> = {};
  if (freeAgentIds.length > 0) {
    // Get race IDs for this series
    const { data: seriesRaces } = await supabase
      .from("races")
      .select("id")
      .eq("series", leagueSeries)
      .eq("status", "completed");
    const seriesRaceIds = (seriesRaces || []).map((r) => r.id);

    if (seriesRaceIds.length > 0) {
      const { data: results } = await supabase
        .from("race_results")
        .select("rider_id, points")
        .in("rider_id", freeAgentIds)
        .in("race_id", seriesRaceIds);
      const { data: bonuses } = await supabase
        .from("race_bonuses")
        .select("rider_id, points")
        .in("rider_id", freeAgentIds)
        .in("race_id", seriesRaceIds);
      for (const r of results || []) {
        seasonPoints[r.rider_id] = (seasonPoints[r.rider_id] || 0) + r.points;
      }
      for (const b of bonuses || []) {
        seasonPoints[b.rider_id] = (seasonPoints[b.rider_id] || 0) + b.points;
      }
    }
  }

  // Attach season points and sort by points desc
  const freeAgentsWithPoints = (freeAgents || [])
    .map((r) => ({ ...r, seasonPoints: seasonPoints[r.id] || 0 }))
    .sort((a, b) => b.seasonPoints - a.seasonPoints);

  // User's current roster
  const { data: rosterEntries } = await supabase
    .from("league_rosters")
    .select("riders(*)")
    .eq("league_id", id)
    .eq("user_id", user.id);
  const myRoster = (rosterEntries || []).map((e) => e.riders as unknown as Record<string, unknown>);

  // For non-SX series, riders.class/status are stale SX values — override from
  // rider_series so the roster shows the right class and injury status.
  if (leagueSeries !== "sx" && myRoster.length > 0) {
    const rosterIds = myRoster.map((r) => r.id as number);
    const { data: seriesRows } = await supabase
      .from("rider_series")
      .select("rider_id, class, status")
      .eq("series", leagueSeries)
      .in("rider_id", rosterIds);
    const map = new Map((seriesRows || []).map((s) => [s.rider_id, s]));
    for (const r of myRoster) {
      const s = map.get(r.id as number);
      if (s) { r.class = s.class; r.status = s.status; }
    }
  }

  // Recent transactions
  const { data: rawTxns } = await supabase
    .from("transactions")
    .select("*, app_users(username)")
    .eq("league_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Get rider details for transactions
  const addedIds = (rawTxns || []).map((t) => t.added_rider_id).filter(Boolean) as number[];
  const droppedIds = (rawTxns || []).map((t) => t.dropped_rider_id).filter(Boolean) as number[];
  const allTxnRiderIds = [...new Set([...addedIds, ...droppedIds])];

  let riderMap = new Map<number, Record<string, unknown>>();
  if (allTxnRiderIds.length > 0) {
    const { data: txnRiders } = await supabase
      .from("riders")
      .select("id, name, number, class")
      .in("id", allTxnRiderIds);
    riderMap = new Map((txnRiders || []).map((r) => [r.id, r]));

    // riders.class/number are stale SX values — override from rider_series so
    // the activity log doesn't show 250E/250W (or old numbers) in an MX league.
    if (leagueSeries !== "sx") {
      const { data: txnSeriesRows } = await supabase
        .from("rider_series")
        .select("rider_id, class, number")
        .eq("series", leagueSeries)
        .in("rider_id", allTxnRiderIds);
      for (const s of txnSeriesRows || []) {
        const r = riderMap.get(s.rider_id);
        if (r) { r.class = s.class; if (s.number != null) r.number = s.number; }
      }
    }
  }

  const transactions = (rawTxns || []).map((t) => {
    const added = t.added_rider_id ? riderMap.get(t.added_rider_id) : null;
    const dropped = t.dropped_rider_id ? riderMap.get(t.dropped_rider_id) : null;
    return {
      id: t.id, league_id: t.league_id, user_id: t.user_id, type: t.type,
      added_rider_id: t.added_rider_id, dropped_rider_id: t.dropped_rider_id,
      created_at: t.created_at,
      username: (t.app_users as unknown as unknown as Record<string, unknown>)?.username,
      added_rider_name: added?.name, added_rider_number: added?.number, added_rider_class: added?.class,
      dropped_rider_name: dropped?.name, dropped_rider_number: dropped?.number, dropped_rider_class: dropped?.class,
    };
  });

  const { data: leagueMeta } = await supabase
    .from("leagues")
    .select("roster_size")
    .eq("id", id)
    .single();

  return NextResponse.json({ freeAgents: freeAgentsWithPoints, myRoster, transactions, rosterSize: leagueMeta!.roster_size, series: leagueSeries });
}

// POST — add/drop transaction
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;
  const { addRiderId, dropRiderId } = await req.json();

  const { data: member } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const { data: league } = await supabase
    .from("leagues")
    .select("roster_size, draft_status")
    .eq("id", id)
    .single();

  if (league!.draft_status !== "completed") {
    return NextResponse.json({ error: "Draft must be completed before making transactions" }, { status: 400 });
  }

  // Lock transactions while a race is active
  const raceActive = await isAnyRaceActive();
  if (raceActive) {
    return NextResponse.json({ error: "Roster moves are locked while a race is in progress" }, { status: 400 });
  }

  if (!addRiderId && !dropRiderId) {
    return NextResponse.json({ error: "Must specify a rider to add or drop" }, { status: 400 });
  }

  const { count: currentRosterCount } = await supabase
    .from("league_rosters")
    .select("*", { count: "exact", head: true })
    .eq("league_id", id)
    .eq("user_id", user.id);

  if (addRiderId) {
    const { data: onRoster } = await supabase
      .from("league_rosters")
      .select("id")
      .eq("league_id", id)
      .eq("rider_id", addRiderId)
      .maybeSingle();
    if (onRoster) {
      return NextResponse.json({ error: "Rider is already on a team's roster" }, { status: 400 });
    }

    const { data: riderExists } = await supabase
      .from("riders")
      .select("id")
      .eq("id", addRiderId)
      .maybeSingle();
    if (!riderExists) {
      return NextResponse.json({ error: "Rider not found" }, { status: 404 });
    }

    if (!dropRiderId && (currentRosterCount || 0) >= league!.roster_size) {
      return NextResponse.json({ error: `Roster is full (${league!.roster_size}). You must drop a rider first.` }, { status: 400 });
    }
  }

  if (dropRiderId) {
    const { data: onMyRoster } = await supabase
      .from("league_rosters")
      .select("id")
      .eq("league_id", id)
      .eq("user_id", user.id)
      .eq("rider_id", dropRiderId)
      .maybeSingle();
    if (!onMyRoster) {
      return NextResponse.json({ error: "Rider is not on your roster" }, { status: 400 });
    }
  }

  // Execute the add/drop
  if (dropRiderId) {
    await supabase
      .from("league_rosters")
      .delete()
      .eq("league_id", id)
      .eq("user_id", user.id)
      .eq("rider_id", dropRiderId);

    // Remove from upcoming lineups
    const { data: upcomingRaces } = await supabase
      .from("races")
      .select("id")
      .eq("status", "upcoming");
    const upcomingIds = (upcomingRaces || []).map((r) => r.id);

    if (upcomingIds.length > 0) {
      await supabase
        .from("weekly_lineups")
        .delete()
        .eq("league_id", id)
        .eq("user_id", user.id)
        .eq("rider_id", dropRiderId)
        .in("race_id", upcomingIds);
    }
  }

  if (addRiderId) {
    const { error: addErr } = await supabase.from("league_rosters").insert({
      league_id: Number(id), user_id: user.id, rider_id: addRiderId,
    });
    if (addErr) {
      // Likely caused by another manager adding the same rider between our
      // availability check above and this insert (race condition).
      // 23505 = unique_violation on (league_id, rider_id).
      if (addErr.code === "23505") {
        // Roll back the drop we already executed — restore the rider to roster
        if (dropRiderId) {
          await supabase.from("league_rosters").insert({
            league_id: Number(id), user_id: user.id, rider_id: dropRiderId,
          });
        }
        return NextResponse.json(
          { error: "Another manager just claimed that rider. Refresh and try again.", code: "rider_just_claimed" },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: "Failed to add rider: " + addErr.message }, { status: 500 });
    }
  }

  // Log the transaction
  let type = "add_drop";
  if (addRiderId && !dropRiderId) type = "add";
  if (!addRiderId && dropRiderId) type = "drop";

  await supabase.from("transactions").insert({
    league_id: Number(id), user_id: user.id, type,
    added_rider_id: addRiderId || null, dropped_rider_id: dropRiderId || null,
  });

  return NextResponse.json({ success: true });
}
