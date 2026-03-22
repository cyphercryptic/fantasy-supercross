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

  // Get rostered rider IDs
  const { data: rostered } = await supabase
    .from("league_rosters")
    .select("rider_id")
    .eq("league_id", id);
  const rosteredIds = (rostered || []).map((r) => r.rider_id);

  // Free agents = riders NOT on any roster
  let freeAgentQuery = supabase.from("riders").select("*").order("number", { ascending: true, nullsFirst: false });
  if (rosteredIds.length > 0) {
    freeAgentQuery = freeAgentQuery.not("id", "in", `(${rosteredIds.join(",")})`);
  }
  const { data: freeAgents } = await freeAgentQuery;

  // User's current roster
  const { data: rosterEntries } = await supabase
    .from("league_rosters")
    .select("riders(*)")
    .eq("league_id", id)
    .eq("user_id", user.id);
  const myRoster = (rosterEntries || []).map((e) => e.riders);

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

  const { data: league } = await supabase
    .from("leagues")
    .select("roster_size")
    .eq("id", id)
    .single();

  return NextResponse.json({ freeAgents, myRoster, transactions, rosterSize: league!.roster_size });
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
    await supabase.from("league_rosters").insert({
      league_id: Number(id), user_id: user.id, rider_id: addRiderId,
    });
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
