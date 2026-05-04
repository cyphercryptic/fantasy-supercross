import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET /api/riders/[id]/news — recent news items mentioning this rider
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const riderId = parseInt(id);
  if (isNaN(riderId)) {
    return NextResponse.json({ error: "Invalid rider id" }, { status: 400 });
  }

  // Get the rider's name to search by
  const { data: rider } = await supabase
    .from("riders")
    .select("id, name")
    .eq("id", riderId)
    .maybeSingle();
  if (!rider) {
    return NextResponse.json({ error: "Rider not found" }, { status: 404 });
  }

  const fullName = rider.name;
  // Strip trailing suffixes like "IV", "Jr", "Sr", "III" so name parts are real names
  const cleanName = fullName.replace(/\s+(I{2,3}V?|IV|VI{0,3}|Jr\.?|Sr\.?)\s*$/i, "").trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  const firstName = parts[0] || "";
  const lastName = parts[parts.length - 1] || "";

  // Find other riders sharing this last name — used to avoid false positives
  // (e.g. "Hunter Lawrence" matching a Jett Lawrence article via last-name only)
  const { data: sameLastName } = await supabase
    .from("riders")
    .select("id, name")
    .ilike("name", `%${lastName}`);
  const otherRidersWithSameLast = (sameLastName || [])
    .filter((r) => r.id !== rider.id && r.name.toLowerCase().endsWith(" " + lastName.toLowerCase()));
  const lastNameIsUnique = otherRidersWithSameLast.length === 0;

  // Pull recent news items and filter in-memory.
  const { data: allNews } = await supabase
    .from("news_items")
    .select("id, title, description, link, image_url, author, published_at, category")
    .order("published_at", { ascending: false })
    .limit(200);

  const fullLower = fullName.toLowerCase();
  const cleanLower = cleanName.toLowerCase();
  const firstLower = firstName.toLowerCase();
  const lastLower = lastName.toLowerCase();
  const isShortLast = lastLower.length < 5;
  const isSuffixLike = ["iv", "jr", "sr", "iii", "ii"].includes(lastLower);

  const matching = (allNews || []).filter((item) => {
    const haystack = `${item.title || ""} ${item.description || ""}`.toLowerCase();

    // 1. Exact full-name (or clean name without suffix) match — always safe
    if (haystack.includes(fullLower) || haystack.includes(cleanLower)) return true;

    // 2. Both first AND last name appear somewhere — safe even when last name is shared
    if (firstLower && lastLower && !isShortLast && !isSuffixLike) {
      if (haystack.includes(firstLower) && haystack.includes(lastLower)) return true;
    }

    // 3. Last-name only — only if no other rider shares it AND it's distinctive
    if (lastNameIsUnique && !isShortLast && !isSuffixLike && haystack.includes(lastLower)) {
      return true;
    }

    return false;
  });

  return NextResponse.json({
    rider: { id: rider.id, name: rider.name },
    news: matching.slice(0, 10),
  });
}
