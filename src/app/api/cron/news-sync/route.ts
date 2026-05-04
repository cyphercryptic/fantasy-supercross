import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const RSS_URL = "https://racerxonline.com/feeds/rss/posts";

// Strip CDATA wrappers
function clean(text: string | undefined): string {
  if (!text) return "";
  return text
    .replace(/^\s*<!\[CDATA\[/, "")
    .replace(/\]\]>\s*$/, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .trim();
}

// Strip URL tracking params (utm_*, fbclid, etc.) so dedupe by link works reliably
function normalizeLink(url: string): string {
  try {
    const u = new URL(url);
    const toDelete: string[] = [];
    u.searchParams.forEach((_, key) => {
      if (key.startsWith("utm_") || key === "fbclid" || key === "gclid") {
        toDelete.push(key);
      }
    });
    toDelete.forEach((k) => u.searchParams.delete(k));
    return u.toString();
  } catch {
    return url;
  }
}

interface ParsedItem {
  title: string;
  description: string;
  link: string;
  image_url: string | null;
  author: string | null;
  published_at: string | null;
  category: string | null;
}

function parseRss(xml: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];

    const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/);
    const descMatch = block.match(/<description>([\s\S]*?)<\/description>/);
    const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/);
    const guidMatch = block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/);
    const pubMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const catMatch = block.match(/<category>([\s\S]*?)<\/category>/);
    const creatorMatch = block.match(/<dc:creator>([\s\S]*?)<\/dc:creator>/);
    const mediaMatch = block.match(/<media:content[^>]*url="([^"]+)"/);

    const rawLink = clean(linkMatch?.[1] || guidMatch?.[1]);
    if (!rawLink) continue;

    const pubDateRaw = clean(pubMatch?.[1]);
    let publishedISO: string | null = null;
    if (pubDateRaw) {
      const parsed = new Date(pubDateRaw);
      if (!isNaN(parsed.getTime())) publishedISO = parsed.toISOString();
    }

    items.push({
      title: clean(titleMatch?.[1]),
      description: clean(descMatch?.[1]),
      link: normalizeLink(rawLink),
      image_url: mediaMatch?.[1] || null,
      author: clean(creatorMatch?.[1]) || null,
      published_at: publishedISO,
      category: clean(catMatch?.[1]) || null,
    });
  }
  return items;
}

// GET /api/cron/news-sync — fetch Racer X RSS, upsert new items
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(RSS_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FantasySXBot/1.0)" },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `RSS fetch failed: ${res.status}` }, { status: 502 });
    }
    const xml = await res.text();
    const items = parseRss(xml);

    if (items.length === 0) {
      return NextResponse.json({ message: "No items found in RSS", inserted: 0 });
    }

    // Get existing links so we only insert new ones
    const links = items.map((i) => i.link);
    const { data: existing } = await supabase
      .from("news_items")
      .select("link")
      .in("link", links);
    const existingLinks = new Set((existing || []).map((e) => e.link));

    const newItems = items.filter((i) => !existingLinks.has(i.link));

    let inserted = 0;
    if (newItems.length > 0) {
      const { error } = await supabase.from("news_items").insert(
        newItems.map((i) => ({
          title: i.title,
          description: i.description || null,
          link: i.link,
          image_url: i.image_url,
          author: i.author,
          published_at: i.published_at,
          category: i.category,
        })),
      );
      if (error) {
        return NextResponse.json({ error: "Insert failed: " + error.message, found: items.length }, { status: 500 });
      }
      inserted = newItems.length;
    }

    return NextResponse.json({
      message: "News sync complete",
      found: items.length,
      existing: items.length - newItems.length,
      inserted,
      sample: newItems.slice(0, 5).map((i) => i.title),
    });
  } catch (err) {
    console.error("News sync cron error:", err);
    return NextResponse.json({ error: "News sync failed: " + (err as Error).message }, { status: 500 });
  }
}
