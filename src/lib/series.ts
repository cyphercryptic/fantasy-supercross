// Series helpers for SX / MX / SMX. All MX work piggybacks on these so
// existing SX queries don't need to change unless they specifically opt in.

import { supabase } from "./supabase";

export type Series = "sx" | "mx" | "smx";

// Fetch a league's series. Defaults to 'sx' for older leagues without the column set.
export async function getLeagueSeries(leagueId: string | number): Promise<Series> {
  const { data } = await supabase
    .from("leagues")
    .select("series")
    .eq("id", leagueId)
    .maybeSingle();
  const series = (data?.series as Series) || "sx";
  return series;
}

// Get series-specific rider data (number, team, class, status).
// Falls back to the base riders table if no rider_series row exists yet
// (e.g., before the rider_series migration is applied or for unmapped riders).
export interface SeriesRider {
  id: number;
  name: string;
  number: number | null;
  team: string | null;
  class: string;
  status: string;
}

export async function getSeriesRiders(series: Series): Promise<SeriesRider[]> {
  // First try the rider_series overlay
  const { data: overlay } = await supabase
    .from("rider_series")
    .select("rider_id, series, class, number, team, status, riders(id, name)")
    .eq("series", series);

  if (overlay && overlay.length > 0) {
    return overlay.map((rs: Record<string, unknown>) => {
      const r = rs.riders as { id: number; name: string };
      return {
        id: r.id,
        name: r.name,
        number: (rs.number as number | null) ?? null,
        team: (rs.team as string | null) ?? null,
        class: rs.class as string,
        status: (rs.status as string) || "active",
      };
    });
  }

  // Fallback: rider_series table doesn't exist yet, or no rows. Use base riders.
  const { data: base } = await supabase
    .from("riders")
    .select("id, name, number, team, class, status");
  return (base || []).map((r) => ({
    id: r.id,
    name: r.name,
    number: r.number,
    team: r.team,
    class: r.class,
    status: r.status || "active",
  }));
}

// For known IDs only — same fallback behavior, scoped to a list.
export async function getSeriesRidersByIds(series: Series, riderIds: number[]): Promise<SeriesRider[]> {
  if (riderIds.length === 0) return [];
  const { data: overlay } = await supabase
    .from("rider_series")
    .select("rider_id, class, number, team, status, riders(id, name)")
    .eq("series", series)
    .in("rider_id", riderIds);

  const overlayMap = new Map<number, SeriesRider>();
  for (const rs of overlay || []) {
    const r = (rs as Record<string, unknown>).riders as { id: number; name: string } | null;
    if (!r) continue;
    overlayMap.set(r.id, {
      id: r.id,
      name: r.name,
      number: ((rs as Record<string, unknown>).number as number | null) ?? null,
      team: ((rs as Record<string, unknown>).team as string | null) ?? null,
      class: (rs as Record<string, unknown>).class as string,
      status: ((rs as Record<string, unknown>).status as string) || "active",
    });
  }

  // Anyone missing from overlay → fall back to base
  const missing = riderIds.filter((id) => !overlayMap.has(id));
  if (missing.length > 0) {
    const { data: base } = await supabase
      .from("riders")
      .select("id, name, number, team, class, status")
      .in("id", missing);
    for (const r of base || []) {
      overlayMap.set(r.id, {
        id: r.id,
        name: r.name,
        number: r.number,
        team: r.team,
        class: r.class,
        status: r.status || "active",
      });
    }
  }

  return riderIds.map((id) => overlayMap.get(id)).filter((x): x is SeriesRider => !!x);
}

// Pretty label for a series
export function seriesLabel(s: Series): string {
  if (s === "mx") return "Pro Motocross";
  if (s === "smx") return "SuperMotocross";
  return "Supercross";
}

// Short label (for badges)
export function seriesShortLabel(s: Series): string {
  return s.toUpperCase();
}
