import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { computeRaceMatchup } from "@/lib/race-scoring";

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

  const { data: leagueRow } = await supabase.from("leagues").select("series").eq("id", id).single();
  const series = (leagueRow?.series as string) || "sx";

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
    // Most recent completed race in this league's series
    const { data } = await supabase
      .from("races")
      .select("id, name, round_number, date, location, race_time, status")
      .eq("status", "completed")
      .eq("series", series)
      .order("round_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    race = data;
  }

  if (!race) {
    return NextResponse.json({ error: "No completed race found" }, { status: 404 });
  }

  // Get all completed races in this series (for prev/next navigation)
  const { data: allCompleted } = await supabase
    .from("races")
    .select("id, name, round_number")
    .eq("status", "completed")
    .eq("series", series)
    .order("round_number", { ascending: true });

  // Compute the head-to-head matchup (shared with the live tracker)
  const matchup = await computeRaceMatchup(id, race, series);

  return NextResponse.json({
    race: {
      id: race.id,
      name: race.name,
      round_number: race.round_number,
      date: race.date,
      location: race.location,
      race_time: race.race_time,
      format: matchup.format,
    },
    navigation: (allCompleted || []).map((r) => ({ id: r.id, name: r.name, round_number: r.round_number })),
    top450: matchup.top450,
    top250: matchup.top250,
    bonuses: matchup.bonuses,
    bonusSummary: matchup.bonusSummary,
    riderToUser: matchup.riderToUser, // map of rider_id → user_id (who has them on roster)
    userScores: matchup.userScores,
  });
}
