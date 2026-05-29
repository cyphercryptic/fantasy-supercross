import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getPointsForPosition } from "@/lib/scoring";
import { RIDER_ALIASES } from "@/lib/rider-aliases";

export const dynamic = "force-dynamic";

interface ParsedRace {
  name: string;
  url: string;
  type: "heat_250" | "heat_450" | "lcq_250" | "lcq_450" | "main_250" | "main_450" | "moto1_250" | "moto1_450" | "moto2_250" | "moto2_450" | "other";
  heatNumber?: number;
  isOverall?: boolean;
}

// MX results use promotocross.com; SX uses supercrosslive.com — same URL structure, different domain
function getResultsBaseUrl(series: string): string {
  return series === "mx"
    ? "https://results.promotocross.com/results"
    : "https://results.supercrosslive.com/results";
}

function classifyRace(name: string, series?: string): ParsedRace["type"] {
  const n = name.toLowerCase();
  if (series === "mx") {
    if (n.includes("450") && /moto\s*1\b/i.test(n)) return "moto1_450";
    if (n.includes("450") && /moto\s*2\b/i.test(n)) return "moto2_450";
    if (n.includes("250") && /moto\s*1\b/i.test(n)) return "moto1_250";
    if (n.includes("250") && /moto\s*2\b/i.test(n)) return "moto2_250";
    if (n.includes("450") && n.includes("overall")) return "main_450";
    if (n.includes("250") && n.includes("overall")) return "main_250";
    return "other";
  }
  // SX
  if (n.includes("250") && n.includes("heat")) return "heat_250";
  if (n.includes("450") && n.includes("heat")) return "heat_450";
  if (n.includes("250") && n.includes("lcq")) return "lcq_250";
  if (n.includes("450") && n.includes("lcq")) return "lcq_450";
  // Triple Crown mains are named "Race #1", "Race #2", "Race #3"
  if (n.includes("250") && (n.includes("main") || n.includes("overall") || /\brace\s*#?\d/i.test(name))) return "main_250";
  if (n.includes("450") && (n.includes("main") || n.includes("overall") || /\brace\s*#?\d/i.test(name))) return "main_450";
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

async function fetchEventPageCity(eventId: string, baseUrl: string): Promise<string | null> {
  try {
    const res = await fetch(`${baseUrl}/?p=view_event&id=${eventId}`);
    const html = await res.text();
    const titleMatch = html.match(/<title>[^:]*::\s*([^<]+?)<\/title>/i);
    return titleMatch ? titleMatch[1].trim() : null;
  } catch {
    return null;
  }
}

async function fetchEventRaces(eventId: string, baseUrl: string, series?: string): Promise<ParsedRace[]> {
  const url = `${baseUrl}/?p=view_event&id=${eventId}`;
  const res = await fetch(url);
  const html = await res.text();

  const races: ParsedRace[] = [];
  const linkRegex = /href="\/results\/\?p=view_race_result(?:&amp;|&)id=(\d+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const rawContent = match[2].replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "").trim();
    if (!rawContent) continue;
    const raceType = classifyRace(rawContent, series);
    if (raceType !== "other") {
      races.push({
        name: rawContent,
        url: `${baseUrl}/?p=view_race_result&id=${match[1]}`,
        type: raceType,
        heatNumber: getHeatNumber(rawContent),
      });
    }
  }

  const overallRegex = /href="\/results\/\?p=view_multi_main_result(?:&amp;|&)id=(\d+)"[^>]*>([\s\S]*?)<\/a>/gi;
  while ((match = overallRegex.exec(html)) !== null) {
    const rawContent = match[2].replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "").trim();
    if (!rawContent) continue;
    const raceType = classifyRace(rawContent, series);
    if (raceType !== "other") {
      races.push({
        name: rawContent,
        url: `${baseUrl}/?p=view_multi_main_result&id=${match[1]}`,
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

async function fetchRaceResults(raceUrl: string, expectedCity?: string): Promise<{ names: string[]; holeshotRider: string | null; cityMismatch?: boolean }> {
  const res = await fetch(raceUrl);
  const html = await res.text();
  const names = parseDriverNames(html);

  // Verify the race page is for the expected city (supercrosslive sometimes has stale links)
  let cityMismatch = false;
  if (expectedCity) {
    const titleMatch = html.match(/<title>[^:]*::\s*([^:]+?)\s*::/i);
    if (titleMatch) {
      const pageCity = titleMatch[1].trim().toLowerCase();
      if (!pageCity.includes(expectedCity.toLowerCase()) && !expectedCity.toLowerCase().includes(pageCity)) {
        cityMismatch = true;
      }
    }
  }

  // Detect holeshot winner — find rider name directly adjacent to the Holeshot tag
  let holeshotRider: string | null = null;
  const holeRegex = /([A-Z][A-Z\s'.,-]+)\s*<small[^>]*class="driver_race_status"[^>]*>\s*Holeshot/i;
  const holeMatch = html.match(holeRegex);
  if (holeMatch) {
    holeshotRider = holeMatch[1].trim();
  }

  return { names, holeshotRider, cityMismatch };
}

// When event page links are stale, search for the correct race by scanning nearby IDs
async function findCorrectRaceId(staleId: string, expectedCity: string, raceType: string, baseUrl: string): Promise<string | null> {
  const baseId = parseInt(staleId);
  for (let offset = 1; offset <= 30; offset++) {
    for (const id of [baseId + offset, baseId - offset]) {
      try {
        const res = await fetch(`${baseUrl}/?p=view_race_result&id=${id}`);
        const html = await res.text();
        const titleMatch = html.match(/<title>[^:]*::\s*([^:]+?)\s*::\s*([^<]+)/i);
        if (!titleMatch) continue;
        const pageCity = titleMatch[1].trim().toLowerCase();
        const pageClass = titleMatch[2].trim().toLowerCase();
        const expectedClass = raceType.includes("450") ? "450" : "250";
        if (
          (pageCity.includes(expectedCity.toLowerCase()) || expectedCity.toLowerCase().includes(pageCity)) &&
          pageClass.includes(expectedClass)
        ) {
          return String(id);
        }
      } catch {
        continue;
      }
    }
  }
  return null;
}

// Auto-discover event ID from the series results page
async function discoverEventId(raceName: string, baseUrl: string): Promise<string | null> {
  try {
    const res = await fetch(`${baseUrl}/`);
    const html = await res.text();

    const titleMatch = html.match(/<title>[^:]*::\s*([^<]+)<\/title>/i);
    if (!titleMatch) return null;
    const currentCity = titleMatch[1].trim().toLowerCase();

    const eventIdMatch = html.match(/event_id=(\d+)/);
    if (!eventIdMatch) return null;
    const eventId = eventIdMatch[1];

    const raceCity = raceName.toLowerCase().trim();
    if (
      currentCity.includes(raceCity) ||
      raceCity.includes(currentCity) ||
      currentCity.replace(/\s+city/i, "") === raceCity.replace(/\s+city/i, "")
    ) {
      return eventId;
    }

    return null;
  } catch {
    return null;
  }
}

// GET /api/cron/auto-import — called by Vercel Cron to auto-import results
export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel sends Authorization: Bearer <CRON_SECRET>)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0]; // YYYY-MM-DD

    // Quick check: is there any upcoming race today or yesterday?
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const { data: recentUpcoming } = await supabase
      .from("races")
      .select("*")
      .eq("status", "upcoming")
      .or(`date.eq.${todayStr},date.eq.${yesterdayStr}`);

    if (!recentUpcoming || recentUpcoming.length === 0) {
      return NextResponse.json({ message: "No race today — skipping", processed: 0 });
    }

    // Auto-discover event IDs for races that don't have one,
    // and verify existing event_ids actually point to the correct city
    for (const race of recentUpcoming) {
      const baseUrl = getResultsBaseUrl(race.series || "sx");
      if (race.event_id) {
        const eventCity = await fetchEventPageCity(race.event_id, baseUrl);
        const raceCity = race.name.toLowerCase();
        const eventCityLower = eventCity?.toLowerCase() || "";
        const cityMatches =
          eventCityLower.includes(raceCity) ||
          raceCity.includes(eventCityLower) ||
          eventCityLower.replace(/\s+city/i, "") === raceCity.replace(/\s+city/i, "");
        if (!cityMatches) {
          race.event_id = null;
        }
      }
      if (!race.event_id) {
        const discoveredId = await discoverEventId(race.name, baseUrl);
        if (discoveredId) {
          await supabase.from("races").update({ event_id: discoveredId }).eq("id", race.id);
          race.event_id = discoveredId;
        }
      }
    }

    // Filter to races that have event IDs and whose time has passed
    const pendingRaces = recentUpcoming.filter((race) => {
      if (!race.event_id) return false;
      if (race.race_time) {
        return new Date(race.race_time) <= now;
      }
      if (race.date) {
        return race.date <= todayStr;
      }
      return false;
    });

    if (!pendingRaces || pendingRaces.length === 0) {
      return NextResponse.json({ message: "No races ready for auto-import", processed: 0 });
    }

    // Get all riders from our database
    const { data: allRiders } = await supabase
      .from("riders")
      .select("id, name, number, team, class");
    const riders = allRiders || [];

    function findRider(scxName: string) {
      // Check aliases first (e.g., "Max Vohland" → "Maximus Vohland") — case-insensitive
      const aliasKey = Object.keys(RIDER_ALIASES).find((k) => k.toLowerCase() === scxName.toLowerCase());
      const aliasName = aliasKey ? RIDER_ALIASES[aliasKey] : scxName;
      const exact = riders.find((r) => r.name.toLowerCase() === aliasName.toLowerCase());
      if (exact) return exact;
      for (const rider of riders) {
        const normalizedScx = aliasName.replace(/\./g, "").toLowerCase();
        const normalizedDb = rider.name.replace(/\./g, "").toLowerCase();
        if (normalizedScx === normalizedDb) return rider;
      }
      return null;
    }

    const results: { raceId: number; raceName: string; status: string; resultsImported: number; bonusCount: number; unmatchedCount?: number; unmatchedNames?: string[]; webhookError?: string }[] = [];

    for (const race of pendingRaces) {
      const series = (race.series || "sx") as string;
      const baseUrl = getResultsBaseUrl(series);
      const isMX = series === "mx";

      try {
        const eventRaces = await fetchEventRaces(race.event_id, baseUrl, series);

        // Check what results are available
        const hasMainResults = eventRaces.some((r) => r.type === "main_450" || r.type === "main_250");
        const hasOverallResults = eventRaces.some((r) => r.isOverall);
        const hasMotoResults = eventRaces.some((r) => r.type.startsWith("moto"));

        // SX Triple Crown: multiple mains per class
        const mainCount450 = eventRaces.filter((r) => r.type === "main_450").length;
        const mainCount250 = eventRaces.filter((r) => r.type === "main_250").length;
        const looksLikeTripleCrown = !isMX && (mainCount450 > 1 || mainCount250 > 1);

        // For MX: wait for overall before importing (motos are bonus-only)
        // For Triple Crown: same — wait for overall
        if (isMX && hasMotoResults && !hasOverallResults) {
          results.push({
            raceId: race.id,
            raceName: race.name,
            status: "waiting-mx-overall",
            resultsImported: 0,
            bonusCount: 0,
          });
          continue;
        }
        if (looksLikeTripleCrown && !hasOverallResults) {
          results.push({
            raceId: race.id,
            raceName: race.name,
            status: "waiting-triple-crown-overall",
            resultsImported: 0,
            bonusCount: 0,
          });
          continue;
        }

        if (!hasMainResults && !hasOverallResults && !hasMotoResults) {
          results.push({
            raceId: race.id,
            raceName: race.name,
            status: "waiting",
            resultsImported: 0,
            bonusCount: 0,
          });
          continue;
        }

        const mainResults: { type: string; results: string[] }[] = [];
        const overallResults: { type: string; results: string[] }[] = [];
        const individualMains: { type: string; results: string[]; name: string }[] = [];
        const bonuses: { riderId: number; type: string }[] = [];

        for (const eventRace of eventRaces) {
          let finishOrder: string[];
          let holeshotRider: string | null = null;

          if (eventRace.isOverall) {
            finishOrder = await fetchOverallResults(eventRace.url);
            if (finishOrder.length > 0) {
              overallResults.push({ type: eventRace.type, results: finishOrder });
            }
          } else {
            const result = await fetchRaceResults(eventRace.url, race.name);
            finishOrder = result.names;
            holeshotRider = result.holeshotRider;

            // If the race page is for the wrong city, try to find the correct one
            if (result.cityMismatch && (eventRace.type === "main_450" || eventRace.type === "main_250")) {
              const raceIdMatch = eventRace.url.match(/id=(\d+)/);
              if (raceIdMatch) {
                const correctId = await findCorrectRaceId(raceIdMatch[1], race.name, eventRace.type, baseUrl);
                if (correctId) {
                  const correctedUrl = `${baseUrl}/?p=view_race_result&id=${correctId}`;
                  const corrected = await fetchRaceResults(correctedUrl, race.name);
                  if (!corrected.cityMismatch && corrected.names.length > 0) {
                    finishOrder = corrected.names;
                    holeshotRider = corrected.holeshotRider;
                  }
                }
              }
            }
          }

          if (finishOrder.length === 0) continue;

          // MX motos: generate moto winner + holeshot bonuses, track for scoring fallback
          const isMoto1 = eventRace.type === "moto1_450" || eventRace.type === "moto1_250";
          const isMoto2 = eventRace.type === "moto2_450" || eventRace.type === "moto2_250";
          if (isMoto1 || isMoto2) {
            const classPrefix = (eventRace.type === "moto1_450" || eventRace.type === "moto2_450") ? "450" : "250";
            const motoNum = isMoto1 ? "1" : "2";
            // Store as individualMains so we can fall back to motos if overall never posts
            individualMains.push({ type: `main_${classPrefix}`, results: finishOrder, name: eventRace.name });

            const winner = findRider(finishOrder[0]);
            if (winner) bonuses.push({ riderId: winner.id, type: `moto${motoNum}_winner_${classPrefix}` });

            if (holeshotRider) {
              const hsRider = findRider(holeshotRider);
              if (hsRider) bonuses.push({ riderId: hsRider.id, type: `holeshot_moto${motoNum}_${classPrefix}` });
            }
          }

          // SX main events: holeshot bonuses
          if (eventRace.type === "main_450" || eventRace.type === "main_250") {
            individualMains.push({ type: eventRace.type, results: finishOrder, name: eventRace.name });

            if (holeshotRider) {
              const hsRider = findRider(holeshotRider);
              if (hsRider) {
                const classPrefix = eventRace.type === "main_450" ? "450" : "250";
                const existingCount = bonuses.filter((b) => b.type.startsWith(`holeshot_${classPrefix}`)).length;
                const suffix = existingCount > 0 ? `_${existingCount + 1}` : "";
                bonuses.push({ riderId: hsRider.id, type: `holeshot_${classPrefix}${suffix}` });
              }
            }
          }

          // SX heat winners
          if (eventRace.type === "heat_250" || eventRace.type === "heat_450") {
            const winner = findRider(finishOrder[0]);
            if (winner) {
              const heatNum = eventRace.heatNumber || 1;
              const classPrefix = eventRace.type === "heat_450" ? "450" : "250";
              bonuses.push({ riderId: winner.id, type: `heat${heatNum}_${classPrefix}` });
            }
          }

          // SX LCQ winners
          if (eventRace.type === "lcq_250" || eventRace.type === "lcq_450") {
            const winner = findRider(finishOrder[0]);
            if (winner) {
              const classPrefix = eventRace.type === "lcq_450" ? "450" : "250";
              bonuses.push({ riderId: winner.id, type: `lcq_${classPrefix}` });
            }
          }
        }

        // Use overall for scoring when available (MX always; Triple Crown when detected)
        const isTripleCrown = !isMX && (mainCount450 > 1 || mainCount250 > 1 || individualMains.some((m) => m.name.includes("#1") || m.name.includes("#2") || m.name.includes("#3")));
        if ((isMX || isTripleCrown) && overallResults.length > 0) {
          for (const overall of overallResults) {
            mainResults.push(overall);
          }
        } else {
          for (const main of individualMains) {
            mainResults.push(main);
          }
        }

        // Save results and track unmatched riders
        const upsertData: { race_id: number; rider_id: number; position: number; points: number }[] = [];
        const unmatchedRiders: { name: string; position: number; points: number; raceClass: string }[] = [];
        let resultsImported = 0;

        for (const main of mainResults) {
          const raceClass = main.type === "main_450" ? "450" : "250";
          for (let i = 0; i < main.results.length; i++) {
            const position = i + 1;
            const riderName = main.results[i];
            const rider = findRider(riderName);
            const pts = getPointsForPosition(position);
            if (rider) {
              upsertData.push({
                race_id: race.id,
                rider_id: rider.id,
                position,
                points: pts,
              });
              resultsImported++;
            } else if (pts > 0) {
              unmatchedRiders.push({ name: riderName, position, points: pts, raceClass });
            }
          }
        }

        if (upsertData.length > 0) {
          await supabase.from("race_results").upsert(upsertData, { onConflict: "race_id,rider_id" });
        }

        // Clear old bonuses and insert new
        await supabase.from("race_bonuses").delete().eq("race_id", race.id);
        if (bonuses.length > 0) {
          const bonusData = bonuses.map((b) => ({
            race_id: race.id,
            rider_id: b.riderId,
            bonus_type: b.type,
            points: 1,
          }));
          await supabase.from("race_bonuses").insert(bonusData);
        }

        // Mark race as completed
        await supabase.from("races").update({ status: "completed" }).eq("id", race.id);

        // Notify via n8n webhook if there are unmatched riders who scored points
        let webhookError: string | undefined;
        if (unmatchedRiders.length > 0) {
          const webhookUrl = process.env.N8N_WEBHOOK_URL;
          if (webhookUrl) {
            try {
              const webhookRes = await fetch(webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  raceName: race.name,
                  raceDate: race.date,
                  unmatchedRiders,
                  message: `<h2>Fantasy SX: Unmatched Riders</h2><p>${unmatchedRiders.length} rider(s) scored points in <strong>${race.name}</strong> but are not in the database:</p><ul>${unmatchedRiders.map((r) => `<li><strong>${r.name}</strong> — P${r.position} in ${r.raceClass} class (${r.points} pts missed)</li>`).join("")}</ul>`,
                }),
              });
              if (!webhookRes.ok) {
                webhookError = `Webhook returned ${webhookRes.status}`;
                console.error(webhookError, await webhookRes.text());
              }
            } catch (err) {
              webhookError = (err as Error).message;
              console.error("Webhook notification failed:", err);
            }
          } else {
            webhookError = "N8N_WEBHOOK_URL not configured";
          }
        }

        results.push({
          raceId: race.id,
          raceName: race.name,
          status: "imported",
          resultsImported,
          bonusCount: bonuses.length,
          unmatchedCount: unmatchedRiders.length,
          ...(unmatchedRiders.length > 0 && {
            unmatchedNames: unmatchedRiders.map((r) => `${r.name} (P${r.position} ${r.raceClass})`),
          }),
          ...(webhookError && { webhookError }),
        });
      } catch (err) {
        results.push({
          raceId: race.id,
          raceName: race.name,
          status: `error: ${(err as Error).message}`,
          resultsImported: 0,
          bonusCount: 0,
        });
      }
    }

    return NextResponse.json({
      message: "Auto-import complete",
      processed: results.length,
      results,
    });
  } catch (err) {
    console.error("Auto-import cron error:", err);
    return NextResponse.json(
      { error: "Auto-import failed: " + (err as Error).message },
      { status: 500 }
    );
  }
}
