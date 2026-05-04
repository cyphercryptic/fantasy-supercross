"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import TeamLogo from "@/components/TeamLogo";
import { BIKE_BRANDS, parseBikeConfig } from "@/components/MotoBike";

interface RiderInfo {
  id: number;
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
  team_name: string | null;
  team_logo: string | null;
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
  riderToUser: Record<number, number>;
  userScores: UserScore[];
}

// Build a lookup of user_id → color from team_logo configs
function buildUserColors(userScores: UserScore[]): Record<number, { color: string; username: string; brand: string | null }> {
  const out: Record<number, { color: string; username: string; brand: string | null }> = {};
  for (const u of userScores) {
    const config = parseBikeConfig(u.team_logo);
    const brand = config?.brand || null;
    const color = brand && BIKE_BRANDS[brand] ? BIKE_BRANDS[brand].color : "#8A8A8A";
    out[u.user_id] = { color, username: u.username, brand };
  }
  return out;
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

function OwnerBadge({ owner }: { owner: { color: string; username: string } | null }) {
  if (!owner) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded text-white shrink-0"
      style={{ backgroundColor: owner.color }}
      title={`${owner.username}'s rider`}
    >
      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
      {owner.username}
    </span>
  );
}

function ResultRow({ entry, owner }: { entry: ResultEntry; owner: { color: string; username: string } | null }) {
  if (!entry.rider) return null;
  const ownedStyle = owner
    ? { borderColor: owner.color, borderWidth: "2px", boxShadow: `0 0 0 1px ${owner.color}33` }
    : undefined;
  return (
    <div
      className="flex items-center gap-3 bg-[#E8E4DF] border border-[#D4D0CB] rounded-lg px-3 py-2.5 transition-all"
      style={ownedStyle}
    >
      <PositionBadge position={entry.position} />
      <TeamLogo team={entry.rider.team} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {entry.rider.number != null && <span className="text-[#1A1A1A] font-bold text-sm">#{entry.rider.number}</span>}
          <span className="text-[#1A1A1A] font-medium text-sm truncate">{entry.rider.name}</span>
          <OwnerBadge owner={owner} />
        </div>
        {entry.rider.team && <p className="text-[#8A8A8A] text-xs truncate">{entry.rider.team}</p>}
      </div>
      <span className="text-[#1A1A1A] font-bold text-sm shrink-0">{entry.points}pts</span>
    </div>
  );
}

function BonusChip({ label, rider, owner }: { label: string; rider: BonusRider | null | undefined; owner: { color: string; username: string } | null }) {
  if (!rider) return null;
  const ownedStyle = owner
    ? { borderColor: owner.color, borderWidth: "2px", boxShadow: `0 0 0 1px ${owner.color}33` }
    : undefined;
  return (
    <div
      className="flex items-center gap-2 bg-[#E8E4DF] border border-[#D4D0CB] rounded-lg px-3 py-2"
      style={ownedStyle}
    >
      <span className="text-[10px] font-bold uppercase text-[#8A8A8A] tracking-wide w-14 shrink-0">{label}</span>
      <TeamLogo team={rider.team} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {rider.number != null && <span className="text-[#1A1A1A] font-bold text-xs">#{rider.number}</span>}
          <span className="text-[#1A1A1A] text-sm truncate">{rider.name}</span>
          <OwnerBadge owner={owner} />
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

  const { race, navigation, top450, top250, bonuses, userScores, riderToUser } = data;
  const currentIndex = navigation.findIndex((r) => r.id === race.id);
  const prevRace = currentIndex > 0 ? navigation[currentIndex - 1] : null;
  const nextRace = currentIndex >= 0 && currentIndex < navigation.length - 1 ? navigation[currentIndex + 1] : null;

  // Color lookup per user
  const userColors = buildUserColors(userScores);
  function ownerOf(riderId: number | null | undefined) {
    if (riderId == null) return null;
    const userId = riderToUser[riderId];
    if (!userId) return null;
    return userColors[userId] || null;
  }

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
            {userScores.map((u, i) => {
              const userColor = userColors[u.user_id]?.color || "#8A8A8A";
              return (
              <details key={u.user_id} className="bg-[#F5F0EB] border-2 rounded-xl overflow-hidden group" style={{ borderColor: userColor }}>
                <summary className="cursor-pointer p-4 flex items-center justify-between hover:bg-[#EBE7E2]">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white"
                      style={{ backgroundColor: userColor }}
                    >
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-[#1A1A1A] font-semibold">{u.team_name || u.username}</p>
                      <p className="text-[#8A8A8A] text-xs">{u.team_name ? `${u.username} • ` : ""}{u.riders.length} riders in lineup</p>
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
              );
            })}
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
              {top450.length > 0 ? top450.map((r, i) => <ResultRow key={i} entry={r} owner={ownerOf(r.rider?.id)} />) : <p className="text-[#A0A0A0] text-xs italic">No 450 results</p>}
            </div>
          </div>
          <div>
            <h4 className="text-[#1A1A1A] font-bold mb-2 text-sm">250 Class</h4>
            <div className="space-y-2">
              {top250.length > 0 ? top250.map((r, i) => <ResultRow key={i} entry={r} owner={ownerOf(r.rider?.id)} />) : <p className="text-[#A0A0A0] text-xs italic">No 250 results</p>}
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
                  owner={ownerOf(rider?.id)}
                />
              ))}
              {bonuses.heat_450.map((b, i) => (
                <BonusChip key={`h450-${i}`} label={b.type.startsWith("heat1") ? "Heat 1" : b.type.startsWith("heat2") ? "Heat 2" : "Heat"} rider={b.rider} owner={ownerOf(b.rider?.id)} />
              ))}
              {bonuses.lcq_450 && <BonusChip label="LCQ" rider={bonuses.lcq_450} owner={ownerOf(bonuses.lcq_450.id)} />}
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
                  owner={ownerOf(rider?.id)}
                />
              ))}
              {bonuses.heat_250.map((b, i) => (
                <BonusChip key={`h250-${i}`} label={b.type.startsWith("heat1") ? "Heat 1" : b.type.startsWith("heat2") ? "Heat 2" : "Heat"} rider={b.rider} owner={ownerOf(b.rider?.id)} />
              ))}
              {bonuses.lcq_250 && <BonusChip label="LCQ" rider={bonuses.lcq_250} owner={ownerOf(bonuses.lcq_250.id)} />}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
