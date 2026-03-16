import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/riders — list all riders
export async function GET() {
  const db = getDb();
  const riders = db.prepare("SELECT * FROM riders ORDER BY number ASC").all();
  return NextResponse.json(riders);
}

// POST /api/riders — create rider or bulk CSV import
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.is_admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json();

  // Bulk CSV import
  if (body.bulk && Array.isArray(body.riders)) {
    const db = getDb();
    const insert = db.prepare(
      "INSERT OR REPLACE INTO riders (name, number, team, class) VALUES (?, ?, ?, ?)"
    );
    const transaction = db.transaction((riders: { name: string; number: number; team: string; class: string }[]) => {
      let count = 0;
      for (const r of riders) {
        if (r.name) {
          insert.run(r.name, r.number || null, r.team || null, r.class || "450");
          count++;
        }
      }
      return count;
    });
    const count = transaction(body.riders);
    return NextResponse.json({ success: true, imported: count });
  }

  // Single rider
  const { name, number, team, class: riderClass } = body;
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const db = getDb();
  const result = db
    .prepare("INSERT INTO riders (name, number, team, class) VALUES (?, ?, ?, ?)")
    .run(name, number || null, team || null, riderClass || "450");
  return NextResponse.json({ success: true, id: result.lastInsertRowid });
}

// DELETE /api/riders — delete a rider
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.is_admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const { id } = await req.json();
  const db = getDb();
  db.prepare("DELETE FROM riders WHERE id = ?").run(id);
  return NextResponse.json({ success: true });
}
