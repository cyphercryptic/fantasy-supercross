import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getPointsForPosition } from "@/lib/scoring";

interface ParsedRace {
  name: string;
  url: string;
  type: "heat_250" | "heat_450" | "lcq_250" | "lcq_450" | "main_250" | "main_450" | "other";
  heatNumber?: number;
  isOverall?: boolean;
}

interface ParsedResult {
  position: number;
  riderName: string;
  riderNumber: number | null;
  hasHoleshot: boolean;
}

function classifyRace(name: string): ParsedRace["type"] {
  const n = name.toLowerCase();
  if (n.includes("250") && n.includes("heat")) return "heat_250";
  if (n.includes("450") && n.includes("heat")) return "heat_450";
  if (n.includes("250") && n.includes("lcq")) return "lcq_250";
  if (n.includes("450") && n.includes("lcq")) return "lcq_450";
  // "Overall Results" for Triple Crown, "Main Event" for regular rounds
  if (n.includes("250") && (n.includes("main") || n.includes("overall"))) return "main_250";
  if (n.includes("450") && (n.includes("main") || n.includes("overall"))) return "main_450";
  // Skip individual Triple Crown races (Race #1, #2, #3) — use Overall instead
  return "other";
}

function getHeatNumber(name: string): number | undefined {
  // Match "Heat #1", "Heat #2", "Heat 1", "Heat 2"
  const match = name.match(/Heat\s*#?(\d)/i);
  return match ? parseInt(match[1]) : undefined;
}

// Parse driverNames array from HTML page JavaScript
function parseDriverNames(html: string): string[] {
  const names: string[] = [];
  const regex = /driverNames\.push\('([^']+)'\)/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    names.push(match[1]);
  }
  return names;
}

// Parse the PDF text for detailed results with rider numbers and holeshot
function parsePdfResults(text: string): ParsedResult[] {
  const results: ParsedResult[] = [];
  // Match lines like: 1  3  Eli Tomac  KTM  ...
  // Or with holeshot: 3  26  Jorge Prado (HS)  KTM  ...
  const lines = text.split("\n");
  for (const line of lines) {
    // Try to match: POS  #  RIDER NAME (optional HS)  BIKE
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.+?)\s+(KTM|Yamaha|Honda|Kawasaki|Suzuki|Husqvarna|Ducati|GasGas|GASGAS|Triumph|Beta|Stark)\s/i);
    if (match) {
      const position = parseInt(match[1]);
      const riderNumber = parseInt(match[2]);
      let riderName = match[3].trim();
      const hasHoleshot = /\(HS\)/i.test(riderName);
      riderName = riderName.replace(/\s*\(HS\)\s*/i, "").trim();
      results.push({ position, riderNumber, riderName, hasHoleshot });
    }
  }
  return results;
}

// Fetch event page and extract race links
async function fetchEventRaces(eventId: string): Promise<ParsedRace[]> {
  const url = `https://results.supercrosslive.com/results/?p=view_event&id=${eventId}`;
  const res = await fetch(url);
  const html = await res.text();

  const races: ParsedRace[] = [];
  // Match full <a> tags linking to race results (multiline, with comments inside)
  const linkRegex = /href="\/results\/\?p=view_race_result(?:&amp;|&)id=(\d+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    // Strip HTML comments and tags, then trim whitespace to get race name
    const rawContent = match[2].replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "").trim();
    if (!rawContent) continue; // Skip PDF/print links with no text
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

  // Also match Triple Crown overall results (view_multi_main_result)
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

// Parse HTML table from Overall Results pages (Triple Crown)
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

// Fetch a race result page and get finishing order from driverNames
async function fetchRaceResults(raceUrl: string): Promise<string[]> {
  const res = await fetch(raceUrl);
  const html = await res.text();
  return parseDriverNames(html);
}

// Fetch PDF results for main events (has rider numbers + holeshot info)
async function fetchPdfResults(raceUrl: string): Promise<ParsedResult[]> {
  // Get the PDF export URL by following the redirect
  const raceId = raceUrl.match(/id=(\d+)/)?.[1];
  if (!raceId) return [];

  const pdfUrl = `https://results.supercrosslive.com/results/?p=view_race_result&id=${raceId}&export=pdf`;
  const res = await fetch(pdfUrl, { redirect: "manual" });
  const redirectUrl = res.headers.get("location");

  if (!redirectUrl) return [];

  // We can't easily parse the PDF server-side without a library,
  // so we'll rely on name matching from the HTML driverNames instead
  return [];
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

  const db = getDb();

  // Verify the race exists
  const race = db.prepare("SELECT * FROM races WHERE id = ?").get(raceId) as { id: number; name: string } | undefined;
  if (!race) {
    return NextResponse.json({ error: "Race not found" }, { status: 404 });
  }

  // Get all riders from our database
  const allRiders = db.prepare("SELECT id, name, number, team, class FROM riders").all() as {
    id: number;
    name: string;
    number: number | null;
    team: string | null;
    class: string | null;
  }[];

  // Build a name lookup map (lowercase, last name + first name variations)
  function buildNameLookup() {
    const lookup = new Map<string, typeof allRiders[0]>();
    for (const rider of allRiders) {
      // Exact lowercase match
      lookup.set(rider.name.toLowerCase(), rider);
      // Try "FIRST LAST" format (supercrosslive uses this)
      const parts = rider.name.split(" ");
      if (parts.length >= 2) {
        // Our DB might have "First Last", supercrosslive has "FIRST LAST"
        lookup.set(rider.name.toUpperCase(), rider);
      }
    }
    return lookup;
  }

  const nameLookup = buildNameLookup();

  function findRider(scxName: string) {
    // Try exact match
    const exact = nameLookup.get(scxName.toLowerCase()) || nameLookup.get(scxName.toUpperCase());
    if (exact) return exact;

    // Try case-insensitive comparison
    for (const rider of allRiders) {
      if (rider.name.toLowerCase() === scxName.toLowerCase()) return rider;
      // Handle middle initials or suffixes - e.g., "R.J. Hampshire" vs "RJ Hampshire"
      const normalizedScx = scxName.replace(/\./g, "").toLowerCase();
      const normalizedDb = rider.name.replace(/\./g, "").toLowerCase();
      if (normalizedScx === normalizedDb) return rider;
    }

    return null;
  }

  try {
    // Step 1: Fetch event page to get race links
    const eventRaces = await fetchEventRaces(eventId);

    if (eventRaces.length === 0) {
      return NextResponse.json({ error: "No races found on event page" }, { status: 400 });
    }

    // Step 2: Fetch results for each race type
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

      // Heat race winners get bonus points
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

      // LCQ winners get bonus points
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

    // Note: Holeshot info is only available in the PDF results (marked as "(HS)")
    // and cannot be reliably detected from the HTML position data.
    // The admin should set holeshots manually via "Edit Results" after importing.
    importLog.push("");
    importLog.push("NOTE: Holeshot bonuses must be set manually via Edit Results.");

    // Step 4: Save results to database
    const upsertResult = db.prepare(
      `INSERT INTO race_results (race_id, rider_id, position, points)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(race_id, rider_id) DO UPDATE SET position = ?, points = ?`
    );

    const upsertBonus = db.prepare(
      `INSERT INTO race_bonuses (race_id, rider_id, bonus_type, points)
       VALUES (?, ?, ?, 1)
       ON CONFLICT(race_id, rider_id, bonus_type) DO UPDATE SET points = 1`
    );

    const deleteOldBonuses = db.prepare("DELETE FROM race_bonuses WHERE race_id = ?");

    let resultsImported = 0;

    db.transaction(() => {
      // Import main event results
      for (const main of mainResults) {
        for (let i = 0; i < main.results.length; i++) {
          const position = i + 1;
          const riderName = main.results[i];
          const rider = findRider(riderName);
          if (rider) {
            const pts = getPointsForPosition(position);
            upsertResult.run(raceId, rider.id, position, pts, position, pts);
            resultsImported++;
          } else {
            importLog.push(`WARNING: Could not match "${riderName}" (P${position}) to any rider in database`);
          }
        }
      }

      // Clear old bonuses and insert new ones
      deleteOldBonuses.run(raceId);
      for (const bonus of bonuses) {
        upsertBonus.run(raceId, bonus.riderId, bonus.type);
      }
    })();

    // Mark race as completed
    db.prepare("UPDATE races SET status = 'completed' WHERE id = ?").run(raceId);

    return NextResponse.json({
      success: true,
      resultsImported,
      bonuses: bonuses.length,
      log: importLog,
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
