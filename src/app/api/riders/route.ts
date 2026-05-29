import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/riders — list all riders
// ?series=mx returns only riders in that series with series-specific class/number/team
export async function GET(req: NextRequest) {
  const series = req.nextUrl.searchParams.get("series");

  if (series && series !== "sx") {
    const { data } = await supabase
      .from("rider_series")
      .select("rider_id, class, number, team, status, riders(id, name)")
      .eq("series", series)
      .order("number", { ascending: true, nullsFirst: false });
    return NextResponse.json(
      (data || []).map((rs) => {
        const r = rs.riders as unknown as { id: number; name: string };
        return { id: r.id, name: r.name, class: rs.class, number: rs.number, team: rs.team, status: rs.status };
      })
    );
  }

  const { data: riders } = await supabase
    .from("riders")
    .select("*")
    .order("number", { ascending: true });
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
    const toInsert = body.riders
      .filter((r: { name: string }) => r.name)
      .map((r: { name: string; number: number; team: string; class: string }) => ({
        name: r.name,
        number: r.number || null,
        team: r.team || null,
        class: r.class || "450",
      }));

    if (toInsert.length > 0) {
      await supabase.from("riders").insert(toInsert);
    }
    return NextResponse.json({ success: true, imported: toInsert.length });
  }

  // Single rider
  const { name, number, team, class: riderClass } = body;
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const { data } = await supabase
    .from("riders")
    .insert({ name, number: number || null, team: team || null, class: riderClass || "450" })
    .select("id")
    .single();
  return NextResponse.json({ success: true, id: data!.id });
}

// DELETE /api/riders — delete a rider
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.is_admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const { id } = await req.json();
  await supabase.from("riders").delete().eq("id", id);
  return NextResponse.json({ success: true });
}
