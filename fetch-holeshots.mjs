// Fetch holeshot data from supercrosslive.com HTML pages for all 9 rounds
// Run with: node fetch-holeshots.mjs

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, "fantasy-supercross.db"));

const EVENT_IDS = {
  1: "487830",   // Anaheim 1
  2: "492375",   // San Diego
  3: "493099",   // Anaheim 2
  4: "493648",   // Houston (Triple Crown)
  5: "494425",   // Glendale
  6: "495073",   // Seattle
  7: "495765",   // Arlington
  8: "496545",   // Daytona
  9: "497316",   // Indianapolis (Triple Crown)
};

const RACE_IDS = { 1: 1, 2: 2, 3: 3, 4: 18, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9 };

const ROUND_NAMES = {
  1: "Anaheim 1", 2: "San Diego", 3: "Anaheim 2", 4: "Houston",
  5: "Glendale", 6: "Seattle", 7: "Arlington", 8: "Daytona", 9: "Indianapolis"
};

const allRiders = db.prepare("SELECT id, name, number FROM riders").all();

function findRider(scxName) {
  for (const rider of allRiders) {
    if (rider.name.toLowerCase() === scxName.toLowerCase()) return rider;
    const normalizedScx = scxName.replace(/\./g, "").toLowerCase();
    const normalizedDb = rider.name.replace(/\./g, "").toLowerCase();
    if (normalizedScx === normalizedDb) return rider;
  }
  return null;
}

// Get all race result page IDs from an event page (mains only)
async function getMainEventLinks(eventId) {
  const url = `https://results.supercrosslive.com/results/?p=view_event&id=${eventId}`;
  const res = await fetch(url);
  const html = await res.text();
  const races = [];

  const linkRegex = /href="\/results\/\?p=view_race_result(?:&amp;|&)id=(\d+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const rawContent = match[2].replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "").trim();
    if (!rawContent) continue;
    const n = rawContent.toLowerCase();

    // Main events
    if ((n.includes("250") || n.includes("450")) && (n.includes("main") || n.includes("race"))) {
      const cls = n.includes("450") ? "450" : "250";
      // Check for Triple Crown race number
      const tcMatch = rawContent.match(/Race\s*#?\s*(\d)/i);
      races.push({
        raceResultId: match[1],
        name: rawContent,
        cls,
        tcRace: tcMatch ? parseInt(tcMatch[1]) : null,
      });
    }
  }

  return races;
}

// Fetch a race result page and look for "Holeshot" badge
async function getHoleshotFromPage(raceResultId) {
  const url = `https://results.supercrosslive.com/results/?p=view_race_result&id=${raceResultId}`;
  const res = await fetch(url);
  const html = await res.text();

  // The screenshot shows "HUNTER LAWRENCE Holeshot" as a badge next to the rider name
  // Look for the rider name that has "Holeshot" near it
  // Pattern: ▸ RIDER NAME <span...>Holeshot</span> or similar
  // Try multiple patterns

  // Pattern 1: "RIDER NAME" followed by Holeshot badge/text
  const holeshotMatch = html.match(/▸\s*([A-Z][A-Z\s.'-]+?)\s*<[^>]*>?\s*Holeshot/i)
    || html.match(/►\s*([A-Z][A-Z\s.'-]+?)\s*<[^>]*>?\s*Holeshot/i)
    || html.match(/>([A-Z][A-Z\s.'-]+?)\s*<[^>]*>\s*Holeshot/i)
    || html.match(/>\s*([A-Z][A-Z\s.'-]+?)\s*<span[^>]*>\s*Holeshot\s*<\/span>/i)
    || html.match(/([A-Z]{2,}[\s.'-]+[A-Z]{2,}(?:[\s.'-]+[A-Z]+)*)\s*(?:<[^>]*>)*\s*Holeshot/i);

  if (holeshotMatch) {
    let name = holeshotMatch[1].trim();
    // Clean up any remaining HTML entities or symbols
    name = name.replace(/[▸►]/g, "").trim();
    return name;
  }

  // Pattern 2: Look for "Holeshot" anywhere and find the nearest rider name
  if (html.includes("Holeshot") || html.includes("holeshot")) {
    // Get the surrounding context
    const idx = html.indexOf("Holeshot");
    if (idx === -1) return null;
    const context = html.substring(Math.max(0, idx - 300), idx + 50);
    // Find the last rider name before Holeshot
    const nameMatch = context.match(/([A-Z][A-Z]+\s+[A-Z][A-Z]+(?:\s+[A-Z]+)*)\s*(?:<[^>]*>)*\s*$/);
    if (nameMatch) {
      return nameMatch[1].trim();
    }
  }

  return null;
}

const upsertBonus = db.prepare(
  `INSERT INTO race_bonuses (race_id, rider_id, bonus_type, points)
   VALUES (?, ?, ?, 1)
   ON CONFLICT(race_id, rider_id, bonus_type) DO UPDATE SET points = 1`
);

let totalHoleshots = 0;

for (let round = 1; round <= 9; round++) {
  const eventId = EVENT_IDS[round];
  const raceId = RACE_IDS[round];
  console.log(`\n========== Round ${round}: ${ROUND_NAMES[round]} ==========`);

  const mainEvents = await getMainEventLinks(eventId);
  console.log(`  Found ${mainEvents.length} main event pages`);

  for (const race of mainEvents) {
    const holeshotName = await getHoleshotFromPage(race.raceResultId);

    if (holeshotName) {
      const rider = findRider(holeshotName);
      if (rider) {
        const bonusType = race.tcRace
          ? `holeshot_${race.cls}_race${race.tcRace}`
          : `holeshot_${race.cls}`;
        upsertBonus.run(raceId, rider.id, bonusType);
        console.log(`  ✓ ${race.name}: ${holeshotName} (#${rider.number}) → ${bonusType}`);
        totalHoleshots++;
      } else {
        console.log(`  ⚠ ${race.name}: ${holeshotName} — NOT FOUND in database`);
      }
    } else {
      console.log(`  ✗ ${race.name}: No holeshot found in HTML`);
    }
  }
}

console.log(`\n========== DONE: ${totalHoleshots} holeshots imported ==========`);
db.close();
