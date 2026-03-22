import { supabase } from "@/lib/supabase";

/**
 * Check if a specific race is locked (started or completed).
 * A race is locked if:
 * - status is "completed", OR
 * - race_time has passed, OR
 * - race date is today or earlier (fallback when race_time is not set)
 */
export function isRaceLocked(race: { status: string; race_time: string | null; date: string | null }): boolean {
  if (race.status === "completed") return true;

  const now = new Date();

  if (race.race_time) {
    return new Date(race.race_time) <= now;
  }

  if (race.date) {
    const todayStr = now.toISOString().split("T")[0];
    return race.date <= todayStr;
  }

  return false;
}

/**
 * Check if there is any active race happening right now (for locking free agent transactions).
 * Returns true if any race has started but not yet completed.
 */
export async function isAnyRaceActive(): Promise<boolean> {
  const { data: upcomingRaces } = await supabase
    .from("races")
    .select("status, race_time, date")
    .eq("status", "upcoming");

  if (!upcomingRaces || upcomingRaces.length === 0) return false;

  return upcomingRaces.some((race) => isRaceLocked(race));
}
