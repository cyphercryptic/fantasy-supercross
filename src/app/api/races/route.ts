import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { getPointsForPosition } from "@/lib/scoring";

export const dynamic = "force-dynamic";

// GET /api/races — list races, optionally with results
export async function GET(req: NextRequest) {
  const raceId = req.nextUrl.searchParams.get("id");

  if (raceId) {
    const { data: race } = await supabase.from("races").select("*").eq("id", raceId).single();

    const { data: rawResults } = await supabase
      .from("race_results")
      .select("*, riders(name, number, team, class)")
      .eq("race_id", raceId)
      .order("position", { ascending: true });

    const results = (rawResults || []).map((r) => ({
      id: r.id, race_id: r.race_id, rider_id: r.rider_id, position: r.position, points: r.points,
      rider_name: (r.riders as unknown as unknown as Record<string, unknown>)?.name,
      rider_number: (r.riders as unknown as unknown as Record<string, unknown>)?.number,
      rider_team: (r.riders as unknown as unknown as Record<string, unknown>)?.team,
      rider_class: (r.riders as unknown as unknown as Record<string, unknown>)?.class,
    }));

    const { data: rawBonuses } = await supabase
      .from("race_bonuses")
      .select("*, riders(name, number)")
      .eq("race_id", raceId);

    const bonuses = (rawBonuses || []).map((b) => ({
      id: b.id, race_id: b.race_id, rider_id: b.rider_id, bonus_type: b.bonus_type, points: b.points,
      rider_name: (b.riders as unknown as unknown as Record<string, unknown>)?.name,
      rider_number: (b.riders as unknown as unknown as Record<string, unknown>)?.number,
    }));

    // riders.class/number/team are stale SX values — override from rider_series
    // for non-SX races so the schedule's 450/250 result buckets are right.
    if (race && race.series !== "sx") {
      const ids = [...new Set([...results.map((r) => r.rider_id), ...bonuses.map((b) => b.rider_id)])];
      if (ids.length > 0) {
        const { data: seriesRows } = await supabase
          .from("rider_series")
          .select("rider_id, class, number, team")
          .eq("series", race.series)
          .in("rider_id", ids);
        const map = new Map((seriesRows || []).map((s) => [s.rider_id, s]));
        for (const r of results) {
          const s = map.get(r.rider_id);
          if (s) {
            r.rider_class = s.class;
            if (s.number != null) r.rider_number = s.number;
            if (s.team != null) r.rider_team = s.team;
          }
        }
        for (const b of bonuses) {
          const s = map.get(b.rider_id);
          if (s && s.number != null) b.rider_number = s.number;
        }
      }
    }

    return NextResponse.json({ race, results, bonuses });
  }

  const series = req.nextUrl.searchParams.get("series");
  let query = supabase.from("races").select("*").order("round_number", { ascending: true });
  if (series) query = query.eq("series", series);
  const { data: races } = await query;
  return NextResponse.json(races);
}

// POST /api/races — create race or submit results
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.is_admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json();

  // Submit race results
  if (body.action === "results") {
    const { raceId, results, bonuses } = body;
    if (!raceId || !Array.isArray(results)) {
      return NextResponse.json({ error: "raceId and results required" }, { status: 400 });
    }

    const upsertData = (results as { riderId: number; position: number }[]).map((item) => ({
      race_id: raceId,
      rider_id: item.riderId,
      position: item.position,
      points: getPointsForPosition(item.position),
    }));
    await supabase.from("race_results").upsert(upsertData, { onConflict: "race_id,rider_id" });

    await supabase.from("race_bonuses").delete().eq("race_id", raceId);
    if (Array.isArray(bonuses)) {
      const bonusData = (bonuses as { riderId: number; type: string }[])
        .filter((b) => b.riderId)
        .map((b) => ({ race_id: raceId, rider_id: b.riderId, bonus_type: b.type, points: 1 }));
      if (bonusData.length > 0) {
        await supabase.from("race_bonuses").insert(bonusData);
      }
    }

    await supabase.from("races").update({ status: "completed" }).eq("id", raceId);
    return NextResponse.json({ success: true });
  }

  // Create race
  const { name, round_number, date, location, race_time, event_id } = body;
  if (!name) {
    return NextResponse.json({ error: "Race name required" }, { status: 400 });
  }
  const { data } = await supabase
    .from("races")
    .insert({
      name,
      round_number: round_number || null,
      date: date || null,
      location: location || null,
      race_time: race_time || null,
      event_id: event_id || null,
    })
    .select("id")
    .single();
  return NextResponse.json({ success: true, id: data!.id });
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
  const updates: Record<string, unknown> = {};
  if (race_time !== undefined) updates.race_time = race_time || null;
  if (event_id !== undefined) updates.event_id = event_id || null;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }
  await supabase.from("races").update(updates).eq("id", id);
  return NextResponse.json({ success: true });
}

// DELETE /api/races
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.is_admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const { id } = await req.json();
  await supabase.from("races").delete().eq("id", id);
  return NextResponse.json({ success: true });
}
