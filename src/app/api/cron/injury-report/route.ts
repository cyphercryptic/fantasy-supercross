import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { RIDER_ALIASES } from "@/lib/rider-aliases";

export const dynamic = "force-dynamic";

interface RSSItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  imageUrl: string | null;
  author: string | null;
}

function parseRSSItems(xml: string): RSSItem[] {
  const items: RSSItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const content = match[1];

    const getTag = (tag: string): string => {
      // Handle CDATA
      const cdataMatch = content.match(new RegExp(`<${tag}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, "i"));
      if (cdataMatch) return cdataMatch[1].trim();
      const simpleMatch = content.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
      return simpleMatch ? simpleMatch[1].trim() : "";
    };

    const imageMatch = content.match(/url="([^"]+)"/);

    // Clean utm params from link
    const rawLink = getTag("link");
    const cleanLink = rawLink.split("?")[0];

    items.push({
      title: getTag("title"),
      description: getTag("description"),
      link: cleanLink,
      pubDate: getTag("pubDate"),
      imageUrl: imageMatch ? imageMatch[1] : null,
      author: getTag("dc:creator") || null,
    });
  }

  return items;
}

// Parse injury titles like "Detroit SX Injury Report: Sexton, Ferrandis, In; Park, Brown, Out"
function parseInjuryStatus(title: string): { inRiders: string[]; outRiders: string[]; raceName: string } {
  const inRiders: string[] = [];
  const outRiders: string[] = [];

  // Extract race name (everything before "Injury Report" or ":")
  const raceMatch = title.match(/^(.+?)\s*(?:SX\s*)?Injury Report/i);
  const raceName = raceMatch ? raceMatch[1].trim() : "";

  // Get the part after the colon
  const colonIdx = title.indexOf(":");
  if (colonIdx === -1) return { inRiders, outRiders, raceName };
  const statusPart = title.slice(colonIdx + 1).trim();

  // Split by semicolons to get groups
  const groups = statusPart.split(";").map((g) => g.trim());

  for (const group of groups) {
    const isOut = /\bout\b/i.test(group);
    const isIn = /\bin\b/i.test(group);

    // Remove "In", "Out", and common filler words at the end
    const cleaned = group
      .replace(/,?\s*\b(In|Out)\b\s*$/i, "")
      .replace(/,?\s*\b(In|Out)\b\s*,/gi, ",")
      .trim();

    // Split by comma and clean each name
    const names = cleaned
      .split(",")
      .map((n) => n.trim())
      .filter((n) => n.length > 1 && !/^(In|Out|for|Who|and|Is|Whos)$/i.test(n));

    if (isOut) {
      outRiders.push(...names);
    } else if (isIn) {
      inRiders.push(...names);
    }
  }

  return { inRiders, outRiders, raceName };
}

// GET /api/cron/injury-report — fetches Racer X injury RSS and updates rider statuses
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch Racer X injury report RSS feed
    const rssRes = await fetch("https://racerxonline.com/feeds/rss/category/injury-report", {
      next: { revalidate: 0 },
    });
    const rssXml = await rssRes.text();
    const rssItems = parseRSSItems(rssXml);

    if (rssItems.length === 0) {
      return NextResponse.json({ message: "No RSS items found", imported: 0 });
    }

    // Get all riders from DB for matching
    const { data: allRiders } = await supabase.from("riders").select("id, name");
    const riders = allRiders || [];

    function findRider(name: string) {
      const aliasName = RIDER_ALIASES[name] || name;
      // Try exact match
      const exact = riders.find((r) => r.name.toLowerCase() === aliasName.toLowerCase());
      if (exact) return exact;
      // Try normalized match (remove dots)
      const normalized = aliasName.replace(/\./g, "").toLowerCase();
      const normalizedMatch = riders.find((r) => r.name.replace(/\./g, "").toLowerCase() === normalized);
      if (normalizedMatch) return normalizedMatch;
      // Only try last name match if there's exactly ONE rider with that last name
      // (avoids matching "Jett Lawrence" to "Hunter Lawrence")
      const lastName = aliasName.split(" ").pop()?.toLowerCase();
      if (lastName && lastName.length > 2) {
        const lastNameMatches = riders.filter((r) => {
          const riderLast = r.name.split(" ").pop()?.toLowerCase();
          return riderLast === lastName;
        });
        if (lastNameMatches.length === 1) return lastNameMatches[0];
      }
      return null;
    }

    let newArticles = 0;
    let injuriesUpdated = 0;

    // Process oldest articles first so the most recent status wins
    const sortedItems = [...rssItems].reverse();

    for (const item of sortedItems) {
      // Check if already imported (by link)
      const { data: existing } = await supabase
        .from("news_items")
        .select("id")
        .eq("link", item.link)
        .maybeSingle();

      if (existing) {
        // Already processed — skip entirely to avoid re-applying stale statuses
        continue;
      }

      // Insert new article
      const { data: inserted, error } = await supabase
        .from("news_items")
        .insert({
          title: item.title,
          description: item.description,
          link: item.link,
          image_url: item.imageUrl,
          author: item.author,
          published_at: new Date(item.pubDate).toISOString(),
          category: "injury-report",
        })
        .select("id")
        .single();

      if (error || !inserted) continue;
      const newsItemId = inserted.id;
      newArticles++;

      // Parse rider statuses from title
      const { inRiders, outRiders, raceName } = parseInjuryStatus(item.title);

      // Process OUT riders
      for (const name of outRiders) {
        const rider = findRider(name);

        await supabase.from("rider_injuries").insert({
          rider_id: rider?.id || null,
          rider_name: name,
          status: "out",
          race_name: raceName,
          news_item_id: newsItemId,
        });

        if (rider) {
          await supabase.from("riders").update({ status: "out" }).eq("id", rider.id);
          injuriesUpdated++;
        }
      }

      // Process IN riders (returning from injury)
      for (const name of inRiders) {
        const rider = findRider(name);

        await supabase.from("rider_injuries").insert({
          rider_id: rider?.id || null,
          rider_name: name,
          status: "active",
          race_name: raceName,
          news_item_id: newsItemId,
        });

        if (rider) {
          await supabase.from("riders").update({ status: "active" }).eq("id", rider.id);
          injuriesUpdated++;
        }
      }
    }

    return NextResponse.json({
      message: "Injury report sync complete",
      newArticles,
      injuriesUpdated,
      totalFeedItems: rssItems.length,
    });
  } catch (err) {
    console.error("Injury report cron error:", err);
    return NextResponse.json(
      { error: "Injury report sync failed: " + (err as Error).message },
      { status: 500 }
    );
  }
}
