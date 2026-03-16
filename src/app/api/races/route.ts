import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getPointsForPosition } from "@/lib/scoring";

// GET /api/races — list races, optionally with results
export async function GET(req: NextRequest) {
  const db = getDb();
  const raceId = req.nextUrl.searchParams.get("id");

  if (raceId) {
    const race = db.prepare("SELECT * FROM races WHERE id = ?").get(raceId);
    const results = db
      .prepare(
        `SELECT rr.*, r.name as rider_name, r.number as rider_number, r.team as rider_team, r.class as rider_class
         FROM race_results rr
         JOIN riders r ON r.id = rr.rider_id
         WHERE rr.race_id = ?
         ORDER BY rr.position ASC`
      )
      .all(raceId);
    const bonuses = db
      .prepare(
        `SELECT rb.*, r.name as rider_name, r.number as rider_number
         FROM race_bonuses rb
         JOIN riders r ON r.id = rb.rider_id
         WHERE rb.race_id = ?`
      )
      .all(raceId);
    return NextResponse.json({ race, results, bonuses });
  }

  const races = db.prepare("SELECT * FROM races ORDER BY round_number ASC").all();
  return NextResponse.json(races);
}

// POST /api/races — create race or submit results
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.is_admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const db = getDb();

  // Submit race results
  if (body.action === "results") {
    const { raceId, results, bonuses } = body;
    if (!raceId || !Array.isArray(results)) {
      return NextResponse.json({ error: "raceId and results required" }, { status: 400 });
    }

    const upsert = db.prepare(
      `INSERT INTO race_results (race_id, rider_id, position, points)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(race_id, rider_id) DO UPDATE SET position = ?, points = ?`
    );

    const upsertBonus = db.prepare(
      `INSERT INTO race_bonuses (race_id, rider_id, bonus_type, points)
       VALUES (?, ?, ?, 1)
       ON CONFLICT(race_id, rider_id, bonus_type) DO UPDATE SET points = 1`
    );

    const deleteOldBonuses = db.prepare(
      `DELETE FROM race_bonuses WHERE race_id = ?`
    );

    db.transaction(() => {
      for (const item of results as { riderId: number; position: number }[]) {
        const pts = getPointsForPosition(item.position);
        upsert.run(raceId, item.riderId, item.position, pts, item.position, pts);
      }

      // Clear old bonuses and insert new ones
      deleteOldBonuses.run(raceId);
      if (Array.isArray(bonuses)) {
        for (const bonus of bonuses as { riderId: number; type: string }[]) {
          if (bonus.riderId) {
            upsertBonus.run(raceId, bonus.riderId, bonus.type);
          }
        }
      }
    })();

    db.prepare("UPDATE races SET status = 'completed' WHERE id = ?").run(raceId);
    return NextResponse.json({ success: true });
  }

  // Create race
  const { name, round_number, date, location, race_time, event_id } = body;
  if (!name) {
    return NextResponse.json({ error: "Race name required" }, { status: 400 });
  }
  const result = db
    .prepare("INSERT INTO races (name, round_number, date, location, race_time, event_id) VALUES (?, ?, ?, ?, ?, ?)")
    .run(name, round_number || null, date || null, location || null, race_time || null, event_id || null);
  return NextResponse.json({ success: true, id: result.lastInsertRowid });
}

// PATCH /api/races — update race fields
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.is_admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const { id, race_time, event_id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "Race id required" }, { status: 400 });
  }
  const db = getDb();
  const updates: string[] = [];
  const values: (string | null)[] = [];
  if (race_time !== undefined) { updates.push("race_time = ?"); values.push(race_time || null); }
  if (event_id !== undefined) { updates.push("event_id = ?"); values.push(event_id || null); }
  if (updates.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }
  values.push(String(id));
  db.prepare(`UPDATE races SET ${updates.join(", ")} WHERE id = ?`).run(...values);
  return NextResponse.json({ success: true });
}

// DELETE /api/races
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.is_admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const { id } = await req.json();
  const db = getDb();
  db.prepare("DELETE FROM races WHERE id = ?").run(id);
  return NextResponse.json({ success: true });
}
