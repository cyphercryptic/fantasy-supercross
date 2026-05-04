"use client";

import { isTripleCrown, get250Region, type RaceRegion } from "@/lib/race-region";

export function TripleCrownBadge({ faded }: { faded?: boolean }) {
  return (
    <span
      className={`bg-amber-100 text-amber-700 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${faded ? "opacity-60" : ""}`}
      title="Triple Crown — 3 main events, scoring based on combined finish"
    >
      <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1l2.5 3.5L14 3l-1.5 5H3.5L2 3l3.5 1.5L8 1z" />
        <rect x="3" y="9" width="10" height="2.5" rx="0.5" />
      </svg>
      Triple Crown
    </span>
  );
}

export function ShowdownBadge({ faded }: { faded?: boolean }) {
  return (
    <span
      className={`bg-purple-100 text-purple-700 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${faded ? "opacity-60" : ""}`}
      title="East/West Showdown — both 250 divisions race together"
    >
      <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 4 L5 12 M11 4 L11 12 M5 8 L11 8" />
      </svg>
      Showdown
    </span>
  );
}

export function RegionBadge({ region }: { region: RaceRegion }) {
  if (!region || region === "showdown") return null;
  if (region === "west") {
    return (
      <span className="bg-blue-100 text-blue-700 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
        250 West
      </span>
    );
  }
  return (
    <span className="bg-red-100 text-red-700 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
      250 East
    </span>
  );
}

// Convenience: render all relevant format badges for a round
export default function RaceFormatBadges({
  roundNumber,
  showRegion = true,
}: {
  roundNumber: number | null | undefined;
  showRegion?: boolean;
}) {
  const region = get250Region(roundNumber);
  const tc = isTripleCrown(roundNumber);
  const showdown = region === "showdown";
  if (!tc && !showdown && (!showRegion || !region)) return null;
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      {tc && <TripleCrownBadge />}
      {showdown && <ShowdownBadge />}
      {showRegion && !showdown && <RegionBadge region={region} />}
    </span>
  );
}
