"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface League {
  id: number;
  name: string;
  invite_code: string;
  member_count: number;
  max_members: number;
  roster_size: number;
  lineup_450: number;
  lineup_250e: number;
  lineup_250w: number;
  draft_status: string;
  is_commissioner: number;
}

interface SearchResult {
  id: number;
  name: string;
  member_count: number;
}

export default function LeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [tab, setTab] = useState<"my" | "create" | "join">("my");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Create form
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [maxMembers, setMaxMembers] = useState(4);
  const [rosterSize, setRosterSize] = useState(8);
  const [lineup450, setLineup450] = useState(3);
  const [lineup250e, setLineup250e] = useState(2);
  const [lineup250w, setLineup250w] = useState(2);

  // Join form
  const [inviteCode, setInviteCode] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [joinPassword, setJoinPassword] = useState("");
  const [joinLeagueId, setJoinLeagueId] = useState<number | null>(null);

  useEffect(() => {
    loadLeagues();
  }, []);

  function loadLeagues() {
    fetch("/api/leagues").then((r) => r.json()).then(setLeagues);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    const totalSlots = lineup450 + lineup250e + lineup250w;
    if (rosterSize < totalSlots) {
      setError(`Roster size (${rosterSize}) must be at least the total lineup slots (${totalSlots})`);
      return;
    }

    const res = await fetch("/api/leagues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        name, password, max_members: maxMembers, roster_size: rosterSize,
        lineup_450: lineup450, lineup_250e: lineup250e, lineup_250w: lineup250w,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage(`League created! Invite code: ${data.invite_code}`);
      setName("");
      setPassword("");
      loadLeagues();
      setTab("my");
    } else {
      setError(data.error);
    }
  }

  async function handleJoinByCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/leagues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join", inviteCode }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage("Joined league!");
      setInviteCode("");
      loadLeagues();
      setTab("my");
    } else {
      setError(data.error);
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    const res = await fetch(`/api/leagues?search=${encodeURIComponent(searchQuery)}`);
    const data = await res.json();
    setSearchResults(data);
  }

  async function handleJoinByPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!joinLeagueId) return;
    setError("");
    const res = await fetch("/api/leagues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join_by_name", leagueId: joinLeagueId, password: joinPassword }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage("Joined league!");
      setJoinPassword("");
      setJoinLeagueId(null);
      setSearchResults([]);
      loadLeagues();
      setTab("my");
    } else {
      setError(data.error);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-[#1A1A1A] mb-6">Leagues</h1>

      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded mb-4 text-sm">
          {message}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#F5F0EB] rounded-lg p-1">
        {(["my", "create", "join"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setError(""); setMessage(""); }}
            className={`flex-1 py-2 px-4 rounded text-sm font-medium transition-colors ${
              tab === t ? "bg-[#1A1A1A] text-white shadow-sm" : "text-[#8A8A8A] hover:text-[#1A1A1A]"
            }`}
          >
            {t === "my" ? "My Leagues" : t === "create" ? "Create League" : "Join League"}
          </button>
        ))}
      </div>

      {/* My Leagues */}
      {tab === "my" && (
        <div className="space-y-3">
          {leagues.map((league) => (
            <Link
              key={league.id}
              href={`/leagues/${league.id}`}
              className="block bg-[#F5F0EB] border border-[#D4D0CB] hover:border-[#1A1A1A] rounded-xl p-5 transition-all shadow-sm hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[#1A1A1A] font-semibold text-lg">{league.name}</h3>
                  <p className="text-[#8A8A8A] text-sm mt-1">
                    {league.member_count}/{league.max_members} members
                    {league.is_commissioner ? " · Commissioner" : ""}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    league.draft_status === "waiting" ? "bg-amber-100 text-amber-700"
                    : league.draft_status === "drafting" ? "bg-blue-100 text-blue-700"
                    : "bg-emerald-100 text-emerald-700"
                  }`}>
                    {league.draft_status === "waiting" ? "Waiting for members"
                    : league.draft_status === "drafting" ? "Draft in progress"
                    : "Active"}
                  </span>
                </div>
              </div>
            </Link>
          ))}
          {leagues.length === 0 && (
            <div className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-8 text-center">
              <div className="w-16 h-16 bg-[#E8E4DF] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[#8A8A8A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
              </div>
              <h3 className="text-[#1A1A1A] font-semibold text-lg mb-1">No leagues yet</h3>
              <p className="text-[#8A8A8A] text-sm mb-5">
                Create a league and invite friends, or join an existing one to get started.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => { setTab("create"); setError(""); setMessage(""); }}
                  className="bg-[#1A1A1A] hover:bg-[#333333] text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                >
                  Create League
                </button>
                <button
                  onClick={() => { setTab("join"); setError(""); setMessage(""); }}
                  className="bg-[#E8E4DF] hover:bg-[#D4D0CB] text-[#1A1A1A] px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                >
                  Join League
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create League */}
      {tab === "create" && (
        <form onSubmit={handleCreate} className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-[#8A8A8A] text-sm mb-1">League Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#EBE7E2] border border-[#D4D0CB] rounded px-3 py-2 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#1A1A1A]"
              required
            />
          </div>
          <div>
            <label className="block text-[#8A8A8A] text-sm mb-1">Number of Players</label>
            <input
              type="number"
              min={2}
              max={20}
              value={maxMembers}
              onChange={(e) => setMaxMembers(parseInt(e.target.value) || 4)}
              className="w-full bg-[#EBE7E2] border border-[#D4D0CB] rounded px-3 py-2 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#1A1A1A]"
            />
          </div>
          <div>
            <label className="block text-[#8A8A8A] text-sm mb-1">League Password</label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#EBE7E2] border border-[#D4D0CB] rounded px-3 py-2 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#1A1A1A]"
              required
            />
          </div>
          <div>
            <label className="block text-[#8A8A8A] text-sm mb-1">Roster Size (1-30)</label>
            <input
              type="number"
              min={1}
              max={30}
              value={rosterSize}
              onChange={(e) => setRosterSize(parseInt(e.target.value) || 8)}
              className="w-full bg-[#EBE7E2] border border-[#D4D0CB] rounded px-3 py-2 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#1A1A1A]"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[#8A8A8A] text-sm mb-1">450 Lineup Slots</label>
              <input
                type="number"
                min={1}
                max={10}
                value={lineup450}
                onChange={(e) => setLineup450(parseInt(e.target.value) || 3)}
                className="w-full bg-[#EBE7E2] border border-[#D4D0CB] rounded px-3 py-2 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#1A1A1A]"
              />
            </div>
            <div>
              <label className="block text-[#8A8A8A] text-sm mb-1">250E Lineup Slots</label>
              <input
                type="number"
                min={1}
                max={10}
                value={lineup250e}
                onChange={(e) => setLineup250e(parseInt(e.target.value) || 2)}
                className="w-full bg-[#EBE7E2] border border-[#D4D0CB] rounded px-3 py-2 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#1A1A1A]"
              />
            </div>
            <div>
              <label className="block text-[#8A8A8A] text-sm mb-1">250W Lineup Slots</label>
              <input
                type="number"
                min={1}
                max={10}
                value={lineup250w}
                onChange={(e) => setLineup250w(parseInt(e.target.value) || 2)}
                className="w-full bg-[#EBE7E2] border border-[#D4D0CB] rounded px-3 py-2 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#1A1A1A]"
              />
            </div>
          </div>
          <p className="text-[#A0A0A0] text-xs">
            Total lineup slots: {lineup450 + lineup250e + lineup250w} · Roster must hold at least this many riders
          </p>
          <button
            type="submit"
            className="w-full bg-[#1A1A1A] hover:bg-[#333333] text-white py-2 rounded font-semibold"
          >
            Create League
          </button>
        </form>
      )}

      {/* Join League */}
      {tab === "join" && (
        <div className="space-y-6">
          {/* Join by code */}
          <form onSubmit={handleJoinByCode} className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-6">
            <h3 className="text-[#1A1A1A] font-semibold mb-3">Join with Invite Code</h3>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Enter invite code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="flex-1 bg-[#EBE7E2] border border-[#D4D0CB] rounded px-3 py-2 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#1A1A1A] uppercase"
                required
              />
              <button
                type="submit"
                className="bg-[#1A1A1A] hover:bg-[#333333] text-white px-6 py-2 rounded text-sm font-semibold"
              >
                Join
              </button>
            </div>
          </form>

          {/* Search */}
          <div className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-6">
            <h3 className="text-[#1A1A1A] font-semibold mb-3">Search by League Name</h3>
            <div className="flex gap-3 mb-4">
              <input
                type="text"
                placeholder="Search leagues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-[#EBE7E2] border border-[#D4D0CB] rounded px-3 py-2 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#1A1A1A]"
              />
              <button
                onClick={handleSearch}
                type="button"
                className="bg-[#E8E4DF] hover:bg-[#D4D0CB] text-[#1A1A1A] px-6 py-2 rounded text-sm font-semibold"
              >
                Search
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((league) => (
                  <div key={league.id} className="flex items-center justify-between bg-[#EBE7E2] rounded px-4 py-3">
                    <div>
                      <span className="text-[#1A1A1A] font-medium">{league.name}</span>
                      <span className="text-[#A0A0A0] text-sm ml-2">
                        {league.member_count} member{league.member_count !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <button
                      onClick={() => setJoinLeagueId(league.id)}
                      className="bg-[#1A1A1A] hover:bg-[#333333] text-white px-3 py-1.5 rounded text-sm"
                    >
                      Join
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Password prompt */}
            {joinLeagueId && (
              <form onSubmit={handleJoinByPassword} className="mt-4 p-4 bg-[#EBE7E2] rounded-lg">
                <p className="text-[#6B6B6B] text-sm mb-2">Enter league password to join:</p>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="League password"
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    className="flex-1 bg-[#E8E4DF] border border-[#D4D0CB] rounded px-3 py-2 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#1A1A1A]"
                    required
                  />
                  <button
                    type="submit"
                    className="bg-[#1A1A1A] hover:bg-[#333333] text-white px-4 py-2 rounded text-sm font-semibold"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => { setJoinLeagueId(null); setJoinPassword(""); }}
                    className="text-[#8A8A8A] hover:text-[#000000] px-3 py-2 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
