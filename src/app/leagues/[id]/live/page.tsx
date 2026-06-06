"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
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
interface LiveData {
  live: boolean;
  race?: { id: number; name: string; round_number: number | null; date: string | null; location: string | null; race_time: string | null };
  classStatus?: { has450: boolean; has250: boolean };
  top450?: ResultEntry[];
  top250?: ResultEntry[];
  riderToUser?: Record<number, number>;
  userScores?: UserScore[];
  lastCompleted?: { id: number; name: string; round_number: number | null } | null;
  lastUpdated: string;
}

const POLL_MS = 60_000;

function buildUserColors(userScores: UserScore[]): Record<number, string> {
  const out: Record<number, string> = {};
  for (const u of userScores) {
    const config = parseBikeConfig(u.team_logo);
    const brand = config?.brand || null;
    out[u.user_id] = brand && BIKE_BRANDS[brand] ? BIKE_BRANDS[brand].color : "#8A8A8A";
  }
  return out;
}

function timeAgo(iso: string): string {
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  return `${mins}m ago`;
}

export default function LivePage() {
  const { id } = useParams();
  const [data, setData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [, setTick] = useState(0); // re-render to keep "updated Xs ago" fresh
  const inFlight = useRef(false);

  const load = useCallback(
    async (pullResults: boolean) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setRefreshing(true);
      try {
        // Pull the latest motos via the same idempotent importer the Refresh
        // button uses, then read the freshly-scored matchup.
        if (pullResults) {
          await fetch(`/api/cron/auto-import`, { method: "POST" }).catch(() => {});
        }
        const res = await fetch(`/api/leagues/${id}/live`);
        const d = await res.json();
        if (!d.error) setData(d);
      } finally {
        inFlight.current = false;
        setRefreshing(false);
        setLoading(false);
      }
    },
    [id]
  );

  // Initial load
  useEffect(() => {
    load(true);
  }, [load]);

  // Auto-poll while live
  useEffect(() => {
    if (!autoRefresh || !data?.live) return;
    const t = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(t);
  }, [autoRefresh, data?.live, load]);

  // Keep the "updated Xs ago" label ticking
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 py-8 text-[#8A8A8A]">Loading live race…</div>;
  }

  // Nothing in progress
  if (!data?.live) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1A1A]">Live Race</h1>
          <Link href={`/leagues/${id}`} className="text-[#8A8A8A] hover:text-[#1A1A1A] text-sm">&larr; Back to League</Link>
        </div>
        <div className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-8 text-center shadow-sm">
          <p className="text-[#1A1A1A] font-semibold text-lg">No race in progress right now</p>
          <p className="text-[#8A8A8A] text-sm mt-1">The live tracker turns on at gate drop and runs until the race wraps up.</p>
          <div className="flex items-center justify-center gap-3 mt-5">
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="text-sm font-semibold bg-[#1A1A1A] text-white px-4 py-2 rounded-lg hover:bg-[#333] disabled:opacity-50"
            >
              {refreshing ? "Checking…" : "Check again"}
            </button>
            <Link
              href={data?.lastCompleted ? `/leagues/${id}/recap?raceId=${data.lastCompleted.id}` : `/leagues/${id}/recap`}
              className="text-sm font-semibold bg-[#EBE7E2] text-[#1A1A1A] border border-[#D4D0CB] px-4 py-2 rounded-lg hover:bg-[#E0DBD4]"
            >
              {data?.lastCompleted ? `View R${data.lastCompleted.round_number} Recap` : "Race Recap"}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { race, userScores = [], top450 = [], top250 = [], classStatus, riderToUser = {} } = data;
  const colors = buildUserColors(userScores);
  const leader = userScores[0];
  const runnerUp = userScores[1];
  const margin = leader && runnerUp ? leader.total - runnerUp.total : 0;

  function ownerColor(riderId: number | null | undefined): string | null {
    if (riderId == null) return null;
    const uid = riderToUser[riderId];
    return uid ? colors[uid] || null : null;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1A1A]">Live Race</h1>
          <span className="inline-flex items-center gap-1.5 bg-red-600 text-white text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Live
          </span>
        </div>
        <Link href={`/leagues/${id}`} className="text-[#8A8A8A] hover:text-[#1A1A1A] text-sm">&larr; Back</Link>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <p className="text-[#8A8A8A] text-xs">
          Updated {timeAgo(data.lastUpdated)}
          {refreshing && <span className="text-[#A0A0A0]"> · refreshing…</span>}
        </p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-[#8A8A8A] cursor-pointer select-none">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="accent-[#1A1A1A]" />
            Auto-refresh
          </label>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="text-xs font-semibold bg-[#1A1A1A] text-white px-3 py-1.5 rounded-lg hover:bg-[#333] disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh now"}
          </button>
        </div>
      </div>

      {/* Race title + class status */}
      <div className="bg-[#1A1A1A] text-white rounded-xl p-5 mb-6">
        <p className="text-gray-400 text-xs uppercase tracking-wider">Round {race?.round_number}</p>
        <h2 className="text-2xl font-bold mt-0.5">{race?.name}</h2>
        {race?.location && <p className="text-gray-400 text-sm mt-1">{race.location}</p>}
        <div className="flex items-center gap-2 mt-3">
          <ClassPill label="250" posted={!!classStatus?.has250} />
          <ClassPill label="450" posted={!!classStatus?.has450} />
          <span className="text-gray-500 text-[11px]">results posted as each moto finishes</span>
        </div>
      </div>

      {/* Head-to-head leader banner */}
      {leader && (
        <div className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-4 mb-6 shadow-sm text-center">
          {leader.total === 0 ? (
            <p className="text-[#8A8A8A] text-sm">Waiting for the first results…</p>
          ) : margin === 0 && runnerUp ? (
            <p className="text-[#1A1A1A] font-semibold">Dead even at {leader.total} pts</p>
          ) : (
            <p className="text-[#1A1A1A]">
              <span className="font-bold" style={{ color: colors[leader.user_id] }}>{leader.team_name || leader.username}</span>
              {" leads"}
              {runnerUp && <> by <span className="font-bold">{margin}</span> pt{margin === 1 ? "" : "s"}</>}
            </p>
          )}
        </div>
      )}

      {/* Team scores */}
      <section className="mb-6">
        <h3 className="text-xs font-bold text-[#8A8A8A] uppercase tracking-widest mb-3">Matchup — Live Points</h3>
        <div className="space-y-3">
          {userScores.map((u, i) => {
            const color = colors[u.user_id] || "#8A8A8A";
            return (
              <details key={u.user_id} className="bg-[#F5F0EB] border-2 rounded-xl overflow-hidden" style={{ borderColor: color }} open>
                <summary className="cursor-pointer p-4 flex items-center justify-between hover:bg-[#EBE7E2]">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white" style={{ backgroundColor: color }}>{i + 1}</span>
                    <div>
                      <p className="text-[#1A1A1A] font-semibold">{u.team_name || u.username}</p>
                      <p className="text-[#8A8A8A] text-xs">{u.team_name ? `${u.username} • ` : ""}{u.riders.length} riders in lineup</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[#1A1A1A] font-bold text-2xl">{u.total}</p>
                    <p className="text-[#A0A0A0] text-[10px] uppercase">pts so far</p>
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
                          {r.position ? (
                            <span className="text-[#8A8A8A] text-xs">P{r.position}</span>
                          ) : (
                            <span className="text-[#C0C0C0] text-[10px] italic">—</span>
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

      {/* Top finishers so far */}
      <section className="mb-6">
        <h3 className="text-xs font-bold text-[#8A8A8A] uppercase tracking-widest mb-3">Top Finishers So Far</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-[#1A1A1A] font-bold mb-2 text-sm">450 Class</h4>
            <div className="space-y-2">
              {top450.length > 0 ? top450.slice(0, 5).map((r, i) => <LiveResultRow key={i} entry={r} ownerColor={ownerColor(r.rider?.id)} />) : <p className="text-[#A0A0A0] text-xs italic">No 450 results yet</p>}
            </div>
          </div>
          <div>
            <h4 className="text-[#1A1A1A] font-bold mb-2 text-sm">250 Class</h4>
            <div className="space-y-2">
              {top250.length > 0 ? top250.slice(0, 5).map((r, i) => <LiveResultRow key={i} entry={r} ownerColor={ownerColor(r.rider?.id)} />) : <p className="text-[#A0A0A0] text-xs italic">No 250 results yet</p>}
            </div>
          </div>
        </div>
      </section>

      <p className="text-center text-[#A0A0A0] text-xs">
        When the race wraps up, the full <Link href={`/leagues/${id}/recap`} className="underline hover:text-[#1A1A1A]">Race Recap</Link> takes over.
      </p>
    </div>
  );
}

function ClassPill({ label, posted }: { label: string; posted: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
        posted ? "bg-green-500/20 text-green-300" : "bg-white/10 text-gray-400"
      }`}
    >
      {posted ? "✓" : "•"} {label}
    </span>
  );
}

function LiveResultRow({ entry, ownerColor }: { entry: ResultEntry; ownerColor: string | null }) {
  if (!entry.rider) return null;
  const style = ownerColor ? { borderColor: ownerColor, borderWidth: "2px", boxShadow: `0 0 0 1px ${ownerColor}33` } : undefined;
  return (
    <div className="flex items-center gap-3 bg-[#E8E4DF] border border-[#D4D0CB] rounded-lg px-3 py-2" style={style}>
      <span className="w-7 h-7 rounded-full bg-[#EBE7E2] border border-[#D4D0CB] text-[#6B6B6B] flex items-center justify-center text-xs font-bold shrink-0">P{entry.position}</span>
      <TeamLogo team={entry.rider.team} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {entry.rider.number != null && <span className="text-[#1A1A1A] font-bold text-sm">#{entry.rider.number}</span>}
          <span className="text-[#1A1A1A] font-medium text-sm truncate">{entry.rider.name}</span>
        </div>
      </div>
      <span className="text-[#1A1A1A] font-bold text-sm shrink-0">{entry.points}pts</span>
    </div>
  );
}
