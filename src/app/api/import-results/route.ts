import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { getPointsForPosition } from "@/lib/scoring";

export const dynamic = "force-dynamic";

interface ParsedRace {
  name: string;
  url: string;
  type: "heat_250" | "heat_450" | "lcq_250" | "lcq_450" | "main_250" | "main_450" | "other";
  heatNumber?: number;
  isOverall?: boolean;
}

function classifyRace(name: string): ParsedRace["type"] {
  const n = name.toLowerCase();
  if (n.includes("250") && n.includes("heat")) return "heat_250";
  if (n.includes("450") && n.includes("heat")) return "heat_450";
  if (n.includes("250") && n.includes("lcq")) return "lcq_250";
  if (n.includes("450") && n.includes("lcq")) return "lcq_450";
  if (n.includes("250") && (n.includes("main") || n.includes("overall"))) return "main_250";
  if (n.includes("450") && (n.includes("main") || n.includes("overall"))) return "main_450";
  return "other";
}

function getHeatNumber(name: string): number | undefined {
  const match = name.match(/Heat\s*#?(\d)/i);
  return match ? parseInt(match[1]) : undefined;
}

function parseDriverNames(html: string): string[] {
  const names: string[] = [];
  const regex = /driverNames\.push\('([^']+)'\)/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    names.push(match[1]);
  }
  return names;
}

async function fetchEventRaces(eventId: string): Promise<ParsedRace[]> {
  const url = `https://results.supercrosslive.com/results/?p=view_event&id=${eventId}`;
  const res = await fetch(url);
  const html = await res.text();

  const races: ParsedRace[] = [];
  const linkRegex = /href="\/results\/\?p=view_race_result(?:&amp;|&)id=(\d+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const rawContent = match[2].replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "").trim();
    if (!rawContent) continue;
    const raceType = classifyRace(rawContent);
    if (raceType !== "other") {
      races.push({
        name: rawContent,
        url: `https://results.supercrosslive.com/results/?p=view_race_result&id=${match[1]}`,
        type: raceType,
        heatNumber: getHeatNumber(rawContent),
      });
    }
  }

  const overallRegex = /href="\/results\/\?p=view_multi_main_result(?:&amp;|&)id=(\d+)"[^>]*>([\s\S]*?)<\/a>/gi;
  while ((match = overallRegex.exec(html)) !== null) {
    const rawContent = match[2].replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "").trim();
    if (!rawContent) continue;
    const raceType = classifyRace(rawContent);
    if (raceType !== "other") {
      races.push({
        name: rawContent,
        url: `https://results.supercrosslive.com/results/?p=view_multi_main_result&id=${match[1]}`,
        type: raceType,
        isOverall: true,
      });
    }
  }

  return races;
}

async function fetchOverallResults(raceUrl: string): Promise<string[]> {
  const res = await fetch(raceUrl);
  const html = await res.text();
  const names: string[] = [];
  const regex = /<td class="w-100 text-nowrap">\s*([^<]+?)\s*<\/td>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const name = m[1].trim();
    if (name && name !== "RIDER") names.push(name);
  }
  return names;
}

async function fetchRaceResults(raceUrl: string): Promise<string[]> {
  const res = await fetch(raceUrl);
  const html = await res.text();
  return parseDriverNames(html);
}

// POST /api/import-results — fetch and import results from supercrosslive.com
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.is_admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const { eventId, raceId } = body;

  if (!eventId || !raceId) {
    return NextResponse.json({ error: "eventId and raceId required" }, { status: 400 });
  }

  // Verify the race exists
  const { data: race } = await supabase
    .from("races")
    .select("id, name")
    .eq("id", raceId)
    .maybeSingle();
  if (!race) {
    return NextResponse.json({ error: "Race not found" }, { status: 404 });
  }

  // Get all riders from our database
  const { data: allRiders } = await supabase
    .from("riders")
    .select("id, name, number, team, class");

  const riders = allRiders || [];

  function findRider(scxName: string) {
    const exact = riders.find((r) => r.name.toLowerCase() === scxName.toLowerCase());
    if (exact) return exact;
    for (const rider of riders) {
      const normalizedScx = scxName.replace(/\./g, "").toLowerCase();
      const normalizedDb = rider.name.replace(/\./g, "").toLowerCase();
      if (normalizedScx === normalizedDb) return rider;
    }
    return null;
  }

  try {
    const eventRaces = await fetchEventRaces(eventId);

    if (eventRaces.length === 0) {
      return NextResponse.json({ error: "No races found on event page" }, { status: 400 });
    }

    const mainResults: { type: string; results: string[] }[] = [];
    const bonuses: { riderId: number; type: string }[] = [];
    const importLog: string[] = [];

    for (const eventRace of eventRaces) {
      const finishOrder = eventRace.isOverall
        ? await fetchOverallResults(eventRace.url)
        : await fetchRaceResults(eventRace.url);

      if (finishOrder.length === 0) {
        importLog.push(`No results found for ${eventRace.name}`);
        continue;
      }

      importLog.push(`Fetched ${eventRace.name}: ${finishOrder.length} riders`);

      if (eventRace.type === "main_450" || eventRace.type === "main_250") {
        mainResults.push({ type: eventRace.type, results: finishOrder });
      }

      if (eventRace.type === "heat_250" || eventRace.type === "heat_450") {
        const winnerName = finishOrder[0];
        const winner = findRider(winnerName);
        if (winner) {
          const heatNum = eventRace.heatNumber || 1;
          const classPrefix = eventRace.type === "heat_450" ? "450" : "250";
          bonuses.push({ riderId: winner.id, type: `heat${heatNum}_${classPrefix}` });
          importLog.push(`  Heat winner bonus: ${winnerName} → heat${heatNum}_${classPrefix}`);
        } else {
          importLog.push(`  WARNING: Could not match heat winner "${winnerName}" to any rider in database`);
        }
      }

      if (eventRace.type === "lcq_250" || eventRace.type === "lcq_450") {
        const winnerName = finishOrder[0];
        const winner = findRider(winnerName);
        if (winner) {
          const classPrefix = eventRace.type === "lcq_450" ? "450" : "250";
          bonuses.push({ riderId: winner.id, type: `lcq_${classPrefix}` });
          importLog.push(`  LCQ winner bonus: ${winnerName} → lcq_${classPrefix}`);
        } else {
          importLog.push(`  WARNING: Could not match LCQ winner "${winnerName}" to any rider in database`);
        }
      }
    }

    importLog.push("");
    importLog.push("NOTE: Holeshot bonuses must be set manually via Edit Results.");

    // Save results
    const upsertData: { race_id: number; rider_id: number; position: number; points: number }[] = [];
    let resultsImported = 0;

    for (const main of mainResults) {
      for (let i = 0; i < main.results.length; i++) {
        const position = i + 1;
        const riderName = main.results[i];
        const rider = findRider(riderName);
        if (rider) {
          upsertData.push({
            race_id: raceId, rider_id: rider.id, position, points: getPointsForPosition(position),
          });
          resultsImported++;
        } else {
          importLog.push(`WARNING: Could not match "${riderName}" (P${position}) to any rider in database`);
        }
      }
    }

    if (upsertData.length > 0) {
      await supabase.from("race_results").upsert(upsertData, { onConflict: "race_id,rider_id" });
    }

    // Clear old bonuses and insert new
    await supabase.from("race_bonuses").delete().eq("race_id", raceId);
    if (bonuses.length > 0) {
      const bonusData = bonuses.map((b) => ({
        race_id: raceId, rider_id: b.riderId, bonus_type: b.type, points: 1,
      }));
      await supabase.from("race_bonuses").insert(bonusData);
    }

    // Mark race as completed
    await supabase.from("races").update({ status: "completed" }).eq("id", raceId);

    return NextResponse.json({
      success: true, resultsImported, bonuses: bonuses.length, log: importLog,
    });
  } catch (err) {
    console.error("Import error:", err);
    return NextResponse.json({ error: "Failed to import results: " + (err as Error).message }, { status: 500 });
  }
}

// GET /api/import-results — fetch event info for preview
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.is_admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const eventId = req.nextUrl.searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ error: "eventId required" }, { status: 400 });
  }

  try {
    const races = await fetchEventRaces(eventId);
    return NextResponse.json({ races });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch event: " + (err as Error).message }, { status: 500 });
  }
}
