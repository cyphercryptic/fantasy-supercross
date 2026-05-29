"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface SeasonLeague {
  id: number;
  name: string;
  series: string;
  season_year: number | null;
  draft_status: string;
  max_members: number;
  member_count: number;
}

interface FranchiseGroup {
  id: number;
  name: string;
  created_at: string;
  leagues: SeasonLeague[];
}

const SERIES_LABELS: Record<string, string> = { sx: "SX", mx: "MX", smx: "SMX" };
const SERIES_COLORS: Record<string, string> = {
  sx: "bg-orange-100 text-orange-700",
  mx: "bg-green-100 text-green-700",
  smx: "bg-blue-100 text-blue-700",
};

function draftLabel(status: string) {
  if (status === "waiting") return "Waiting for members";
  if (status === "drafting") return "Draft in progress";
  return "Active";
}

function draftColor(status: string) {
  if (status === "waiting") return "bg-amber-100 text-amber-700";
  if (status === "drafting") return "bg-blue-100 text-blue-700";
  return "bg-emerald-100 text-emerald-700";
}

export default function FranchiseHistoryPage() {
  const { id } = useParams();
  const [franchise, setFranchise] = useState<FranchiseGroup | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/groups/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setFranchise(d);
      });
  }, [id]);

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-red-600">{error}</p>
        <Link href="/leagues" className="text-[#8A8A8A] text-sm mt-4 inline-block hover:underline">
          Back to leagues
        </Link>
      </div>
    );
  }

  if (!franchise) {
    return <div className="max-w-4xl mx-auto px-4 py-8 text-[#8A8A8A]">Loading...</div>;
  }

  const currentYear = new Date().getFullYear();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Link href="/leagues" className="text-[#8A8A8A] text-sm hover:underline">
          Leagues
        </Link>
        <span className="text-[#D4D0CB] mx-2">/</span>
        <span className="text-[#8A8A8A] text-sm">Franchise History</span>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1A1A1A] tracking-tight">{franchise.name}</h1>
        <p className="text-[#8A8A8A] text-sm mt-1">
          {franchise.leagues.length} season{franchise.leagues.length !== 1 ? "s" : ""} tracked
        </p>
      </div>

      {franchise.leagues.length === 0 ? (
        <div className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-8 text-center">
          <p className="text-[#8A8A8A]">No seasons linked to this franchise yet.</p>
          <p className="text-[#A0A0A0] text-sm mt-1">
            When you create a league, link it to this franchise to track history.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {franchise.leagues.map((league) => {
            const year = league.season_year ?? currentYear;
            const isActive = league.draft_status !== "waiting";
            const isComplete = league.draft_status === "completed";
            const seriesKey = league.series ?? "sx";

            return (
              <div
                key={league.id}
                className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center justify-center w-14 h-14 bg-[#1A1A1A] rounded-lg shrink-0">
                      <span className="text-white font-bold text-xs">{SERIES_LABELS[seriesKey] ?? seriesKey.toUpperCase()}</span>
                      <span className="text-white/60 font-mono text-xs">{year}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-[#1A1A1A] font-semibold text-lg">{league.name}</h2>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SERIES_COLORS[seriesKey] ?? "bg-gray-100 text-gray-700"}`}>
                          {SERIES_LABELS[seriesKey] ?? seriesKey.toUpperCase()} {year}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${draftColor(league.draft_status)}`}>
                          {draftLabel(league.draft_status)}
                        </span>
                        <span className="text-[#A0A0A0] text-xs">
                          {league.member_count}/{league.max_members} members
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 items-end shrink-0">
                    <Link
                      href={`/leagues/${league.id}`}
                      className="bg-[#1A1A1A] hover:bg-[#333333] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                    >
                      {isActive ? "Go to League" : "View League"}
                    </Link>
                    {isComplete && (
                      <Link
                        href={`/leagues/${league.id}/season-recap`}
                        className="bg-gradient-to-r from-[#C8A84E]/10 to-[#1A1A1A]/5 hover:from-[#C8A84E]/20 border border-[#C8A84E]/40 text-[#1A1A1A] px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap text-center"
                      >
                        Season Recap
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
