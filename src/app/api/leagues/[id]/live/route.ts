import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { computeRaceMatchup, MatchupRace } from "@/lib/race-scoring";

export const dynamic = "force-dynamic";

// A race is "live" from gate drop until this many hours later. An MX event
// (4 motos + overalls) wraps up well within this window; once the overall posts
// the importer flips status to "completed" and we hand off to the recap.
const LIVE_WINDOW_HOURS = 6;

// GET /api/leagues/[id]/live — head-to-head matchup for the race happening now.
// Returns { live: false, lastCompletedRaceId? } when nothing is in progress.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const now = new Date();

  // Find the in-progress race: gate drop has passed, results still coming in
  // (status stays "upcoming" until the overall posts), within the live window.
  const { data: upcoming } = await supabase
    .from("races")
    .select("id, name, round_number, date, location, race_time, status")
    .eq("series", series)
    .eq("status", "upcoming")
    .not("race_time", "is", null)
    .order("race_time", { ascending: false });

  let liveRace: MatchupRace | null = null;
  for (const r of upcoming || []) {
    const start = new Date(r.race_time as string);
    const end = new Date(start.getTime() + LIVE_WINDOW_HOURS * 60 * 60 * 1000);
    if (now >= start && now <= end) {
      liveRace = r as MatchupRace;
      break;
    }
  }

  if (!liveRace) {
    // Nothing live — point the page at the most recent completed race for recap.
    const { data: lastCompleted } = await supabase
      .from("races")
      .select("id, name, round_number")
      .eq("series", series)
      .eq("status", "completed")
      .order("round_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    return NextResponse.json({
      live: false,
      lastCompleted: lastCompleted || null,
      lastUpdated: now.toISOString(),
    });
  }

  const matchup = await computeRaceMatchup(id, liveRace, series);

  return NextResponse.json({
    live: true,
    race: {
      id: liveRace.id,
      name: liveRace.name,
      round_number: liveRace.round_number,
      date: liveRace.date,
      location: liveRace.location,
      race_time: liveRace.race_time,
    },
    classStatus: matchup.classStatus,
    top450: matchup.top450,
    top250: matchup.top250,
    bonuses: matchup.bonuses,
    riderToUser: matchup.riderToUser,
    userScores: matchup.userScores,
    lastUpdated: now.toISOString(),
  });
}
