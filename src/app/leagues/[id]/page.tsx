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
  series: string;
  is_commissioner: boolean;
  group_id: number | null;
  season_year: number | null;
  archived_at: string | null;
  league_groups: { id: number; name: string } | null;
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
  const [showRenew, setShowRenew] = useState(false);
  const [renewSeries, setRenewSeries] = useState("mx");
  const [renewLineup450, setRenewLineup450] = useState(3);
  const [renewLineup250, setRenewLineup250] = useState(2);
  const [renewing, setRenewing] = useState(false);
  const [renewError, setRenewError] = useState("");

  useEffect(() => {
    fetch(`/api/leagues/${id}`).then((r) => r.json()).then((d) => { if (!d.error) setLeague(d); });
    fetch(`/api/leagues/${id}/leaderboard`).then((r) => r.json()).then((d) => { if (Array.isArray(d)) setStandings(d); });
  }, [id]);

  useEffect(() => {
    if (!league) return;
    const series = league.series ?? "sx";
    fetch(`/api/races?series=${series}`).then((r) => r.json()).then((races: Race[]) => {
      const upcoming = races.find((r) => r.status === "upcoming");
      setUpcomingRace(upcoming ?? null);
    });
  }, [league]);

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

  async function handleRenew() {
    setRenewError("");
    setRenewing(true);
    const res = await fetch(`/api/leagues/${id}/renew`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        series: renewSeries,
        season_year: new Date().getFullYear(),
        lineup_450: renewLineup450,
        lineup_250: renewLineup250,
      }),
    });
    const data = await res.json();
    setRenewing(false);
    if (res.ok) {
      router.push(`/leagues/${data.id}`);
    } else {
      setRenewError(data.error || "Something went wrong");
    }
  }

  if (!league) {
    return <div className="max-w-4xl mx-auto px-4 py-8 text-[#8A8A8A]">Loading...</div>;
  }

  function LeagueSettingsCard({ league, onSaved }: { league: League; onSaved: () => void }) {
    const editable = league.is_commissioner && league.draft_status === "waiting";
    const [editing, setEditing] = useState(false);
    const [maxMembers, setMaxMembers] = useState(league.max_members);
    const [rosterSize, setRosterSize] = useState(league.roster_size);
    const [lineup450, setLineup450] = useState(league.lineup_450);
    const [lineup250e, setLineup250e] = useState(league.lineup_250e);
    const [lineup250w, setLineup250w] = useState(league.lineup_250w);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");

    async function save() {
      setErr("");
      setSaving(true);
      const res = await fetch(`/api/leagues/${league.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          max_members: maxMembers,
          roster_size: rosterSize,
          lineup_450: lineup450,
          lineup_250e: lineup250e,
          lineup_250w: lineup250w,
        }),
      });
      setSaving(false);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error || "Save failed");
        return;
      }
      setEditing(false);
      onSaved();
    }

    if (!editing) {
      return (
        <div className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-4 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[#8A8A8A] text-xs uppercase tracking-wide">League Settings</h3>
            {editable && (
              <button onClick={() => setEditing(true)} className="text-[#1A1A1A] hover:underline text-xs font-semibold">
                Edit
              </button>
            )}
          </div>
          <div className="grid grid-cols-5 gap-4 text-center">
            <div><p className="text-[#1A1A1A] font-bold text-lg">{league.max_members}</p><p className="text-[#A0A0A0] text-xs">Members</p></div>
            <div><p className="text-[#1A1A1A] font-bold text-lg">{league.roster_size}</p><p className="text-[#A0A0A0] text-xs">Roster Size</p></div>
            <div><p className="text-[#1A1A1A] font-bold text-lg">{league.lineup_450}</p><p className="text-[#A0A0A0] text-xs">450 Slots</p></div>
            <div><p className="text-[#1A1A1A] font-bold text-lg">{league.lineup_250e}</p><p className="text-[#A0A0A0] text-xs">250E Slots</p></div>
            <div><p className="text-[#1A1A1A] font-bold text-lg">{league.lineup_250w}</p><p className="text-[#A0A0A0] text-xs">250W Slots</p></div>
          </div>
          {league.is_commissioner && league.draft_status !== "waiting" && (
            <p className="text-[#A0A0A0] text-[10px] mt-2 italic">Settings are locked once the draft starts.</p>
          )}
        </div>
      );
    }

    return (
      <div className="bg-[#F5F0EB] border-2 border-[#1A1A1A] rounded-xl p-4 mb-6 shadow-sm">
        <h3 className="text-[#1A1A1A] text-sm font-bold mb-3">Edit League Settings</h3>
        {err && <p className="text-red-700 text-xs mb-3 bg-red-50 border border-red-200 rounded p-2">{err}</p>}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
          <label className="block text-xs">
            <span className="text-[#8A8A8A] block mb-1">Members</span>
            <input type="number" min={2} max={20} value={maxMembers} onChange={(e) => setMaxMembers(parseInt(e.target.value) || 2)} className="w-full bg-white border border-[#D4D0CB] rounded px-2 py-1.5 text-[#1A1A1A] font-bold text-center" />
          </label>
          <label className="block text-xs">
            <span className="text-[#8A8A8A] block mb-1">Roster</span>
            <input type="number" min={8} max={40} value={rosterSize} onChange={(e) => setRosterSize(parseInt(e.target.value) || 8)} className="w-full bg-white border border-[#D4D0CB] rounded px-2 py-1.5 text-[#1A1A1A] font-bold text-center" />
          </label>
          <label className="block text-xs">
            <span className="text-[#8A8A8A] block mb-1">450 slots</span>
            <input type="number" min={1} max={22} value={lineup450} onChange={(e) => setLineup450(parseInt(e.target.value) || 1)} className="w-full bg-white border border-[#D4D0CB] rounded px-2 py-1.5 text-[#1A1A1A] font-bold text-center" />
          </label>
          <label className="block text-xs">
            <span className="text-[#8A8A8A] block mb-1">250E slots</span>
            <input type="number" min={0} max={22} value={lineup250e} onChange={(e) => setLineup250e(parseInt(e.target.value) || 0)} className="w-full bg-white border border-[#D4D0CB] rounded px-2 py-1.5 text-[#1A1A1A] font-bold text-center" />
          </label>
          <label className="block text-xs">
            <span className="text-[#8A8A8A] block mb-1">250W slots</span>
            <input type="number" min={0} max={22} value={lineup250w} onChange={(e) => setLineup250w(parseInt(e.target.value) || 0)} className="w-full bg-white border border-[#D4D0CB] rounded px-2 py-1.5 text-[#1A1A1A] font-bold text-center" />
          </label>
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="bg-[#1A1A1A] hover:bg-[#333] text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
          <button onClick={() => { setEditing(false); setErr(""); }} className="text-[#6B6B6B] hover:text-[#1A1A1A] px-4 py-2 text-sm">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const isFull = league.members.length >= league.max_members;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          {league.league_groups && (
            <Link
              href={`/groups/${league.league_groups.id}`}
              className="inline-flex items-center gap-1 text-xs text-[#8A8A8A] hover:text-[#1A1A1A] mb-1 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H7.83l4.88-4.88c.39-.39.39-1.03 0-1.42-.39-.39-1.02-.39-1.41 0l-6.59 6.59c-.39.39-.39 1.02 0 1.41l6.59 6.59c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L7.83 13H19c.55 0 1-.45 1-1s-.45-1-1-1z" />
              </svg>
              {league.league_groups.name}
              {league.season_year && <span className="text-[#A0A0A0]">· {league.season_year}</span>}
            </Link>
          )}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <Link
              href={`/leagues/${id}/team`}
              className="block bg-[#1A1A1A] hover:bg-[#333333] text-white rounded-xl p-4 text-center transition-colors shadow-sm"
            >
              <p className="font-semibold text-lg">My Team</p>
              <p className="text-white/60 text-xs mt-1">Roster, Lineup & Free Agents</p>
            </Link>
            <Link
              href={`/leagues/${id}/recap`}
              className="block bg-[#F5F0EB] hover:bg-[#EBE7E2] border border-[#D4D0CB] text-[#1A1A1A] rounded-xl p-4 text-center transition-colors shadow-sm"
            >
              <p className="font-semibold text-lg">Race Recap</p>
              <p className="text-[#8A8A8A] text-xs mt-1">Latest results, bonuses & league scores</p>
            </Link>
          </div>

          {/* Season Recap (full season awards) */}
          <Link
            href={`/leagues/${id}/season-recap`}
            className="block bg-gradient-to-r from-[#C8A84E]/10 to-[#1A1A1A]/5 hover:from-[#C8A84E]/20 border border-[#C8A84E]/40 text-[#1A1A1A] rounded-xl p-4 text-center transition-colors shadow-sm mb-6"
          >
            <p className="font-semibold text-lg">Season Recap</p>
            <p className="text-[#8A8A8A] text-xs mt-1">Champion, awards, top picks & season superlatives</p>
          </Link>

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
      <LeagueSettingsCard league={league} onSaved={() => fetch(`/api/leagues/${id}`).then((r) => r.json()).then((d) => { if (!d.error) setLeague(d); })} />

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

      {/* Renew Season — commissioner only, completed leagues only */}
      {league.is_commissioner && league.draft_status === "completed" && !league.archived_at && (
        <div className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-6 shadow-sm mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[#1A1A1A] font-semibold">Start New Season</h2>
              <p className="text-[#8A8A8A] text-sm mt-0.5">
                Archive this season and re-draft with the same members for the next series.
              </p>
            </div>
            {!showRenew && (
              <button
                onClick={() => {
                  setRenewLineup450(league.lineup_450);
                  setRenewLineup250(league.lineup_250e + league.lineup_250w);
                  setShowRenew(true);
                }}
                className="bg-[#1A1A1A] hover:bg-[#333333] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                Renew Season
              </button>
            )}
          </div>

          {showRenew && (
            <div className="mt-4 pt-4 border-t border-[#D4D0CB] space-y-4">
              {renewError && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2">{renewError}</p>
              )}
              <div>
                <label className="block text-[#8A8A8A] text-xs mb-1">New Series</label>
                <select
                  value={renewSeries}
                  onChange={(e) => setRenewSeries(e.target.value)}
                  className="w-full bg-[#EBE7E2] border border-[#D4D0CB] rounded px-3 py-2 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#1A1A1A]"
                >
                  <option value="mx">Outdoor Motocross (MX)</option>
                  <option value="smx">SuperMotocross Playoffs (SMX)</option>
                  <option value="sx">Supercross (SX)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#8A8A8A] text-xs mb-1">
                    {renewSeries === "sx" ? "450 Lineup Slots" : "450MX Lineup Slots"}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={renewLineup450}
                    onChange={(e) => setRenewLineup450(parseInt(e.target.value) || 1)}
                    className="w-full bg-[#EBE7E2] border border-[#D4D0CB] rounded px-3 py-2 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#1A1A1A]"
                  />
                </div>
                <div>
                  <label className="block text-[#8A8A8A] text-xs mb-1">
                    {renewSeries === "sx" ? "250 Lineup Slots (E+W)" : "250MX Lineup Slots"}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={renewLineup250}
                    onChange={(e) => setRenewLineup250(parseInt(e.target.value) || 1)}
                    className="w-full bg-[#EBE7E2] border border-[#D4D0CB] rounded px-3 py-2 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#1A1A1A]"
                  />
                </div>
              </div>
              <p className="text-[#A0A0A0] text-xs">
                All {league.members.length} members will be carried over automatically. The current season is archived and viewable via Franchise History.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleRenew}
                  disabled={renewing}
                  className="bg-[#1A1A1A] hover:bg-[#333333] text-white px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
                >
                  {renewing ? "Creating new season..." : "Confirm & Start New Season"}
                </button>
                <button
                  onClick={() => { setShowRenew(false); setRenewError(""); }}
                  className="text-[#8A8A8A] hover:text-[#1A1A1A] text-sm px-3 py-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
