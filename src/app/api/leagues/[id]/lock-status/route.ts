import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET /api/leagues/[id]/lock-status — check if rosters/lineups are locked
export async function GET() {
  const { data: upcomingRaces } = await supabase
    .from("races")
    .select("id, name, status, race_time, date")
    .eq("status", "upcoming")
    .order("date", { ascending: true });

  const now = new Date();
  let locked = false;
  let lockedRaceName: string | null = null;

  for (const race of upcomingRaces || []) {
    if (race.race_time && new Date(race.race_time) <= now) {
      locked = true;
      lockedRaceName = race.name;
      break;
    }
    if (!race.race_time && race.date && race.date <= now.toISOString().split("T")[0]) {
      locked = true;
      lockedRaceName = race.name;
      break;
    }
  }

  return NextResponse.json({ locked, raceName: lockedRaceName });
}
