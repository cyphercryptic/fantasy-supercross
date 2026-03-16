// Re-import all 9 completed rounds from supercrosslive.com
// Run with: node import-all.mjs

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, "fantasy-supercross.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Event IDs from supercrosslive.com
const ROUNDS = [
  { round: 1, raceId: 1, eventId: "487830", name: "Anaheim 1" },
  { round: 2, raceId: 2, eventId: "492375", name: "San Diego" },
  { round: 3, raceId: 3, eventId: "493099", name: "Anaheim 2" },
  { round: 4, raceId: 18, eventId: "493648", name: "Houston" },
  { round: 5, raceId: 5, eventId: "494425", name: "Glendale" },
  { round: 6, raceId: 6, eventId: "495073", name: "Seattle" },
  { round: 7, raceId: 7, eventId: "495765", name: "Arlington" },
  { round: 8, raceId: 8, eventId: "496545", name: "Daytona" },
  { round: 9, raceId: 9, eventId: "497316", name: "Indianapolis" },
];

// Points table
const POINTS_TABLE = {
  1: 10, 2: 8, 3: 7, 4: 6, 5: 5, 6: 4, 7: 4, 8: 3, 9: 3, 10: 3,
  11: 2, 12: 2, 13: 2, 14: 2, 15: 1, 16: 1, 17: 1, 18: 1, 19: 1, 20: 1, 21: 1, 22: 1,
};
function getPointsForPosition(pos) { return POINTS_TABLE[pos] ?? 0; }

// Get all riders
const allRiders = db.prepare("SELECT id, name, number, team, class FROM riders").all();

function findRider(scxName) {
  for (const rider of allRiders) {
    if (rider.name.toLowerCase() === scxName.toLowerCase()) return rider;
    const normalizedScx = scxName.replace(/\./g, "").toLowerCase();
    const normalizedDb = rider.name.replace(/\./g, "").toLowerCase();
    if (normalizedScx === normalizedDb) return rider;
  }
  return null;
}

function classifyRace(name) {
  const n = name.toLowerCase();
  if (n.includes("250") && n.includes("heat")) return "heat_250";
  if (n.includes("450") && n.includes("heat")) return "heat_450";
  if (n.includes("250") && n.includes("lcq")) return "lcq_250";
  if (n.includes("450") && n.includes("lcq")) return "lcq_450";
  if (n.includes("250") && (n.includes("main") || n.includes("overall"))) return "main_250";
  if (n.includes("450") && (n.includes("main") || n.includes("overall"))) return "main_450";
  return "other";
}

function getHeatNumber(name) {
  const match = name.match(/Heat\s*#?(\d)/i);
  return match ? parseInt(match[1]) : undefined;
}

function parseDriverNames(html) {
  const names = [];
  const regex = /driverNames\.push\('([^']+)'\)/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    names.push(match[1]);
  }
  return names;
}

async function fetchEventRaces(eventId) {
  const url = `https://results.supercrosslive.com/results/?p=view_event&id=${eventId}`;
  const res = await fetch(url);
  const html = await res.text();
  const races = [];

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

async function fetchOverallResults(raceUrl) {
  const res = await fetch(raceUrl);
  const html = await res.text();
  const names = [];
  const regex = /<td class="w-100 text-nowrap">\s*([^<]+?)\s*<\/td>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const name = m[1].trim();
    if (name && name !== "RIDER") names.push(name);
  }
  return names;
}

async function fetchRaceResults(raceUrl) {
  const res = await fetch(raceUrl);
  const html = await res.text();
  return parseDriverNames(html);
}

// Prepared statements
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
const deleteOldResults = db.prepare("DELETE FROM race_results WHERE race_id = ?");
const deleteOldBonuses = db.prepare("DELETE FROM race_bonuses WHERE race_id = ?");

const allUnmatched = [];

for (const round of ROUNDS) {
  console.log(`\n========== Round ${round.round}: ${round.name} ==========`);

  const eventRaces = await fetchEventRaces(round.eventId);
  console.log(`Found ${eventRaces.length} race categories`);

  const mainResults = [];
  const bonuses = [];
  const unmatched = [];

  for (const eventRace of eventRaces) {
    const finishOrder = eventRace.isOverall
      ? await fetchOverallResults(eventRace.url)
      : await fetchRaceResults(eventRace.url);

    if (finishOrder.length === 0) {
      console.log(`  No results for ${eventRace.name}`);
      continue;
    }

    console.log(`  ${eventRace.name}: ${finishOrder.length} riders`);

    if (eventRace.type === "main_450" || eventRace.type === "main_250") {
      mainResults.push({ type: eventRace.type, results: finishOrder });
    }

    // Heat winners
    if (eventRace.type === "heat_250" || eventRace.type === "heat_450") {
      const winnerName = finishOrder[0];
      const winner = findRider(winnerName);
      if (winner) {
        const heatNum = eventRace.heatNumber || 1;
        const classPrefix = eventRace.type === "heat_450" ? "450" : "250";
        bonuses.push({ riderId: winner.id, type: `heat${heatNum}_${classPrefix}` });
        console.log(`    Heat winner: ${winnerName} → heat${heatNum}_${classPrefix}`);
      } else {
        console.log(`    ⚠ UNMATCHED heat winner: "${winnerName}"`);
        unmatched.push(winnerName);
      }
    }

    // LCQ winners
    if (eventRace.type === "lcq_250" || eventRace.type === "lcq_450") {
      const winnerName = finishOrder[0];
      const winner = findRider(winnerName);
      if (winner) {
        const classPrefix = eventRace.type === "lcq_450" ? "450" : "250";
        bonuses.push({ riderId: winner.id, type: `lcq_${classPrefix}` });
        console.log(`    LCQ winner: ${winnerName} → lcq_${classPrefix}`);
      } else {
        console.log(`    ⚠ UNMATCHED LCQ winner: "${winnerName}"`);
        unmatched.push(winnerName);
      }
    }
  }

  // Save to DB
  let resultsImported = 0;

  db.transaction(() => {
    // Clear old data for this race
    deleteOldResults.run(round.raceId);
    deleteOldBonuses.run(round.raceId);

    for (const main of mainResults) {
      for (let i = 0; i < main.results.length; i++) {
        const position = i + 1;
        const riderName = main.results[i];
        const rider = findRider(riderName);
        if (rider) {
          const pts = getPointsForPosition(position);
          upsertResult.run(round.raceId, rider.id, position, pts, position, pts);
          resultsImported++;
        } else {
          unmatched.push(`${riderName} (P${position})`);
        }
      }
    }

    for (const bonus of bonuses) {
      upsertBonus.run(round.raceId, bonus.riderId, bonus.type);
    }
  })();

  // Mark completed
  db.prepare("UPDATE races SET status = 'completed' WHERE id = ?").run(round.raceId);

  console.log(`  ✓ ${resultsImported} results, ${bonuses.length} bonuses`);
  if (unmatched.length > 0) {
    console.log(`  ⚠ Unmatched: ${[...new Set(unmatched)].join(", ")}`);
    allUnmatched.push(...unmatched);
  }
}

console.log("\n========== SUMMARY ==========");
const uniqueUnmatched = [...new Set(allUnmatched)];
if (uniqueUnmatched.length > 0) {
  console.log(`Total unmatched names: ${uniqueUnmatched.length}`);
  for (const name of uniqueUnmatched) {
    console.log(`  - ${name}`);
  }
} else {
  console.log("All riders matched successfully!");
}

db.close();
