import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET /api/news — get all news items + latest injury statuses for riders
export async function GET() {
  // Get news articles
  const { data: newsItems } = await supabase
    .from("news_items")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(50);

  // Get latest injury status for each rider (most recent entry per rider_name)
  const { data: injuries } = await supabase
    .from("rider_injuries")
    .select("*, news_items(title, link)")
    .order("created_at", { ascending: false });

  // Deduplicate to latest status per rider name
  const latestByRider = new Map<string, Record<string, unknown>>();
  for (const injury of injuries || []) {
    const key = (injury.rider_name as string).toLowerCase();
    if (!latestByRider.has(key)) {
      latestByRider.set(key, injury);
    }
  }

  // Get riders currently marked as out
  const { data: outRiders } = await supabase
    .from("riders")
    .select("id, name, number, team, class")
    .eq("status", "out");

  return NextResponse.json({
    news: newsItems || [],
    outRiders: outRiders || [],
    injuries: Array.from(latestByRider.values()),
  });
}
