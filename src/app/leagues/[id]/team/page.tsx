"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import TeamLogo from "@/components/TeamLogo";
import MotoBike, { BIKE_BRANDS, parseBikeConfig } from "@/components/MotoBike";

interface Rider {
  id: number;
  name: string;
  number: number | null;
  team: string | null;
  class: string;
}

interface League {
  id: number;
  name: string;
  lineup_450: number;
  lineup_250e: number;
  lineup_250w: number;
  draft_status: string;
}

interface Race {
  id: number;
  name: string;
  round_number: number | null;
  status: string;
  race_time: string | null;
}

interface Transaction {
  id: number;
  user_id: number;
  username: string;
  type: string;
  added_rider_name: string | null;
  added_rider_number: number | null;
  added_rider_class: string | null;
  dropped_rider_name: string | null;
  dropped_rider_number: number | null;
  dropped_rider_class: string | null;
  created_at: string;
}

interface TeamData {
  team_name: string | null;
  team_logo: string | null;
  league: League;
  upcoming_race: Race | null;
  lineup: Rider[];
  roster: Rider[];
}

interface FreeAgentData {
  freeAgents: Rider[];
  myRoster: Rider[];
  transactions: Transaction[];
  rosterSize: number;
}

const WEST_ROUNDS = new Set([1, 2, 3, 4, 5, 6, 16]);
const EAST_ROUNDS = new Set([7, 8, 9, 11, 13, 14, 15]);
const SHOWDOWN_ROUNDS = new Set([10, 12, 17]);

function get250Region(roundNumber: number | null): "west" | "east" | "showdown" | null {
  if (roundNumber == null) return null;
  if (WEST_ROUNDS.has(roundNumber)) return "west";
  if (EAST_ROUNDS.has(roundNumber)) return "east";
  if (SHOWDOWN_ROUNDS.has(roundNumber)) return "showdown";
  return null;
}

export default function TeamPage() {
  const { id } = useParams();
  const [data, setData] = useState<TeamData | null>(null);
  const [editing, setEditing] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [bikeBrand, setBikeBrand] = useState("ktm");
  const [bikeNumber, setBikeNumber] = useState(1);
  const [showBikeEditor, setShowBikeEditor] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Tab state
  const [tab, setTab] = useState<"roster" | "freeAgents" | "activity">("roster");

  // Lineup state
  const [races, setRaces] = useState<Race[]>([]);
  const [selectedRace, setSelectedRace] = useState<number | null>(null);
  const [selectedRiders, setSelectedRiders] = useState<Set<number>>(new Set());
  const [lineupMessage, setLineupMessage] = useState("");
  const [lineupError, setLineupError] = useState("");
  const [savingLineup, setSavingLineup] = useState(false);
  const [stats, setStats] = useState<Record<number, {
    avgFinish: number;
    totalPoints: number;
    totalBonus: number;
    racesRaced: number;
    recent: { round: number; position: number; points: number }[];
  }>>({});

  // Free agent state
  const [faData, setFaData] = useState<FreeAgentData | null>(null);
  const [faFilter, setFaFilter] = useState("");
  const [faClassFilter, setFaClassFilter] = useState("all");
  const [selectedAdd, setSelectedAdd] = useState<Rider | null>(null);
  const [selectedDrop, setSelectedDrop] = useState<Rider | null>(null);
  const [faMessage, setFaMessage] = useState("");
  const [faSubmitting, setFaSubmitting] = useState(false);
  const [showDropModal, setShowDropModal] = useState(false);

  // Load team data
  useEffect(() => {
    fetch(`/api/leagues/${id}/team`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setTeamName(d.team_name || "");
        const bike = parseBikeConfig(d.team_logo);
        if (bike) {
          setBikeBrand(bike.brand);
          setBikeNumber(bike.number);
        }
      });
  }, [id]);

  // Load races for lineup
  useEffect(() => {
    fetch("/api/races").then((r) => r.json()).then((data: Race[]) => {
      setRaces(data);
      const upcoming = data.find((r) => r.status === "upcoming");
      if (upcoming) setSelectedRace(upcoming.id);
    });
    fetch(`/api/leagues/${id}/rider-stats`).then((r) => r.json()).then(setStats);
  }, [id]);

  // Load existing lineup when race changes
  useEffect(() => {
    if (selectedRace && id) {
      fetch(`/api/leagues/${id}/lineup?raceId=${selectedRace}`)
        .then((r) => r.json())
        .then((lineup: Rider[]) => {
          if (Array.isArray(lineup)) {
            setSelectedRiders(new Set(lineup.map((r) => r.id)));
          }
        });
    }
  }, [selectedRace, id]);

  // Load free agent data
  const loadFaData = useCallback(() => {
    fetch(`/api/leagues/${id}/free-agents`).then((r) => r.json()).then(setFaData);
  }, [id]);

  useEffect(() => {
    loadFaData();
  }, [loadFaData]);

  // Team name/logo handlers
  async function saveTeam() {
    const config = JSON.stringify({ brand: bikeBrand, number: bikeNumber });
    setSaving(true);
    await fetch(`/api/leagues/${id}/team`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_name: teamName, team_logo: config }),
    });
    setSaving(false);
    setEditing(false);
    setShowBikeEditor(false);
    setData((prev) => prev ? { ...prev, team_name: teamName || null, team_logo: config } : prev);
    setMessage("Team saved!");
    setTimeout(() => setMessage(""), 2000);
  }

  // Lineup handlers
  function toggleRider(riderId: number) {
    const next = new Set(selectedRiders);
    if (next.has(riderId)) {
      next.delete(riderId);
    } else {
      next.add(riderId);
    }
    setSelectedRiders(next);
  }

  function getClassCount(cls: string) {
    if (!data) return 0;
    return data.roster.filter((r) => r.class === cls && selectedRiders.has(r.id)).length;
  }

  function getClassLimit(cls: string) {
    if (!data) return 0;
    if (cls === "450") return data.league.lineup_450;
    if (cls === "250E") return data.league.lineup_250e;
    if (cls === "250W") return data.league.lineup_250w;
    return 0;
  }

  const selectedRaceObj = races.find((r) => r.id === selectedRace);
  const isRaceLocked = selectedRaceObj?.status === "completed" ||
    (!!selectedRaceObj?.race_time && new Date(selectedRaceObj.race_time) <= new Date());
  const raceRegion = get250Region(selectedRaceObj?.round_number ?? null);

  const show250E = raceRegion === "east" || raceRegion === "showdown" || raceRegion === null;
  const show250W = raceRegion === "west" || raceRegion === "showdown" || raceRegion === null;

  const isLineupValid = data &&
    getClassCount("450") === data.league.lineup_450 &&
    (show250E ? getClassCount("250E") === data.league.lineup_250e : true) &&
    (show250W ? getClassCount("250W") === data.league.lineup_250w : true);

  async function handleSaveLineup() {
    if (!selectedRace || !isLineupValid || !data) return;
    setSavingLineup(true);
    setLineupError("");
    setLineupMessage("");

    const activeRiderIds = Array.from(selectedRiders).filter((riderId) => {
      const rider = data.roster.find((r) => r.id === riderId);
      if (!rider) return false;
      if (rider.class === "250E" && !show250E) return false;
      if (rider.class === "250W" && !show250W) return false;
      return true;
    });

    const res = await fetch(`/api/leagues/${id}/lineup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raceId: selectedRace, riderIds: activeRiderIds, raceRegion }),
    });
    const result = await res.json();
    setSavingLineup(false);

    if (res.ok) {
      setLineupMessage("Lineup saved!");
      setTimeout(() => setLineupMessage(""), 3000);
    } else {
      setLineupError(result.error);
    }
  }

  // Free agent handlers
  async function handleFaTransaction() {
    if (!selectedAdd && !selectedDrop) return;
    setFaSubmitting(true);
    setFaMessage("");

    const res = await fetch(`/api/leagues/${id}/free-agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        addRiderId: selectedAdd?.id || null,
        dropRiderId: selectedDrop?.id || null,
      }),
    });

    const result = await res.json();
    setFaSubmitting(false);

    if (!res.ok) {
      setFaMessage(result.error);
      return;
    }

    setSelectedAdd(null);
    setSelectedDrop(null);
    setFaMessage("Transaction complete!");
    loadFaData();
    // Refresh team data to update roster
    fetch(`/api/leagues/${id}/team`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setTeamName(d.team_name || "");
      });
    setTimeout(() => setFaMessage(""), 3000);
  }

  if (!data) return <div className="max-w-4xl mx-auto px-4 py-8 text-[#8A8A8A]">Loading...</div>;

  const displayName = data.team_name || "My Team";

  const allClasses = [
    { key: "450", label: "450 Class", show: true },
    { key: "250E", label: "250 East", show: show250E },
    { key: "250W", label: "250 West", show: show250W },
  ];
  const activeClasses = allClasses.filter((c) => c.show);

  const rosterFull = faData ? faData.myRoster.length >= faData.rosterSize : false;

  const filteredFreeAgents = faData ? faData.freeAgents.filter((r) => {
    const matchesSearch = r.name.toLowerCase().includes(faFilter.toLowerCase()) ||
      (r.team && r.team.toLowerCase().includes(faFilter.toLowerCase()));
    const matchesClass = faClassFilter === "all" || r.class === faClassFilter;
    return matchesSearch && matchesClass;
  }) : [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-lg mb-4 text-sm">
          {message}
        </div>
      )}

      {/* Team Header */}
      <div className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-6 mb-6 shadow-sm">
        <div className="flex items-center gap-5">
          {/* Bike Logo */}
          <div>
            <div className="w-20 h-20 rounded-xl bg-[#EBE7E2] border-2 border-[#D4D0CB] flex items-center justify-center overflow-hidden shadow-inner">
              {parseBikeConfig(data.team_logo) ? (
                <MotoBike brand={parseBikeConfig(data.team_logo)!.brand} number={parseBikeConfig(data.team_logo)!.number} size="lg" />
              ) : (
                <span className="text-3xl font-light text-[#A0A0A0]">{displayName.charAt(0).toUpperCase()}</span>
              )}
            </div>
          </div>

          {/* Name */}
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[#1A1A1A] tracking-tight">{displayName}</h1>
              <button
                onClick={() => { setEditing(true); setShowBikeEditor(true); }}
                className="text-[#A0A0A0] hover:text-[#1A1A1A] text-sm transition-colors"
              >
                Edit
              </button>
            </div>
            <p className="text-[#8A8A8A] text-sm mt-1">{data.league.name}</p>
          </div>
        </div>

        {/* Edit Panel — team name + number plate */}
        {editing && (
          <div className="mt-5 pt-5 border-t border-[#D4D0CB] space-y-5">
            {/* Team Name */}
            <div>
              <label className="block text-xs text-[#8A8A8A] uppercase tracking-wide mb-2">Team Name</label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                maxLength={30}
                className="w-full bg-white border border-[#D4D0CB] rounded-lg px-3 py-2 text-[#1A1A1A] text-lg font-bold focus:outline-none focus:border-[#1A1A1A]"
                autoFocus
              />
            </div>

            {/* Number Plate */}
            <div>
              <h3 className="text-xs text-[#8A8A8A] uppercase tracking-wide mb-2">Number Plate</h3>

              {/* Brand picker */}
              <div className="mb-4">
                <label className="block text-xs text-[#8A8A8A] mb-2">Brand (color)</label>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(BIKE_BRANDS).map(([key, { color, label }]) => (
                    <button
                      key={key}
                      onClick={() => setBikeBrand(key)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 transition-all text-sm font-medium ${
                        bikeBrand === key
                          ? "border-[#1A1A1A] bg-white shadow-sm"
                          : "border-[#D4D0CB] bg-[#EBE7E2] hover:border-[#8A8A8A]"
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-[#1A1A1A] truncate">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Number picker */}
              <div className="mb-4">
                <label className="block text-xs text-[#8A8A8A] mb-2">Plate Number</label>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={bikeNumber}
                  onChange={(e) => setBikeNumber(Math.max(1, Math.min(999, parseInt(e.target.value) || 1)))}
                  className="w-24 bg-white border border-[#D4D0CB] rounded-lg px-3 py-2 text-[#1A1A1A] text-lg font-bold text-center focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              {/* Preview */}
              <div className="flex items-center gap-4 bg-[#EBE7E2] rounded-lg p-4">
                <MotoBike brand={bikeBrand} number={bikeNumber} size="lg" />
                <div>
                  <p className="text-[#1A1A1A] font-semibold">{BIKE_BRANDS[bikeBrand]?.label} #{bikeNumber}</p>
                  <p className="text-[#8A8A8A] text-xs">Preview</p>
                </div>
              </div>
            </div>

            {/* Save / Cancel */}
            <div className="flex gap-2">
              <button
                onClick={saveTeam}
                disabled={saving}
                className="bg-[#1A1A1A] hover:bg-[#333333] text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setShowBikeEditor(false);
                  setTeamName(data.team_name || "");
                  const bike = parseBikeConfig(data.team_logo);
                  if (bike) {
                    setBikeBrand(bike.brand);
                    setBikeNumber(bike.number);
                  }
                }}
                className="text-[#8A8A8A] hover:text-[#1A1A1A] px-3 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* League Home Link */}
      <div className="mb-6">
        <Link
          href={`/leagues/${id}`}
          className="inline-flex items-center gap-1 text-[#8A8A8A] hover:text-[#1A1A1A] text-sm transition-colors"
        >
          &larr; League Home
        </Link>
      </div>

      {/* Tabs */}
      {data.league.draft_status === "completed" && (
        <>
          <div className="flex gap-1 bg-[#EBE7E2] rounded-lg p-1 mb-6">
            {[
              { key: "roster" as const, label: "My Roster" },
              { key: "freeAgents" as const, label: "Free Agents" },
              { key: "activity" as const, label: "Activity" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 py-2.5 px-3 rounded-md text-sm font-medium transition-colors ${
                  tab === key
                    ? "bg-[#1A1A1A] text-white shadow-sm"
                    : "text-[#6B6B6B] hover:text-[#1A1A1A]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ===== ROSTER TAB ===== */}
          {tab === "roster" && (
            <>
              {/* Race Selector */}
              <div className="mb-4">
                <label className="block text-[#8A8A8A] text-xs uppercase tracking-wide mb-1">Select Race</label>
                <select
                  value={selectedRace || ""}
                  onChange={(e) => {
                    setSelectedRace(parseInt(e.target.value));
                    setLineupMessage("");
                    setLineupError("");
                  }}
                  className="w-full bg-[#EBE7E2] border border-[#D4D0CB] rounded-lg px-3 py-2 text-[#1A1A1A] text-sm"
                >
                  <option value="">Select a race...</option>
                  {races.map((race) => {
                    const started = race.race_time && new Date(race.race_time) <= new Date();
                    return (
                      <option key={race.id} value={race.id}>
                        {race.round_number && `R${race.round_number}: `}{race.name}
                        {race.status === "completed" ? " (Completed)" : started ? " (Locked)" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Region badge */}
              {selectedRace && raceRegion && (
                <div className="mb-4 flex items-center gap-2">
                  {raceRegion === "west" && (
                    <span className="bg-blue-100 text-blue-700 text-xs font-bold uppercase px-2.5 py-1 rounded-full">250 West Only</span>
                  )}
                  {raceRegion === "east" && (
                    <span className="bg-red-100 text-red-700 text-xs font-bold uppercase px-2.5 py-1 rounded-full">250 East Only</span>
                  )}
                  {raceRegion === "showdown" && (
                    <span className="bg-purple-100 text-purple-700 text-xs font-bold uppercase px-2.5 py-1 rounded-full">E/W Showdown</span>
                  )}
                </div>
              )}

              {isRaceLocked && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-lg mb-4 text-sm">
                  {selectedRaceObj?.status === "completed"
                    ? "This race is completed. Lineup is locked."
                    : "This race has started. Lineup is locked."}
                </div>
              )}

              {lineupMessage && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-lg mb-4 text-sm">
                  {lineupMessage}
                </div>
              )}
              {lineupError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg mb-4 text-sm">
                  {lineupError}
                </div>
              )}

              {/* Roster by class with lineup checkboxes */}
              {data.roster.length === 0 ? (
                <div className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-8 text-center shadow-sm">
                  <p className="text-[#8A8A8A]">No riders on your roster yet.</p>
                </div>
              ) : (
                <>
                  {activeClasses.map(({ key, label }) => {
                    const classRiders = data.roster.filter((r) => r.class === key);
                    const count = getClassCount(key);
                    const limit = getClassLimit(key);
                    const isFull = count === limit;
                    if (classRiders.length === 0) return null;

                    return (
                      <div key={key} className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xs font-bold text-[#8A8A8A] uppercase tracking-widest">{label}</h3>
                          {selectedRace && (
                            <span className={`text-xs font-bold ${isFull ? "text-green-600" : "text-[#8A8A8A]"}`}>
                              {count}/{limit} starting
                            </span>
                          )}
                        </div>
                        <div className="space-y-2">
                          {classRiders.map((rider) => {
                            const isSelected = selectedRiders.has(rider.id);
                            const canSelect = !selectedRace || isSelected || count < limit;
                            const riderStats = stats[rider.id];

                            return (
                              <button
                                key={rider.id}
                                onClick={() => selectedRace && !isRaceLocked && canSelect && toggleRider(rider.id)}
                                disabled={!selectedRace || isRaceLocked || (!isSelected && !canSelect)}
                                className={`w-full flex items-center justify-between rounded-lg p-3 border-2 transition-colors text-left ${
                                  isSelected
                                    ? "bg-[#E8E4DF] border-green-500"
                                    : canSelect && selectedRace
                                    ? "bg-[#E8E4DF] border-[#D4D0CB] hover:border-[#8A8A8A]"
                                    : "bg-[#E8E4DF] border-[#D4D0CB]"
                                } ${!selectedRace ? "cursor-default" : ""}`}
                              >
                                <div className="flex items-center gap-2">
                                  {selectedRace && (
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                                      isSelected ? "border-green-500 bg-green-500" : "border-[#D4D0CB]"
                                    }`}>
                                      {isSelected && (
                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                    </div>
                                  )}
                                  <TeamLogo team={rider.team} size="sm" />
                                  {rider.number != null && (
                                    <span className="text-[#1A1A1A] font-bold">#{rider.number}</span>
                                  )}
                                  <span className="text-[#1A1A1A] font-medium">{rider.name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  {riderStats ? (
                                    <>
                                      <div className="text-right hidden sm:block min-w-[50px]">
                                        <div className="text-[#1A1A1A] text-xs font-semibold">{riderStats.totalPoints} pts</div>
                                        <div className="text-[#8A8A8A] text-xs">Avg P{riderStats.avgFinish}</div>
                                      </div>
                                      {riderStats.recent.length > 0 && (
                                        <div className="hidden sm:flex gap-1">
                                          {riderStats.recent.map((r, i) => (
                                            <span
                                              key={i}
                                              className={`text-xs w-6 h-6 flex items-center justify-center rounded font-bold shrink-0 ${
                                                r.position <= 3
                                                  ? "bg-[#C8A84E]/20 text-[#C8A84E]"
                                                  : r.position <= 10
                                                  ? "bg-[#1A1A1A]/10 text-[#1A1A1A]"
                                                  : "bg-[#E8E4DF] text-[#8A8A8A]"
                                              }`}
                                              title={`R${r.round}: P${r.position}`}
                                            >
                                              {r.position}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                      <span className="text-[#1A1A1A] text-xs font-semibold sm:hidden">
                                        {riderStats.totalPoints}pts
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-[#A0A0A0] text-xs">No stats</span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Save Lineup Button */}
                  {selectedRace && !isRaceLocked && (
                    <button
                      onClick={handleSaveLineup}
                      disabled={!isLineupValid || savingLineup}
                      className={`w-full py-3 rounded-lg font-bold text-lg transition-colors ${
                        isLineupValid
                          ? "bg-[#1A1A1A] hover:bg-[#333333] text-white"
                          : "bg-[#E8E4DF] text-[#A0A0A0] cursor-not-allowed"
                      }`}
                    >
                      {savingLineup ? "Saving..." : isLineupValid ? "Save Lineup" : "Fill all lineup slots to save"}
                    </button>
                  )}
                </>
              )}
            </>
          )}

          {/* ===== FREE AGENTS TAB ===== */}
          {tab === "freeAgents" && faData && (
            <>
              <p className="text-[#8A8A8A] text-sm mb-4">
                Roster: {faData.myRoster.length}/{faData.rosterSize} riders
              </p>

              {faMessage && (
                <div className={`rounded-lg px-4 py-2 mb-4 text-sm font-medium ${
                  faMessage.includes("error") || faMessage.includes("full") || faMessage.includes("already")
                    ? "bg-red-50 border border-red-200 text-red-700"
                    : "bg-green-50 border border-green-200 text-green-700"
                }`}>
                  {faMessage}
                </div>
              )}

              {/* Search & Filter */}
              <div className="flex gap-3 mb-4">
                <input
                  type="text"
                  placeholder="Search riders or teams..."
                  value={faFilter}
                  onChange={(e) => setFaFilter(e.target.value)}
                  className="flex-1 bg-[#EBE7E2] border border-[#D4D0CB] rounded-lg px-3 py-2 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#1A1A1A]"
                />
                <select
                  value={faClassFilter}
                  onChange={(e) => setFaClassFilter(e.target.value)}
                  className="bg-[#EBE7E2] border border-[#D4D0CB] rounded-lg px-3 py-2 text-[#1A1A1A] text-sm"
                >
                  <option value="all">All Classes</option>
                  <option value="450">450</option>
                  <option value="250E">250 East</option>
                  <option value="250W">250 West</option>
                </select>
              </div>

              {/* Available Free Agents */}
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredFreeAgents.map((rider) => (
                  <div
                    key={rider.id}
                    className="rounded-lg p-3 border bg-[#E8E4DF] border-[#D4D0CB] hover:border-[#8A8A8A] flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <TeamLogo team={rider.team} size="sm" />
                      <div>
                        <div className="flex items-center gap-2">
                          {rider.number != null && (
                            <span className="text-[#1A1A1A] font-bold">#{rider.number}</span>
                          )}
                          <span className="text-[#1A1A1A] font-medium">{rider.name}</span>
                        </div>
                        <div className="flex gap-2 mt-0.5">
                          {rider.team && <span className="text-[#8A8A8A] text-xs">{rider.team}</span>}
                          <span className="text-[#A0A0A0] text-xs bg-[#D4D0CB] px-1.5 py-0.5 rounded">{rider.class}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedAdd(rider);
                        if (rosterFull) {
                          setShowDropModal(true);
                        } else {
                          // Not full — can add directly without dropping
                          setSelectedDrop(null);
                          setShowDropModal(true);
                        }
                      }}
                      className="bg-[#1A1A1A] hover:bg-[#333] text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
                    >
                      + Add
                    </button>
                  </div>
                ))}
                {filteredFreeAgents.length === 0 && (
                  <p className="text-[#A0A0A0] text-center py-8">No free agents match your search.</p>
                )}
              </div>

              {/* Drop Modal */}
              {showDropModal && selectedAdd && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setShowDropModal(false); setSelectedAdd(null); setSelectedDrop(null); }}>
                  <div className="bg-[#F5F0EB] rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                    {/* Modal Header */}
                    <div className="bg-[#1A1A1A] text-white p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-lg">Add Player</h3>
                        <button
                          onClick={() => { setShowDropModal(false); setSelectedAdd(null); setSelectedDrop(null); }}
                          className="text-gray-400 hover:text-white"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex items-center gap-2 bg-green-900/30 border border-green-700 rounded-lg px-3 py-2">
                        <span className="text-green-400 text-xs font-bold uppercase">Adding</span>
                        <TeamLogo team={selectedAdd.team} size="sm" />
                        <span className="text-white text-sm font-medium">
                          {selectedAdd.number != null && `#${selectedAdd.number} `}{selectedAdd.name}
                        </span>
                        <span className="text-gray-400 text-xs ml-auto">{selectedAdd.class}</span>
                      </div>
                    </div>

                    {/* Modal Body */}
                    <div className="p-4 overflow-y-auto max-h-[50vh]">
                      {rosterFull ? (
                        <>
                          <p className="text-[#8A8A8A] text-sm mb-3">Your roster is full. Select a rider to drop:</p>
                          <div className="space-y-4">
                            {(["450", "250E", "250W"] as const).map((cls) => {
                              const label = cls === "450" ? "450 Class" : cls === "250E" ? "250 East" : "250 West";
                              const riders = faData.myRoster.filter((r) => r.class === cls);
                              if (riders.length === 0) return null;
                              return (
                                <div key={cls}>
                                  <h4 className="text-xs font-bold text-[#8A8A8A] uppercase tracking-widest mb-1.5">{label}</h4>
                                  <div className="space-y-1.5">
                                    {riders.map((rider) => {
                                      const isSelected = selectedDrop?.id === rider.id;
                                      return (
                                        <button
                                          key={rider.id}
                                          onClick={() => setSelectedDrop(isSelected ? null : rider)}
                                          className={`w-full rounded-lg p-3 border-2 flex items-center gap-3 transition-colors text-left ${
                                            isSelected
                                              ? "bg-red-50 border-red-400"
                                              : "bg-[#E8E4DF] border-[#D4D0CB] hover:border-red-300"
                                          }`}
                                        >
                                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                            isSelected ? "border-red-500 bg-red-500" : "border-[#D4D0CB]"
                                          }`}>
                                            {isSelected && (
                                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                              </svg>
                                            )}
                                          </div>
                                          <TeamLogo team={rider.team} size="sm" />
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                              {rider.number != null && (
                                                <span className="text-[#1A1A1A] font-bold text-sm">#{rider.number}</span>
                                              )}
                                              <span className="text-[#1A1A1A] font-medium text-sm">{rider.name}</span>
                                            </div>
                                            {rider.team && <p className="text-[#8A8A8A] text-xs">{rider.team}</p>}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <p className="text-[#8A8A8A] text-sm">
                          You have roster space available. Confirm to add this rider without dropping anyone.
                        </p>
                      )}
                    </div>

                    {/* Modal Footer */}
                    <div className="border-t border-[#D4D0CB] p-4 flex gap-2">
                      <button
                        onClick={async () => {
                          await handleFaTransaction();
                          setShowDropModal(false);
                        }}
                        disabled={faSubmitting || (rosterFull && !selectedDrop)}
                        className="flex-1 bg-[#1A1A1A] hover:bg-[#333333] text-white py-2.5 rounded-lg text-sm font-bold disabled:opacity-40 transition-colors"
                      >
                        {faSubmitting ? "Processing..." : selectedDrop
                          ? `Drop #${selectedDrop.number ?? ""} ${selectedDrop.name} & Add`
                          : rosterFull ? "Select a rider to drop" : "Confirm Add"}
                      </button>
                      <button
                        onClick={() => { setShowDropModal(false); setSelectedAdd(null); setSelectedDrop(null); }}
                        className="px-4 py-2.5 text-[#8A8A8A] hover:text-[#1A1A1A] text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ===== ACTIVITY TAB ===== */}
          {tab === "activity" && faData && (
            <div className="space-y-2">
              {faData.transactions.length === 0 ? (
                <p className="text-[#A0A0A0] text-center py-8">No transactions yet.</p>
              ) : (
                faData.transactions.map((txn) => (
                  <div key={txn.id} className="bg-[#E8E4DF] border border-[#D4D0CB] rounded-lg px-4 py-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[#1A1A1A] text-sm font-medium">{txn.username}</p>
                        <div className="mt-1 space-y-0.5">
                          {txn.added_rider_name && (
                            <p className="text-green-600 text-xs flex items-center gap-1">
                              <span className="font-bold">+</span> Added {txn.added_rider_name}
                              {txn.added_rider_number != null && ` #${txn.added_rider_number}`}
                              <span className="text-[#A0A0A0] ml-1">({txn.added_rider_class})</span>
                            </p>
                          )}
                          {txn.dropped_rider_name && (
                            <p className="text-red-600 text-xs flex items-center gap-1">
                              <span className="font-bold">&minus;</span> Dropped {txn.dropped_rider_name}
                              {txn.dropped_rider_number != null && ` #${txn.dropped_rider_number}`}
                              <span className="text-[#A0A0A0] ml-1">({txn.dropped_rider_class})</span>
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-[#A0A0A0] text-xs shrink-0 ml-2">
                        {new Date(txn.created_at + "Z").toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {data.league.draft_status !== "completed" && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl text-sm">
          Complete the draft to see your roster.
        </div>
      )}
    </div>
  );
}
