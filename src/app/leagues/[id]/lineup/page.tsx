"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import TeamLogo from "@/components/TeamLogo";

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
}

interface Race {
  id: number;
  name: string;
  round_number: number | null;
  status: string;
  race_time: string | null;
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

function regionLabel(roundNumber: number | null): string {
  const region = get250Region(roundNumber);
  if (region === "west") return " — 250 West";
  if (region === "east") return " — 250 East";
  if (region === "showdown") return " — E/W Showdown";
  return "";
}

export default function LineupPage() {
  const { id } = useParams();
  const router = useRouter();
  const [league, setLeague] = useState<League | null>(null);
  const [roster, setRoster] = useState<Rider[]>([]);
  const [races, setRaces] = useState<Race[]>([]);
  const [selectedRace, setSelectedRace] = useState<number | null>(null);
  const [selectedRiders, setSelectedRiders] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<Record<number, {
    avgFinish: number;
    totalPoints: number;
    totalBonus: number;
    racesRaced: number;
    recent: { round: number; position: number; points: number }[];
  }>>({});

  useEffect(() => {
    fetch(`/api/leagues/${id}`).then((r) => r.json()).then(setLeague);
    fetch(`/api/leagues/${id}/roster`).then((r) => r.json()).then(setRoster);
    fetch(`/api/leagues/${id}/rider-stats`).then((r) => r.json()).then(setStats);
    fetch("/api/races").then((r) => r.json()).then((data: Race[]) => {
      setRaces(data);
      const upcoming = data.find((r) => r.status === "upcoming");
      if (upcoming) setSelectedRace(upcoming.id);
    });
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
    return roster.filter((r) => r.class === cls && selectedRiders.has(r.id)).length;
  }

  function getClassLimit(cls: string) {
    if (!league) return 0;
    if (cls === "450") return league.lineup_450;
    if (cls === "250E") return league.lineup_250e;
    if (cls === "250W") return league.lineup_250w;
    return 0;
  }

  const selectedRaceObj = races.find((r) => r.id === selectedRace);
  const isRaceLocked = selectedRaceObj?.status === "completed" ||
    (!!selectedRaceObj?.race_time && new Date(selectedRaceObj.race_time) <= new Date());
  const raceRegion = get250Region(selectedRaceObj?.round_number ?? null);

  // Determine which 250 classes are active for this race
  const show250E = raceRegion === "east" || raceRegion === "showdown" || raceRegion === null;
  const show250W = raceRegion === "west" || raceRegion === "showdown" || raceRegion === null;

  const isValid = league &&
    getClassCount("450") === league.lineup_450 &&
    (show250E ? getClassCount("250E") === league.lineup_250e : true) &&
    (show250W ? getClassCount("250W") === league.lineup_250w : true);

  async function handleSubmit() {
    if (!selectedRace || !isValid) return;
    setSaving(true);
    setError("");
    setMessage("");

    // Only submit riders from active classes for this race
    const activeRiderIds = Array.from(selectedRiders).filter((riderId) => {
      const rider = roster.find((r) => r.id === riderId);
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
    const data = await res.json();
    setSaving(false);

    if (res.ok) {
      router.push(`/leagues/${id}/team`);
    } else {
      setError(data.error);
    }
  }

  if (!league) return <div className="max-w-4xl mx-auto px-4 py-8 text-[#8A8A8A]">Loading...</div>;

  const allClasses = [
    { key: "450", label: "450 Class", show: true },
    { key: "250E", label: "250 East", show: show250E },
    { key: "250W", label: "250 West", show: show250W },
  ];
  const classes = allClasses.filter((c) => c.show);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-[#1A1A1A] mb-1">Set Lineup</h1>
      <p className="text-[#8A8A8A] text-sm mb-6">{league.name}</p>

      {message && (
        <div className="bg-[#1A1A1A]/10 border border-[#1A1A1A] text-[#1A1A1A] px-4 py-2 rounded mb-4 text-sm">
          {message}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Race Selector */}
      <div className="mb-6">
        <label className="block text-[#8A8A8A] text-sm mb-1">Select Race</label>
        <select
          value={selectedRace || ""}
          onChange={(e) => {
            setSelectedRace(parseInt(e.target.value));
            setMessage("");
            setError("");
          }}
          className="w-full bg-[#EBE7E2] border border-[#D4D0CB] rounded px-3 py-2 text-[#1A1A1A] text-sm"
        >
          <option value="">Select a race...</option>
          {races.map((race) => {
            const started = race.race_time && new Date(race.race_time) <= new Date();
            return (
              <option key={race.id} value={race.id}>
                {race.round_number && `R${race.round_number}: `}{race.name}
                {regionLabel(race.round_number)}
                {race.status === "completed" ? " (Completed)" : started ? " (Locked)" : ""}
              </option>
            );
          })}
        </select>
      </div>

      {selectedRace && raceRegion && (
        <div className="mb-4 flex items-center gap-2">
          {raceRegion === "west" && (
            <span className="bg-blue-100 text-blue-700 text-xs font-bold uppercase px-2.5 py-1 rounded-full">250 West Only</span>
          )}
          {raceRegion === "east" && (
            <span className="bg-red-100 text-red-700 text-xs font-bold uppercase px-2.5 py-1 rounded-full">250 East Only</span>
          )}
          {raceRegion === "showdown" && (
            <span className="bg-purple-100 text-purple-700 text-xs font-bold uppercase px-2.5 py-1 rounded-full">E/W Showdown — Both 250 Classes</span>
          )}
          {raceRegion !== "showdown" && (
            <span className="text-[#8A8A8A] text-xs">
              {raceRegion === "west" ? "250 East riders are not racing this round" : "250 West riders are not racing this round"}
            </span>
          )}
        </div>
      )}

      {isRaceLocked && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded mb-4 text-sm">
          {selectedRaceObj?.status === "completed"
            ? "This race is completed. Lineup is locked and cannot be changed."
            : "This race has started. Lineup is locked and cannot be changed."}
        </div>
      )}

      {selectedRace && (
        <>
          {/* Lineup by class */}
          {classes.map(({ key, label }) => {
            const classRiders = roster.filter((r) => r.class === key);
            const count = getClassCount(key);
            const limit = getClassLimit(key);
            const isFull = count === limit;

            return (
              <div key={key} className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-[#1A1A1A]">{label}</h2>
                  <span className={`text-sm font-bold ${isFull ? "text-[#1A1A1A]" : "text-[#8A8A8A]"}`}>
                    {count}/{limit}
                  </span>
                </div>

                {classRiders.length === 0 ? (
                  <p className="text-[#A0A0A0] text-sm py-2">
                    No {label} riders on your roster. Go to Manage Roster to add some.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {classRiders.map((rider) => {
                      const isSelected = selectedRiders.has(rider.id);
                      const canSelect = isSelected || count < limit;
                      const riderStats = stats[rider.id];

                      return (
                        <button
                          key={rider.id}
                          onClick={() => !isRaceLocked && canSelect && toggleRider(rider.id)}
                          disabled={isRaceLocked || (!isSelected && !canSelect)}
                          className={`w-full flex items-center justify-between rounded-lg p-3 border-2 transition-colors text-left relative ${
                            isSelected
                              ? "bg-[#E8E4DF] border-green-500"
                              : canSelect
                              ? "bg-[#E8E4DF] border-[#D4D0CB] hover:border-[#8A8A8A]"
                              : "bg-[#E8E4DF] border-[#D4D0CB] cursor-not-allowed"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              isSelected ? "border-green-500 bg-green-500" : "border-[#D4D0CB]"
                            }`}>
                              {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
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
                )}
              </div>
            );
          })}

          {/* Submit */}
          {!isRaceLocked && (
            <button
              onClick={handleSubmit}
              disabled={!isValid || saving}
              className={`w-full py-3 rounded-lg font-bold text-lg transition-colors ${
                isValid
                  ? "bg-[#1A1A1A] hover:bg-[#333333] text-white"
                  : "bg-[#E8E4DF] text-[#A0A0A0] cursor-not-allowed"
              }`}
            >
              {saving ? "Saving..." : isValid ? "Save Lineup" : "Fill all lineup slots to save"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
