import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { RIDER_ALIASES } from "@/lib/rider-aliases";
import { get250Region } from "@/lib/race-region";

export const dynamic = "force-dynamic";

// Fetch entry list names from supercrosslive.com for a given event + class
async function fetchEntryList(eventId: string, classId: string): Promise<string[]> {
  const url = `https://results.supercrosslive.com/results/?p=view_entry_list&id=${eventId}&class_id=${classId}`;
  const res = await fetch(url);
  const html = await res.text();

  const names: string[] = [];
  const regex = /<td class="text-nowrap">([A-Z][A-Z\s'.,-]+)<\/td>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const name = match[1].trim();
    // Skip non-name entries (hometowns contain commas + state abbreviations)
    if (name.includes(",") || name.length < 3) continue;
    // Convert "COOPER WEBB" to "Cooper Webb"
    const titleCase = name
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/\bMc(\w)/g, (_, c) => `Mc${c.toUpperCase()}`) // McElrath
      .replace(/\bO'(\w)/g, (_, c) => `O'${c.toUpperCase()}`); // O'Brien
    names.push(titleCase);
  }

  return names;
}

// Discover event ID and class IDs from supercrosslive main page
async function discoverEventInfo(): Promise<{ eventId: string; classIds: string[]; city: string | null } | null> {
  try {
    const res = await fetch("https://results.supercrosslive.com/results/");
    const html = await res.text();

    const eventIdMatch = html.match(/event_id=(\d+)/);
    if (!eventIdMatch) return null;

    const titleMatch = html.match(/<title>[^:]*::\s*([^<]+?)<\/title>/i);
    const city = titleMatch ? titleMatch[1].trim() : null;

    const classIdMatches = [...html.matchAll(/class_id=(\d+)/g)];
    const classIds = [...new Set(classIdMatches.map((m) => m[1]))];

    return { eventId: eventIdMatch[1], classIds, city };
  } catch {
    return null;
  }
}

// Get class IDs for a specific event by scraping its event page
async function fetchEventClassIds(eventId: string): Promise<string[]> {
  try {
    const res = await fetch(`https://results.supercrosslive.com/results/?p=view_event&id=${eventId}`);
    const html = await res.text();
    const matches = [...html.matchAll(/view_entry_list[^"]*id=\d+[^"]*class_id=(\d+)/g)];
    return [...new Set(matches.map((m) => m[1]))];
  } catch {
    return [];
  }
}

// Verify the event page city matches an expected race name
async function eventMatchesCity(eventId: string, expectedCity: string): Promise<boolean> {
  try {
    const res = await fetch(`https://results.supercrosslive.com/results/?p=view_event&id=${eventId}`);
    const html = await res.text();
    const titleMatch = html.match(/<title>[^:]*::\s*([^<]+?)<\/title>/i);
    if (!titleMatch) return false;
    const eventCity = titleMatch[1].trim().toLowerCase();
    const raceCity = expectedCity.toLowerCase();
    return (
      eventCity.includes(raceCity) ||
      raceCity.includes(eventCity) ||
      eventCity.replace(/\s+city/i, "") === raceCity.replace(/\s+city/i, "")
    );
  } catch {
    return false;
  }
}

// GET /api/cron/injury-report — cross-references entry list to determine who's racing
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get the next upcoming race
    const { data: nextRace } = await supabase
      .from("races")
      .select("id, name, event_id, round_number")
      .eq("status", "upcoming")
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle();

    // Discover current event info from supercrosslive
    const eventInfo = await discoverEventInfo();

    // Verify the saved event_id matches the next race's city — clear it if not
    let eventId = nextRace?.event_id;
    if (eventId && nextRace?.name) {
      const matches = await eventMatchesCity(eventId, nextRace.name);
      if (!matches) {
        eventId = undefined;
      }
    }

    if (!eventId && eventInfo && nextRace) {
      // Only use discovered event ID if its city matches our next race
      const cityLower = eventInfo.city?.toLowerCase() || "";
      const raceLower = nextRace.name.toLowerCase();
      const cityMatch =
        cityLower.includes(raceLower) ||
        raceLower.includes(cityLower) ||
        cityLower.replace(/\s+city/i, "") === raceLower.replace(/\s+city/i, "");
      if (cityMatch) {
        eventId = eventInfo.eventId;
        await supabase.from("races").update({ event_id: eventId }).eq("id", nextRace.id);
      }
    }

    if (!eventId) {
      return NextResponse.json({ message: "No matching event found for next race yet", updated: 0 });
    }

    // Always pull class IDs from the actual event page (not the main page)
    const classIds = await fetchEventClassIds(eventId);
    if (classIds.length === 0) {
      return NextResponse.json({ message: "No class IDs found on event page yet", updated: 0 });
    }

    // Fetch entry lists for all classes
    const allEntryNames: string[] = [];
    for (const classId of classIds) {
      const names = await fetchEntryList(eventId, classId);
      allEntryNames.push(...names);
    }

    if (allEntryNames.length === 0) {
      return NextResponse.json({ message: "Entry list not posted yet", updated: 0 });
    }

    // Get all riders from DB
    const { data: allRiders } = await supabase.from("riders").select("id, name, status, class");

    // Determine which 250 region this race is
    const raceRegion = get250Region(nextRace?.round_number);
    const riders = allRiders || [];

    // Build reverse alias map (DB name → possible entry list names)
    const reverseAliases: Record<string, string[]> = {};
    for (const [scxName, dbName] of Object.entries(RIDER_ALIASES)) {
      if (!reverseAliases[dbName]) reverseAliases[dbName] = [];
      reverseAliases[dbName].push(scxName);
    }

    function isOnEntryList(riderName: string): boolean {
      const nameNorm = riderName.replace(/\./g, "").toLowerCase();

      // Check direct match
      if (allEntryNames.some((e) => e.replace(/\./g, "").toLowerCase() === nameNorm)) return true;

      // Check aliases
      const aliases = reverseAliases[riderName] || [];
      for (const alias of aliases) {
        if (allEntryNames.some((e) => e.replace(/\./g, "").toLowerCase() === alias.replace(/\./g, "").toLowerCase())) return true;
      }

      // Also check the forward alias map
      const aliasName = RIDER_ALIASES[riderName];
      if (aliasName) {
        if (allEntryNames.some((e) => e.replace(/\./g, "").toLowerCase() === aliasName.replace(/\./g, "").toLowerCase())) return true;
      }

      return false;
    }

    let markedOut = 0;
    let markedActive = 0;

    for (const rider of riders) {
      // Skip 250 riders from the opposite region — they're not expected to be on the entry list
      if (raceRegion === "east" && rider.class === "250W") continue;
      if (raceRegion === "west" && rider.class === "250E") continue;

      const onList = isOnEntryList(rider.name);

      if (!onList && rider.status !== "out") {
        // Not on entry list → mark as out
        await supabase.from("riders").update({ status: "out" }).eq("id", rider.id);
        markedOut++;
      } else if (onList && rider.status === "out") {
        // On entry list but was marked out → mark as active
        await supabase.from("riders").update({ status: "active" }).eq("id", rider.id);
        markedActive++;
      }
    }

    // Also reset opposite-region 250 riders to active (they're not "out", just not racing this round)
    if (raceRegion === "east") {
      const { count } = await supabase.from("riders").update({ status: "active" }).eq("class", "250W").eq("status", "out");
      if (count) markedActive += count;
    } else if (raceRegion === "west") {
      const { count } = await supabase.from("riders").update({ status: "active" }).eq("class", "250E").eq("status", "out");
      if (count) markedActive += count;
    }

    return NextResponse.json({
      message: "Entry list sync complete",
      raceName: nextRace?.name || "Unknown",
      eventId,
      entryListSize: allEntryNames.length,
      markedOut,
      markedActive,
      totalRiders: riders.length,
    });
  } catch (err) {
    console.error("Injury report cron error:", err);
    return NextResponse.json(
      { error: "Injury report sync failed: " + (err as Error).message },
      { status: 500 }
    );
  }
}
