import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { isRaceLocked } from "@/lib/race-lock";
import { get250Region } from "@/lib/race-region";

export const dynamic = "force-dynamic";

// GET /api/leagues/[id]/lineup?raceId=X — get user's lineup for a race
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;
  const raceId = req.nextUrl.searchParams.get("raceId");

  const { data: member } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  if (!raceId) {
    return NextResponse.json({ error: "raceId required" }, { status: 400 });
  }

  // Allow viewing another user's lineup (read-only)
  const viewUserId = req.nextUrl.searchParams.get("userId");
  const targetUserId = viewUserId ? parseInt(viewUserId) : user.id;

  const { data: entries } = await supabase
    .from("weekly_lineups")
    .select("riders(*)")
    .eq("league_id", id)
    .eq("user_id", targetUserId)
    .eq("race_id", raceId);

  const lineup = (entries || []).map((e) => e.riders);
  return NextResponse.json(lineup);
}

// POST /api/leagues/[id]/lineup — set lineup for a race
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;
  const { raceId, riderIds } = await req.json();

  const { data: member } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const { data: race } = await supabase
    .from("races")
    .select("*")
    .eq("id", raceId)
    .maybeSingle();
  if (!race) {
    return NextResponse.json({ error: "Race not found" }, { status: 404 });
  }
  if (isRaceLocked(race)) {
    return NextResponse.json({ error: "Lineup is locked — race has started" }, { status: 400 });
  }

  const { data: league } = await supabase
    .from("leagues")
    .select("lineup_450, lineup_250e, lineup_250w, series")
    .eq("id", id)
    .single();

  const leagueSeries = (league?.series as string) || "sx";

  // Validate all riders are on roster
  const { data: rosterEntries } = await supabase
    .from("league_rosters")
    .select("rider_id, riders(id, class)")
    .eq("league_id", id)
    .eq("user_id", user.id);

  const rosterSet = new Set((rosterEntries || []).map((r) => r.rider_id));

  for (const rid of riderIds) {
    if (!rosterSet.has(rid)) {
      return NextResponse.json({ error: "All riders must be on your roster" }, { status: 400 });
    }
  }

  // Build class map: for MX use rider_series (SX classes in riders table are stale)
  let riderClassMap: Map<number, string>;
  if (leagueSeries === "mx") {
    const rosterIds = (rosterEntries || []).map((r) => r.rider_id);
    const { data: seriesEntries } = await supabase
      .from("rider_series")
      .select("rider_id, class")
      .eq("series", "mx")
      .in("rider_id", rosterIds);
    riderClassMap = new Map((seriesEntries || []).map((rs) => [rs.rider_id, rs.class as string]));
  } else {
    riderClassMap = new Map(
      (rosterEntries || []).map((r) => [r.rider_id, (r.riders as unknown as Record<string, unknown>)?.class as string])
    );
  }

  if (leagueSeries === "mx") {
    // MX: validate 450MX and 250MX counts
    const classCounts: Record<string, number> = { "450MX": 0, "250MX": 0 };
    for (const rid of riderIds) {
      const cls = riderClassMap.get(rid) || "";
      if (cls in classCounts) classCounts[cls]++;
    }
    if (classCounts["450MX"] !== league!.lineup_450) {
      return NextResponse.json({ error: `Must select exactly ${league!.lineup_450} rider(s) from the 450MX class` }, { status: 400 });
    }
    if (classCounts["250MX"] !== league!.lineup_250e) {
      return NextResponse.json({ error: `Must select exactly ${league!.lineup_250e} rider(s) from the 250MX class` }, { status: 400 });
    }
  } else {
    // SX: derive race region, validate 450 / 250E / 250W
    const raceRegion = get250Region(race.round_number);
    const classCounts: Record<string, number> = { "450": 0, "250E": 0, "250W": 0 };
    for (const rid of riderIds) {
      const cls = riderClassMap.get(rid) || "";
      if (cls in classCounts) classCounts[cls]++;
    }
    const need250E = raceRegion === "east" || raceRegion === "showdown" || !raceRegion;
    const need250W = raceRegion === "west" || raceRegion === "showdown" || !raceRegion;
    if (classCounts["450"] !== league!.lineup_450) {
      return NextResponse.json({ error: `Must select exactly ${league!.lineup_450} rider(s) from 450 class` }, { status: 400 });
    }
    if (need250E && classCounts["250E"] !== league!.lineup_250e) {
      return NextResponse.json({ error: `Must select exactly ${league!.lineup_250e} rider(s) from 250E class` }, { status: 400 });
    }
    if (need250W && classCounts["250W"] !== league!.lineup_250w) {
      return NextResponse.json({ error: `Must select exactly ${league!.lineup_250w} rider(s) from 250W class` }, { status: 400 });
    }
  }

  // Clear old lineup, insert new
  await supabase
    .from("weekly_lineups")
    .delete()
    .eq("league_id", id)
    .eq("user_id", user.id)
    .eq("race_id", raceId);

  const inserts = (riderIds as number[]).map((rid) => ({
    league_id: Number(id),
    user_id: user.id,
    race_id: Number(raceId),
    rider_id: rid,
  }));
  await supabase.from("weekly_lineups").insert(inserts);

  return NextResponse.json({ success: true });
}
