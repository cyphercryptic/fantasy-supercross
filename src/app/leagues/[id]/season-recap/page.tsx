"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import TeamLogo from "@/components/TeamLogo";
import { BIKE_BRANDS, parseBikeConfig } from "@/components/MotoBike";

interface Standing {
  rank: number;
  user_id: number;
  username: string;
  team_name: string | null;
  team_logo: string | null;
  total_points: number;
  avg_per_race: number;
}

interface WeekScore {
  race_id: number;
  race_name: string;
  round_number: number;
  points: number;
}

interface UserBreakdown {
  user_id: number;
  username: string;
  team_name: string | null;
  team_logo: string | null;
  total_points: number;
  avg_per_race: number;
  best_week: WeekScore | null;
  worst_week: WeekScore | null;
  weekly: WeekScore[];
  most_used_riders: { rider_id: number; name: string; number: number | null; class: string; uses: number; total_contribution: number }[];
  best_pick: { rider_id: number; name: string; number: number | null; round: number; pick_number: number; total_points: number } | null;
  worst_pick: { rider_id: number; name: string; number: number | null; round: number; pick_number: number; total_points: number } | null;
}

interface RiderSummary {
  rider_id: number;
  name: string;
  number: number | null;
  team?: string | null;
  class: string;
  total_points?: number;
  bonus_points?: number;
  races_raced?: number;
  avg_finish?: number;
  podiums?: number;
  wins?: number;
  holeshots?: number;
}

interface RecapData {
  league_id: number;
  races_completed: number;
  final_standings: Standing[];
  user_breakdowns: UserBreakdown[];
  awards: {
    champion: UserBreakdown | null;
    runner_up: UserBreakdown | null;
    championship_gap: number;
    best_week_overall: (WeekScore & { user_id: number; username: string }) | null;
  };
  league_riders: {
    top_overall: RiderSummary[];
    top_450: RiderSummary[];
    top_250: RiderSummary[];
    most_wins: RiderSummary[];
    most_podiums: RiderSummary[];
    holeshot_leaders: RiderSummary[];
  };
}

function userColor(team_logo: string | null): string {
  const cfg = parseBikeConfig(team_logo);
  const brand = cfg?.brand || null;
  return brand && BIKE_BRANDS[brand] ? BIKE_BRANDS[brand].color : "#8A8A8A";
}

function RiderRow({ r, suffix }: { r: RiderSummary; suffix?: string }) {
  return (
    <div className="flex items-center justify-between bg-[#E8E4DF] border border-[#D4D0CB] rounded-lg px-3 py-2.5">
      <div className="flex items-center gap-2 min-w-0">
        {r.number != null && <span className="text-[#1A1A1A] font-bold text-sm w-10">#{r.number}</span>}
        <span className="text-[#1A1A1A] font-medium text-sm truncate">{r.name}</span>
        <span className="text-[10px] text-[#A0A0A0] bg-[#D4D0CB]/50 px-1.5 rounded shrink-0">{r.class}</span>
      </div>
      {suffix && <span className="text-[#1A1A1A] font-bold text-sm shrink-0">{suffix}</span>}
    </div>
  );
}

export default function SeasonRecapPage() {
  const { id } = useParams();
  const [data, setData] = useState<RecapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/leagues/${id}/season-recap`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setData(d);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 py-8 text-[#8A8A8A]">Loading season recap...</div>;
  }
  if (!data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-[#8A8A8A]">Season recap unavailable. Has any race been completed?</p>
        <Link href={`/leagues/${id}`} className="text-[#1A1A1A] underline mt-4 inline-block">&larr; Back to League</Link>
      </div>
    );
  }

  const champion = data.awards.champion;
  const runnerUp = data.awards.runner_up;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1A1A]">Season Recap</h1>
        <Link href={`/leagues/${id}`} className="text-[#8A8A8A] hover:text-[#1A1A1A] text-sm">
          &larr; Back to League
        </Link>
      </div>
      <p className="text-[#8A8A8A] text-sm mb-6">{data.races_completed} races completed</p>

      {/* Champion banner */}
      {champion && (
        <div
          className="rounded-2xl p-6 mb-6 text-white shadow-lg"
          style={{
            background: `linear-gradient(135deg, ${userColor(champion.team_logo)} 0%, #1A1A1A 100%)`,
          }}
        >
          <p className="text-white/70 text-xs uppercase tracking-widest mb-2">League Champion</p>
          <h2 className="text-3xl font-bold mb-1">{champion.team_name || champion.username}</h2>
          {champion.team_name && <p className="text-white/80 text-sm mb-3">@{champion.username}</p>}
          <div className="flex items-baseline gap-3 mt-4">
            <span className="text-4xl font-bold">{champion.total_points}</span>
            <span className="text-white/70 text-xs uppercase">total points</span>
          </div>
          {runnerUp && data.awards.championship_gap > 0 && (
            <p className="text-white/60 text-xs mt-2">
              Beat {runnerUp.team_name || runnerUp.username} by {data.awards.championship_gap} pt{data.awards.championship_gap === 1 ? "" : "s"}
            </p>
          )}
        </div>
      )}

      {/* Final Standings */}
      <section className="mb-6">
        <h3 className="text-xs font-bold text-[#8A8A8A] uppercase tracking-widest mb-3">Final Standings</h3>
        <div className="space-y-2">
          {data.final_standings.map((s) => {
            const c = userColor(s.team_logo);
            return (
              <div
                key={s.user_id}
                className="bg-[#F5F0EB] border-2 rounded-xl p-3 flex items-center gap-3"
                style={{ borderColor: c }}
              >
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-base text-white shrink-0"
                  style={{ backgroundColor: c }}
                >
                  {s.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[#1A1A1A] font-bold">{s.team_name || s.username}</p>
                  <p className="text-[#8A8A8A] text-xs">{s.team_name ? `@${s.username} • ` : ""}avg {s.avg_per_race} pts/race</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[#1A1A1A] font-bold text-xl">{s.total_points}</p>
                  <p className="text-[#A0A0A0] text-[10px] uppercase">total pts</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Highest single-race score */}
      {data.awards.best_week_overall && (
        <section className="mb-6">
          <h3 className="text-xs font-bold text-[#8A8A8A] uppercase tracking-widest mb-3">Best Single Race</h3>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-amber-700 text-xs uppercase tracking-wide mb-1">Highest weekly score</p>
            <p className="text-[#1A1A1A] font-bold text-xl">{data.awards.best_week_overall.username}</p>
            <p className="text-[#8A8A8A] text-sm mt-0.5">
              {data.awards.best_week_overall.points} pts at Round {data.awards.best_week_overall.round_number} {data.awards.best_week_overall.race_name}
            </p>
          </div>
        </section>
      )}

      {/* Manager Awards (per user) */}
      <section className="mb-6">
        <h3 className="text-xs font-bold text-[#8A8A8A] uppercase tracking-widest mb-3">Manager Breakdown</h3>
        <div className="space-y-3">
          {data.user_breakdowns.map((u) => {
            const c = userColor(u.team_logo);
            const isExpanded = expandedUserId === u.user_id;
            return (
              <div key={u.user_id} className="bg-[#F5F0EB] border-2 rounded-xl overflow-hidden" style={{ borderColor: c }}>
                <button
                  onClick={() => setExpandedUserId(isExpanded ? null : u.user_id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-[#EBE7E2] text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-2 h-12 rounded-full shrink-0" style={{ backgroundColor: c }} />
                    <div className="min-w-0">
                      <p className="text-[#1A1A1A] font-bold">{u.team_name || u.username}</p>
                      <p className="text-[#8A8A8A] text-xs">{u.total_points} pts • avg {u.avg_per_race}/race</p>
                    </div>
                  </div>
                  <svg
                    className={`w-5 h-5 text-[#8A8A8A] shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isExpanded && (
                  <div className="border-t border-[#D4D0CB] p-4 space-y-4">
                    {/* Best/worst week */}
                    <div className="grid grid-cols-2 gap-3">
                      {u.best_week && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <p className="text-green-700 text-[10px] font-bold uppercase mb-0.5">Best Week</p>
                          <p className="text-[#1A1A1A] font-bold text-2xl">{u.best_week.points}</p>
                          <p className="text-[#8A8A8A] text-xs">R{u.best_week.round_number} {u.best_week.race_name}</p>
                        </div>
                      )}
                      {u.worst_week && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="text-red-700 text-[10px] font-bold uppercase mb-0.5">Worst Week</p>
                          <p className="text-[#1A1A1A] font-bold text-2xl">{u.worst_week.points}</p>
                          <p className="text-[#8A8A8A] text-xs">R{u.worst_week.round_number} {u.worst_week.race_name}</p>
                        </div>
                      )}
                    </div>

                    {/* Best/worst draft pick */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {u.best_pick && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <p className="text-green-700 text-[10px] font-bold uppercase mb-0.5">Steal of the Draft</p>
                          <p className="text-[#1A1A1A] font-bold">
                            {u.best_pick.number != null && `#${u.best_pick.number} `}{u.best_pick.name}
                          </p>
                          <p className="text-[#8A8A8A] text-xs">Round {u.best_pick.round}, Pick {u.best_pick.pick_number} → {u.best_pick.total_points} pts</p>
                        </div>
                      )}
                      {u.worst_pick && u.worst_pick.rider_id !== u.best_pick?.rider_id && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="text-red-700 text-[10px] font-bold uppercase mb-0.5">Bust of the Draft</p>
                          <p className="text-[#1A1A1A] font-bold">
                            {u.worst_pick.number != null && `#${u.worst_pick.number} `}{u.worst_pick.name}
                          </p>
                          <p className="text-[#8A8A8A] text-xs">Round {u.worst_pick.round}, Pick {u.worst_pick.pick_number} → {u.worst_pick.total_points} pts</p>
                        </div>
                      )}
                    </div>

                    {/* MVP riders (most contribution) */}
                    {u.most_used_riders.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-[#8A8A8A] uppercase mb-2">Top Contributors</p>
                        <div className="space-y-1.5">
                          {u.most_used_riders.map((r) => (
                            <div key={r.rider_id} className="flex items-center justify-between text-sm bg-[#EBE7E2] rounded px-3 py-2">
                              <div className="flex items-center gap-2 min-w-0">
                                {r.number != null && <span className="font-bold text-[#1A1A1A] w-9">#{r.number}</span>}
                                <span className="text-[#1A1A1A] truncate">{r.name}</span>
                                <span className="text-[10px] text-[#A0A0A0] bg-[#D4D0CB]/60 px-1.5 rounded shrink-0">{r.class}</span>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-[#1A1A1A] font-bold">{r.total_contribution}</span>
                                <span className="text-[#A0A0A0] text-[10px] ml-1">in {r.uses} race{r.uses !== 1 ? "s" : ""}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* League-wide rider awards */}
      <section className="mb-6">
        <h3 className="text-xs font-bold text-[#8A8A8A] uppercase tracking-widest mb-3">Season Leaders</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-[#1A1A1A] font-bold mb-2 text-sm">Top 5 — 450 Class</h4>
            <div className="space-y-2">
              {data.league_riders.top_450.map((r) => (
                <RiderRow key={r.rider_id} r={r} suffix={`${r.total_points || 0} pts`} />
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-[#1A1A1A] font-bold mb-2 text-sm">Top 5 — 250 Class</h4>
            <div className="space-y-2">
              {data.league_riders.top_250.map((r) => (
                <RiderRow key={r.rider_id} r={r} suffix={`${r.total_points || 0} pts`} />
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {data.league_riders.most_wins.length > 0 && (
            <div>
              <h4 className="text-[#1A1A1A] font-bold mb-2 text-sm">Most Wins</h4>
              <div className="space-y-2">
                {data.league_riders.most_wins.map((r) => (
                  <RiderRow key={r.rider_id} r={r} suffix={`${r.wins} W`} />
                ))}
              </div>
            </div>
          )}
          {data.league_riders.most_podiums.length > 0 && (
            <div>
              <h4 className="text-[#1A1A1A] font-bold mb-2 text-sm">Most Podiums</h4>
              <div className="space-y-2">
                {data.league_riders.most_podiums.map((r) => (
                  <RiderRow key={r.rider_id} r={r} suffix={`${r.podiums}`} />
                ))}
              </div>
            </div>
          )}
          {data.league_riders.holeshot_leaders.length > 0 && (
            <div>
              <h4 className="text-[#1A1A1A] font-bold mb-2 text-sm">Holeshot Kings</h4>
              <div className="space-y-2">
                {data.league_riders.holeshot_leaders.map((r) => (
                  <RiderRow key={r.rider_id} r={r} suffix={`${r.holeshots}`} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
