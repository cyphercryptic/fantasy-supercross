"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import TeamLogo from "@/components/TeamLogo";

interface RiderInfo {
  name: string;
  number: number | null;
  team: string | null;
  class: string;
}

interface ResultEntry {
  position: number;
  points: number;
  rider: RiderInfo | null;
}

interface BonusRider {
  id: number;
  name: string;
  number: number | null;
  team: string | null;
  class: string;
}

interface UserScoreRider {
  name: string;
  number: number | null;
  class: string;
  position: number | null;
  points: number;
  bonusPoints: number;
}

interface UserScore {
  user_id: number;
  username: string;
  total: number;
  riders: UserScoreRider[];
}

interface RecapData {
  race: {
    id: number;
    name: string;
    round_number: number | null;
    date: string | null;
    location: string | null;
    race_time: string | null;
    format: "triple_crown" | "showdown" | "regular";
  };
  navigation: { id: number; name: string; round_number: number | null }[];
  top450: ResultEntry[];
  top250: ResultEntry[];
  bonuses: {
    heat_450: { type: string; rider: BonusRider | null }[];
    heat_250: { type: string; rider: BonusRider | null }[];
    lcq_450: BonusRider | null;
    lcq_250: BonusRider | null;
    holeshots_450: (BonusRider | null)[];
    holeshots_250: (BonusRider | null)[];
  };
  userScores: UserScore[];
}

function PositionBadge({ position }: { position: number }) {
  const styles =
    position === 1
      ? "bg-amber-100 text-amber-700 border-amber-300"
      : position === 2
      ? "bg-slate-200 text-slate-700 border-slate-300"
      : position === 3
      ? "bg-orange-100 text-orange-700 border-orange-300"
      : "bg-[#EBE7E2] text-[#6B6B6B] border-[#D4D0CB]";
  return (
    <span className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold ${styles}`}>
      P{position}
    </span>
  );
}

function FormatBadge({ format }: { format: "triple_crown" | "showdown" | "regular" }) {
  if (format === "triple_crown") {
    return (
      <span className="bg-amber-100 text-amber-700 text-[10px] font-bold uppercase px-2 py-1 rounded-full inline-flex items-center gap-1">
        <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1l2.5 3.5L14 3l-1.5 5H3.5L2 3l3.5 1.5L8 1z" />
          <rect x="3" y="9" width="10" height="2.5" rx="0.5" />
        </svg>
        Triple Crown
      </span>
    );
  }
  if (format === "showdown") {
    return (
      <span className="bg-purple-100 text-purple-700 text-[10px] font-bold uppercase px-2 py-1 rounded-full">
        East/West Showdown
      </span>
    );
  }
  return null;
}

function formatRaceDate(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function ResultRow({ entry }: { entry: ResultEntry }) {
  if (!entry.rider) return null;
  return (
    <div className="flex items-center gap-3 bg-[#E8E4DF] border border-[#D4D0CB] rounded-lg px-3 py-2.5">
      <PositionBadge position={entry.position} />
      <TeamLogo team={entry.rider.team} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {entry.rider.number != null && <span className="text-[#1A1A1A] font-bold text-sm">#{entry.rider.number}</span>}
          <span className="text-[#1A1A1A] font-medium text-sm truncate">{entry.rider.name}</span>
        </div>
        {entry.rider.team && <p className="text-[#8A8A8A] text-xs truncate">{entry.rider.team}</p>}
      </div>
      <span className="text-[#1A1A1A] font-bold text-sm shrink-0">{entry.points}pts</span>
    </div>
  );
}

function BonusChip({ label, rider }: { label: string; rider: BonusRider | null | undefined }) {
  if (!rider) return null;
  return (
    <div className="flex items-center gap-2 bg-[#E8E4DF] border border-[#D4D0CB] rounded-lg px-3 py-2">
      <span className="text-[10px] font-bold uppercase text-[#8A8A8A] tracking-wide w-14 shrink-0">{label}</span>
      <TeamLogo team={rider.team} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {rider.number != null && <span className="text-[#1A1A1A] font-bold text-xs">#{rider.number}</span>}
          <span className="text-[#1A1A1A] text-sm truncate">{rider.name}</span>
        </div>
      </div>
    </div>
  );
}

export default function RecapPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const raceIdParam = searchParams.get("raceId");
  const [data, setData] = useState<RecapData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRecap = useCallback(() => {
    setLoading(true);
    const url = raceIdParam ? `/api/leagues/${id}/recap?raceId=${raceIdParam}` : `/api/leagues/${id}/recap`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setData(d);
        setLoading(false);
      });
  }, [id, raceIdParam]);

  useEffect(() => {
    loadRecap();
  }, [loadRecap]);

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 py-8 text-[#8A8A8A]">Loading recap...</div>;
  }
  if (!data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-[#8A8A8A]">No completed races yet.</p>
        <Link href={`/leagues/${id}`} className="text-[#1A1A1A] underline mt-4 inline-block">&larr; Back to League</Link>
      </div>
    );
  }

  const { race, navigation, top450, top250, bonuses, userScores } = data;
  const currentIndex = navigation.findIndex((r) => r.id === race.id);
  const prevRace = currentIndex > 0 ? navigation[currentIndex - 1] : null;
  const nextRace = currentIndex >= 0 && currentIndex < navigation.length - 1 ? navigation[currentIndex + 1] : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1A1A]">Race Recap</h1>
        <Link href={`/leagues/${id}`} className="text-[#8A8A8A] hover:text-[#1A1A1A] text-sm">
          &larr; Back to League
        </Link>
      </div>

      {/* Race title card */}
      <div className="bg-[#1A1A1A] text-white rounded-xl p-5 mb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-gray-400 text-xs uppercase tracking-wider">Round {race.round_number}</p>
            <h2 className="text-2xl font-bold mt-0.5">{race.name}</h2>
            {race.location && <p className="text-gray-400 text-sm mt-1 truncate">{race.location}</p>}
            <p className="text-gray-300 text-xs mt-1">{formatRaceDate(race.date)}</p>
          </div>
          <FormatBadge format={race.format} />
        </div>

        {/* Prev/Next nav */}
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/10">
          {prevRace ? (
            <button
              onClick={() => router.push(`/leagues/${id}/recap?raceId=${prevRace.id}`)}
              className="text-gray-400 hover:text-white text-xs flex items-center gap-1"
            >
              <span>&larr;</span> R{prevRace.round_number} {prevRace.name}
            </button>
          ) : (
            <span />
          )}
          {nextRace ? (
            <button
              onClick={() => router.push(`/leagues/${id}/recap?raceId=${nextRace.id}`)}
              className="text-gray-400 hover:text-white text-xs flex items-center gap-1"
            >
              R{nextRace.round_number} {nextRace.name} <span>&rarr;</span>
            </button>
          ) : (
            <span />
          )}
        </div>
      </div>

      {/* User Team Scores */}
      {userScores.length > 0 && (
        <section className="mb-6">
          <h3 className="text-xs font-bold text-[#8A8A8A] uppercase tracking-widest mb-3">League Scores This Race</h3>
          <div className="space-y-3">
            {userScores.map((u, i) => (
              <details key={u.user_id} className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl overflow-hidden group">
                <summary className="cursor-pointer p-4 flex items-center justify-between hover:bg-[#EBE7E2]">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      i === 0 ? "bg-amber-100 text-amber-700" : "bg-[#EBE7E2] text-[#6B6B6B] border border-[#D4D0CB]"
                    }`}>
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-[#1A1A1A] font-semibold">{u.username}</p>
                      <p className="text-[#8A8A8A] text-xs">{u.riders.length} riders in lineup</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[#1A1A1A] font-bold text-2xl">{u.total}</p>
                    <p className="text-[#A0A0A0] text-[10px] uppercase">pts this race</p>
                  </div>
                </summary>
                <div className="px-4 pb-4 pt-1 space-y-1 border-t border-[#D4D0CB]/50">
                  {u.riders.length === 0 ? (
                    <p className="text-[#A0A0A0] text-sm py-3 text-center italic">No lineup set for this race</p>
                  ) : (
                    u.riders.map((r, ri) => (
                      <div key={ri} className="flex items-center justify-between py-2 text-sm border-b border-[#D4D0CB]/30 last:border-0">
                        <div className="flex items-center gap-2 min-w-0">
                          {r.number != null && <span className="text-[#1A1A1A] font-bold text-xs w-9">#{r.number}</span>}
                          <span className="text-[#1A1A1A] truncate">{r.name}</span>
                          <span className="text-[#A0A0A0] text-[10px] bg-[#EBE7E2] px-1.5 rounded">{r.class}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {r.position && (
                            <span className="text-[#8A8A8A] text-xs">P{r.position}</span>
                          )}
                          <span className="text-[#1A1A1A] font-semibold">
                            {r.points + r.bonusPoints}
                            {r.bonusPoints > 0 && <span className="text-amber-600 text-[10px] ml-0.5">+{r.bonusPoints}</span>}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* Top 5 finishers */}
      <section className="mb-6">
        <h3 className="text-xs font-bold text-[#8A8A8A] uppercase tracking-widest mb-3">Top 5 Finishers</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-[#1A1A1A] font-bold mb-2 text-sm">450 Class</h4>
            <div className="space-y-2">
              {top450.length > 0 ? top450.map((r, i) => <ResultRow key={i} entry={r} />) : <p className="text-[#A0A0A0] text-xs italic">No 450 results</p>}
            </div>
          </div>
          <div>
            <h4 className="text-[#1A1A1A] font-bold mb-2 text-sm">250 Class</h4>
            <div className="space-y-2">
              {top250.length > 0 ? top250.map((r, i) => <ResultRow key={i} entry={r} />) : <p className="text-[#A0A0A0] text-xs italic">No 250 results</p>}
            </div>
          </div>
        </div>
      </section>

      {/* Bonuses */}
      <section className="mb-6">
        <h3 className="text-xs font-bold text-[#8A8A8A] uppercase tracking-widest mb-3">Bonus Winners</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 450 bonuses */}
          <div>
            <h4 className="text-[#1A1A1A] font-bold mb-2 text-sm">450 Class</h4>
            <div className="space-y-2">
              {bonuses.holeshots_450.length === 0 && bonuses.heat_450.length === 0 && !bonuses.lcq_450 && (
                <p className="text-[#A0A0A0] text-xs italic">No bonuses recorded</p>
              )}
              {bonuses.holeshots_450.map((rider, i) => (
                <BonusChip
                  key={`hs450-${i}`}
                  label={bonuses.holeshots_450.length > 1 ? `Holeshot ${i + 1}` : "Holeshot"}
                  rider={rider}
                />
              ))}
              {bonuses.heat_450.map((b, i) => (
                <BonusChip key={`h450-${i}`} label={b.type.startsWith("heat1") ? "Heat 1" : b.type.startsWith("heat2") ? "Heat 2" : "Heat"} rider={b.rider} />
              ))}
              {bonuses.lcq_450 && <BonusChip label="LCQ" rider={bonuses.lcq_450} />}
            </div>
          </div>

          {/* 250 bonuses */}
          <div>
            <h4 className="text-[#1A1A1A] font-bold mb-2 text-sm">250 Class</h4>
            <div className="space-y-2">
              {bonuses.holeshots_250.length === 0 && bonuses.heat_250.length === 0 && !bonuses.lcq_250 && (
                <p className="text-[#A0A0A0] text-xs italic">No bonuses recorded</p>
              )}
              {bonuses.holeshots_250.map((rider, i) => (
                <BonusChip
                  key={`hs250-${i}`}
                  label={bonuses.holeshots_250.length > 1 ? `Holeshot ${i + 1}` : "Holeshot"}
                  rider={rider}
                />
              ))}
              {bonuses.heat_250.map((b, i) => (
                <BonusChip key={`h250-${i}`} label={b.type.startsWith("heat1") ? "Heat 1" : b.type.startsWith("heat2") ? "Heat 2" : "Heat"} rider={b.rider} />
              ))}
              {bonuses.lcq_250 && <BonusChip label="LCQ" rider={bonuses.lcq_250} />}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
