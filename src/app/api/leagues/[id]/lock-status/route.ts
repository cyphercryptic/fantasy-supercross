import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET /api/leagues/[id]/lock-status — check if rosters/lineups are locked
// Locks 1 hour before race_time and stays locked until midnight ET that day
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
    if (race.race_time) {
      const raceTime = new Date(race.race_time);
      // Lock starts 1 hour before race
      const lockStart = new Date(raceTime.getTime() - 60 * 60 * 1000);
      // Lock ends at midnight ET on race day
      // race_time already has timezone offset, so extract the date in ET
      const raceDate = race.date || race.race_time.split("T")[0];
      // Midnight ET = next day at 05:00 UTC (EST) or 04:00 UTC (EDT)
      // Use a safe approach: midnight is ~5 hours after a 7pm race
      const lockEnd = new Date(raceTime.getTime() + 5 * 60 * 60 * 1000);

      if (now >= lockStart && now <= lockEnd) {
        locked = true;
        lockedRaceName = race.name;
        break;
      }
    } else if (race.date && race.date <= now.toISOString().split("T")[0]) {
      // Fallback for races without race_time — lock all day
      locked = true;
      lockedRaceName = race.name;
      break;
    }
  }

  // Also include the next race time so client can decide whether to poll
  let nextRaceTime: string | null = null;
  let nextRaceDate: string | null = null;
  for (const race of upcomingRaces || []) {
    if (race.race_time) {
      nextRaceTime = race.race_time;
      nextRaceDate = race.date;
      break;
    }
  }

  return NextResponse.json({ locked, raceName: lockedRaceName, nextRaceTime, nextRaceDate });
}
