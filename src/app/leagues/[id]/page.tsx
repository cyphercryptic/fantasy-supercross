"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface League {
  id: number;
  name: string;
  invite_code: string;
  commissioner_id: number;
  max_members: number;
  roster_size: number;
  lineup_450: number;
  lineup_250e: number;
  lineup_250w: number;
  draft_status: string;
  is_commissioner: boolean;
  members: { id: number; username: string; joined_at: string }[];
}

interface Standing {
  id: number;
  username: string;
  team_name: string | null;
  total_points: number;
  races_played: number;
  last_week_points: number;
}

interface Race {
  id: number;
  name: string;
  round_number: number | null;
  status: string;
}

interface RiderBreakdown {
  rider_id: number;
  name: string;
  number: number;
  class: string;
  team: string;
  total_points: number;
  races: {
    race_id: number;
    race_name: string;
    round_number: number;
    position: number | null;
    points: number;
    bonus_points: number;
    in_lineup: boolean;
  }[];
}

export default function LeagueDashboard() {
  const { id } = useParams();
  const router = useRouter();
  const [league, setLeague] = useState<League | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [upcomingRace, setUpcomingRace] = useState<Race | null>(null);
  const [copied, setCopied] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [breakdownData, setBreakdownData] = useState<Record<number, RiderBreakdown[]>>({});
  const [loadingBreakdown, setLoadingBreakdown] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    fetch(`/api/leagues/${id}`).then((r) => r.json()).then(setLeague);
    fetch(`/api/leagues/${id}/leaderboard`).then((r) => r.json()).then(setStandings);
    fetch("/api/races").then((r) => r.json()).then((races: Race[]) => {
      const upcoming = races.find((r) => r.status === "upcoming");
      if (upcoming) setUpcomingRace(upcoming);
    });
  }, [id]);

  function copyCode() {
    if (league) {
      navigator.clipboard.writeText(league.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function startDraft() {
    setDraftMessage("");
    const res = await fetch("/api/leagues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start_draft", leagueId: id }),
    });
    const data = await res.json();
    if (res.ok) {
      router.push(`/leagues/${id}/draft`);
    } else {
      setDraftMessage(data.error);
    }
  }

  async function toggleBreakdown(userId: number) {
    if (expandedUser === userId) {
      setExpandedUser(null);
      return;
    }
    setExpandedUser(userId);
    if (breakdownData[userId]) return;
    setLoadingBreakdown(userId);
    try {
      const res = await fetch(`/api/leagues/${id}/leaderboard/breakdown?userId=${userId}`);
      const data = await res.json();
      setBreakdownData((prev) => ({ ...prev, [userId]: data }));
    } catch {
      // silently fail
    }
    setLoadingBreakdown(null);
  }

  if (!league) {
    return <div className="max-w-4xl mx-auto px-4 py-8 text-[#8A8A8A]">Loading...</div>;
  }

  const isFull = league.members.length >= league.max_members;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1A1A1A] tracking-tight">{league.name}</h1>
          <p className="text-[#8A8A8A] text-sm mt-1">
            {league.members.length}/{league.max_members} members
            {league.is_commissioner && " · You are the commissioner"}
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2">
            <span className="text-[#A0A0A0] text-xs">Invite Code:</span>
            <code className="text-[#1A1A1A] font-mono text-sm bg-[#EBE7E2] px-2 py-1 rounded">
              {league.invite_code}
            </code>
            <button
              onClick={copyCode}
              className="text-[#8A8A8A] hover:text-[#000000] text-xs"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      </div>

      {/* Draft Status Banner */}
      {league.draft_status === "waiting" && (
        <div className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-5 mb-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#1A1A1A] font-semibold">
                {isFull ? "All members have joined!" : `Waiting for members (${league.members.length}/${league.max_members})`}
              </p>
              <p className="text-[#8A8A8A] text-sm mt-1">
                {isFull
                  ? "The commissioner can now start the snake draft."
                  : "Share the invite code with friends to fill the league."}
              </p>
            </div>
            {league.is_commissioner && isFull && (
              <button
                onClick={startDraft}
                className="bg-[#1A1A1A] hover:bg-[#333333] text-white px-6 py-3 rounded-lg font-bold text-lg"
              >
                Start Draft
              </button>
            )}
          </div>
          {draftMessage && (
            <p className="text-red-600 text-sm mt-2">{draftMessage}</p>
          )}
          {league.is_commissioner && (
            <div className="mt-4 pt-3 border-t border-[#D4D0CB]">
              {showDeleteConfirm ? (
                <div className="flex items-center gap-3">
                  <p className="text-red-600 text-sm">Delete this league? This cannot be undone.</p>
                  <button
                    onClick={async () => {
                      const res = await fetch(`/api/leagues/${id}`, { method: "DELETE" });
                      if (res.ok) router.push("/leagues");
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-sm font-semibold"
                  >
                    Confirm Delete
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="text-[#8A8A8A] hover:text-[#1A1A1A] text-sm"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Delete League
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {league.draft_status === "drafting" && (
        <Link
          href={`/leagues/${id}/draft`}
          className="block bg-[#1A1A1A]/5 border border-[#1A1A1A] rounded-xl p-5 mb-6 text-center hover:bg-[#1A1A1A]/10 transition-colors"
        >
          <p className="text-[#1A1A1A] font-bold text-lg">Draft In Progress</p>
          <p className="text-[#8A8A8A] text-sm mt-1">Click here to go to the draft board</p>
        </Link>
      )}

      {/* Quick Actions — only show after draft is complete */}
      {league.draft_status === "completed" && (
        <>
          <div className="mb-6">
            <Link
              href={`/leagues/${id}/team`}
              className="block bg-[#1A1A1A] hover:bg-[#333333] text-white rounded-xl p-4 text-center transition-colors shadow-sm"
            >
              <p className="font-semibold text-lg">My Team</p>
              <p className="text-white/60 text-xs mt-1">Roster, Lineup & Free Agents</p>
            </Link>
          </div>

          {/* Upcoming Race */}
          {upcomingRace && (
            <div className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-4 mb-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#A0A0A0] text-xs uppercase tracking-wide">Next Race</p>
                  <p className="text-[#1A1A1A] font-semibold">
                    {upcomingRace.round_number && `Round ${upcomingRace.round_number}: `}
                    {upcomingRace.name}
                  </p>
                </div>
                <Link
                  href={`/leagues/${id}/team`}
                  className="bg-[#1A1A1A] hover:bg-[#333333] text-white px-4 py-2 rounded text-sm font-semibold"
                >
                  Set Lineup
                </Link>
              </div>
            </div>
          )}
        </>
      )}

      {/* Rules & Scoring Link */}
      <Link
        href={`/leagues/${id}/rules`}
        className="flex items-center justify-between bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-4 mb-6 shadow-sm hover:bg-[#EBE7E2] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-sm font-bold">?</span>
          <div>
            <p className="text-[#1A1A1A] font-semibold text-sm">Rules & Scoring</p>
            <p className="text-[#8A8A8A] text-xs">How to play, points table & bonus scoring</p>
          </div>
        </div>
        <svg className="w-5 h-5 text-[#8A8A8A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>

      {/* League Settings */}
      <div className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-4 mb-6 shadow-sm">
        <h3 className="text-[#8A8A8A] text-xs uppercase tracking-wide mb-2">League Settings</h3>
        <div className="grid grid-cols-5 gap-4 text-center">
          <div>
            <p className="text-[#1A1A1A] font-bold text-lg">{league.max_members}</p>
            <p className="text-[#A0A0A0] text-xs">Members</p>
          </div>
          <div>
            <p className="text-[#1A1A1A] font-bold text-lg">{league.roster_size}</p>
            <p className="text-[#A0A0A0] text-xs">Roster Size</p>
          </div>
          <div>
            <p className="text-[#1A1A1A] font-bold text-lg">{league.lineup_450}</p>
            <p className="text-[#A0A0A0] text-xs">450 Slots</p>
          </div>
          <div>
            <p className="text-[#1A1A1A] font-bold text-lg">{league.lineup_250e}</p>
            <p className="text-[#A0A0A0] text-xs">250E Slots</p>
          </div>
          <div>
            <p className="text-[#1A1A1A] font-bold text-lg">{league.lineup_250w}</p>
            <p className="text-[#A0A0A0] text-xs">250W Slots</p>
          </div>
        </div>
      </div>

      {/* Leaderboard — only after draft */}
      {league.draft_status === "completed" && (
        <div className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4">Standings</h2>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#D4D0CB]">
                <th className="text-left py-3 px-2 text-[#8A8A8A] text-sm font-medium w-12">#</th>
                <th className="text-left py-3 px-2 text-[#8A8A8A] text-sm font-medium">Team</th>
                <th className="text-right py-3 px-2 text-[#8A8A8A] text-sm font-medium">Last Week</th>
                <th className="text-right py-3 px-2 text-[#8A8A8A] text-sm font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => {
                const isExpanded = expandedUser === s.id;
                const riders = breakdownData[s.id];
                return (
                  <React.Fragment key={s.id}>
                    <tr
                      onClick={() => toggleBreakdown(s.id)}
                      className="border-b border-[#D4D0CB] hover:bg-[#EBE7E2] cursor-pointer select-none"
                    >
                      <td className="py-3 px-2">
                        <span className={`font-bold ${
                          i === 0 ? "text-amber-500" : i === 1 ? "text-[#6B6B6B]" : i === 2 ? "text-[#1A1A1A]" : "text-[#A0A0A0]"
                        }`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="text-[#1A1A1A] font-medium">{s.team_name || s.username}</p>
                            {s.team_name && (
                              <p className="text-[#A0A0A0] text-xs">{s.username}</p>
                            )}
                          </div>
                          <svg className={`w-3.5 h-3.5 text-[#A0A0A0] transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right text-[#8A8A8A]">{s.last_week_points}</td>
                      <td className="py-3 px-2 text-right">
                        <span className="text-[#1A1A1A] font-bold text-lg">{s.total_points}</span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={4} className="bg-[#EBE7E2] px-4 py-3">
                          {loadingBreakdown === s.id ? (
                            <p className="text-[#8A8A8A] text-sm text-center py-2">Loading...</p>
                          ) : riders && riders.length > 0 ? (
                            <div className="space-y-2">
                              {riders.map((r) => (
                                <div key={r.rider_id} className="flex items-center justify-between bg-[#F5F0EB] rounded-lg px-3 py-2">
                                  <div className="flex items-center gap-3">
                                    <span className="text-[#8A8A8A] font-mono text-xs w-6">#{r.number}</span>
                                    <div>
                                      <p className="text-[#1A1A1A] text-sm font-medium">{r.name}</p>
                                      <p className="text-[#A0A0A0] text-xs">{r.team} · {r.class}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="flex gap-1">
                                      {r.races.filter((rc) => rc.in_lineup).map((rc) => (
                                        <span
                                          key={rc.race_id}
                                          title={`R${rc.round_number}: ${rc.race_name} — P${rc.position || "?"} (${rc.points + rc.bonus_points}pts)`}
                                          className="w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center bg-[#E8E4DF] text-[#6B6B6B]"
                                        >
                                          {rc.points + rc.bonus_points}
                                        </span>
                                      ))}
                                    </div>
                                    <span className="text-[#1A1A1A] font-bold text-sm w-10 text-right">{r.total_points}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[#8A8A8A] text-sm text-center py-2">No rider data available</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {standings.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-[#A0A0A0]">
                    No standings yet. Set lineups and wait for race results!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Members */}
      <div className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4">Members</h2>
        <div className="space-y-2">
          {league.members.map((m) => (
            <div key={m.id} className="flex items-center justify-between bg-[#EBE7E2] rounded px-4 py-2">
              <span className="text-[#1A1A1A]">{m.username}</span>
              {m.id === league.commissioner_id && (
                <span className="text-[#8A8A8A] text-xs font-medium">Commissioner</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
