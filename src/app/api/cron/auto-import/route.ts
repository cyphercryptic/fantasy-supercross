import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getPointsForPosition } from "@/lib/scoring";
import { RIDER_ALIASES } from "@/lib/rider-aliases";

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

    // Quick check: is there any upcoming race today? If not, bail immediately.
    const { data: todaysRaces } = await supabase
      .from("races")
      .select("id")
      .eq("status", "upcoming")
      .eq("date", todayStr);

    // Also check for races from yesterday that might not have been imported yet
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const { data: yesterdaysRaces } = await supabase
      .from("races")
      .select("id")
      .eq("status", "upcoming")
      .eq("date", yesterdayStr);

    const hasRecentRace = (todaysRaces?.length || 0) > 0 || (yesterdaysRaces?.length || 0) > 0;
    if (!hasRecentRace) {
      return NextResponse.json({ message: "No race today — skipping", processed: 0 });
    }

    // Get all upcoming races with event IDs whose date has passed
    const { data: allUpcoming } = await supabase
      .from("races")
      .select("*")
      .eq("status", "upcoming")
      .not("event_id", "is", null);

    // Filter to races whose race_time or date has passed
    const pendingRaces = (allUpcoming || []).filter((race) => {
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
      // Check aliases first (e.g., "Max Vohland" → "Maximus Vohland")
      const aliasName = RIDER_ALIASES[scxName] || scxName;
      const exact = riders.find((r) => r.name.toLowerCase() === aliasName.toLowerCase());
      if (exact) return exact;
      for (const rider of riders) {
        const normalizedScx = aliasName.replace(/\./g, "").toLowerCase();
        const normalizedDb = rider.name.replace(/\./g, "").toLowerCase();
        if (normalizedScx === normalizedDb) return rider;
      }
      return null;
    }

    const results: { raceId: number; raceName: string; status: string; resultsImported: number; bonusCount: number }[] = [];

    for (const race of pendingRaces) {
      try {
        const eventRaces = await fetchEventRaces(race.event_id);

        // Check if main event results are available yet
        const hasMainResults = eventRaces.some(
          (r) => r.type === "main_450" || r.type === "main_250"
        );

        if (!hasMainResults) {
          // Results not posted yet — skip this race, try again next cron run
          results.push({
            raceId: race.id,
            raceName: race.name,
            status: "waiting",
            resultsImported: 0,
            bonusCount: 0,
          });
          continue;
        }

        // Process results — same logic as manual import
        const mainResults: { type: string; results: string[] }[] = [];
        const bonuses: { riderId: number; type: string }[] = [];

        for (const eventRace of eventRaces) {
          const finishOrder = eventRace.isOverall
            ? await fetchOverallResults(eventRace.url)
            : await fetchRaceResults(eventRace.url);

          if (finishOrder.length === 0) continue;

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
            }
          }

          if (eventRace.type === "lcq_250" || eventRace.type === "lcq_450") {
            const winnerName = finishOrder[0];
            const winner = findRider(winnerName);
            if (winner) {
              const classPrefix = eventRace.type === "lcq_450" ? "450" : "250";
              bonuses.push({ riderId: winner.id, type: `lcq_${classPrefix}` });
            }
          }
        }

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
                race_id: race.id,
                rider_id: rider.id,
                position,
                points: getPointsForPosition(position),
              });
              resultsImported++;
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

        results.push({
          raceId: race.id,
          raceName: race.name,
          status: "imported",
          resultsImported,
          bonusCount: bonuses.length,
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
