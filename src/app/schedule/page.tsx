"use client";

import { useEffect, useState } from "react";

interface Race {
  id: number;
  name: string;
  round_number: number;
  date: string | null;
  location: string | null;
  status: string;
  race_time: string | null;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(raceTime: string) {
  const d = new Date(raceTime);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function splitLocation(location: string | null) {
  if (!location) return { venue: null, city: null };
  const parts = location.split(" - ");
  if (parts.length === 2) return { venue: parts[0], city: parts[1] };
  return { venue: null, city: location };
}

const WEST_ROUNDS = new Set([1, 2, 3, 4, 5, 6, 16]);
const EAST_ROUNDS = new Set([7, 8, 9, 11, 13, 14, 15]);
const SHOWDOWN_ROUNDS = new Set([10, 12, 17]);

function get250Region(roundNumber: number): "west" | "east" | "showdown" | null {
  if (WEST_ROUNDS.has(roundNumber)) return "west";
  if (EAST_ROUNDS.has(roundNumber)) return "east";
  if (SHOWDOWN_ROUNDS.has(roundNumber)) return "showdown";
  return null;
}

const TRIPLE_CROWN_ROUNDS = new Set([4, 9, 14]);

function TripleCrownBadge({ faded }: { faded?: boolean }) {
  return (
    <span className={`bg-amber-100 text-amber-700 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${faded ? "opacity-60" : ""}`}>
      <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1l2.5 3.5L14 3l-1.5 5H3.5L2 3l3.5 1.5L8 1z" />
        <rect x="3" y="9" width="10" height="2.5" rx="0.5" />
        <text x="8" y="8" textAnchor="middle" fontSize="5" fontWeight="bold" fill="white">3</text>
      </svg>
      Triple Crown
    </span>
  );
}

function RegionBadge({ region, faded }: { region: "west" | "east" | "showdown"; faded?: boolean }) {
  const styles = {
    west: { bg: "bg-blue-100", text: "text-blue-700", label: "250 West" },
    east: { bg: "bg-red-100", text: "text-red-700", label: "250 East" },
    showdown: { bg: "bg-purple-100", text: "text-purple-700", label: "E/W Showdown" },
  };
  const s = styles[region];
  return (
    <span className={`${s.bg} ${s.text} text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${faded ? "opacity-60" : ""}`}>
      {s.label}
    </span>
  );
}

interface RaceResult {
  rider_name: string;
  rider_number: number;
  rider_team: string;
  rider_class: string;
  position: number;
  points: number;
}

export default function SchedulePage() {
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [results, setResults] = useState<RaceResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);

  useEffect(() => {
    fetch("/api/races")
      .then((r) => r.json())
      .then((data) => {
        setRaces(data);
        setLoading(false);
      });
  }, []);

  async function openResults(race: Race) {
    setSelectedRace(race);
    setLoadingResults(true);
    const res = await fetch(`/api/races?id=${race.id}`);
    const data = await res.json();
    setResults(data.results || []);
    setLoadingResults(false);
  }

  const today = new Date().toISOString().split("T")[0];
  const nextRace = races.find(
    (r) => r.status === "upcoming" && r.date && r.date >= today
  );

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-[#8A8A8A]">Loading schedule...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-[#1A1A1A] mb-2">
        2026 Supercross Schedule
      </h1>
      <p className="text-[#8A8A8A] text-sm mb-8">
        Monster Energy AMA Supercross Championship
      </p>

      {nextRace && (
        <div className="bg-[#1A1A1A] text-white rounded-xl p-6 mb-8 shadow-md">
          <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">
            Up Next
          </p>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">
                Round {nextRace.round_number}: {nextRace.name}
              </h2>
              <p className="text-gray-300 mt-1">
                {nextRace.date && formatDate(nextRace.date)}
                {nextRace.race_time && (
                  <span className="text-gray-400 ml-2">
                    {formatTime(nextRace.race_time)}
                  </span>
                )}
              </p>
              {nextRace.location && (
                <p className="text-gray-400 text-sm mt-0.5">
                  {splitLocation(nextRace.location).venue && (
                    <span className="text-gray-300">
                      {splitLocation(nextRace.location).venue}
                    </span>
                  )}
                  {splitLocation(nextRace.location).venue && " — "}
                  {splitLocation(nextRace.location).city}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2">
                {get250Region(nextRace.round_number) && (
                  <RegionBadge region={get250Region(nextRace.round_number)!} />
                )}
                {TRIPLE_CROWN_ROUNDS.has(nextRace.round_number) && (
                  <TripleCrownBadge />
                )}
              </div>
            </div>
            <div className="text-5xl font-black text-gray-700">
              R{nextRace.round_number}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {races.map((race) => {
          const isNext = nextRace?.id === race.id;
          const isCompleted = race.status === "completed";
          const { venue, city } = splitLocation(race.location);

          return (
            <div
              key={race.id}
              onClick={() => isCompleted && openResults(race)}
              className={`flex items-center gap-4 rounded-xl px-5 py-4 border transition-all ${
                isNext
                  ? "bg-white border-[#1A1A1A] shadow-md"
                  : isCompleted
                  ? "bg-[#EBE7E2] border-transparent opacity-70 cursor-pointer hover:opacity-90 hover:border-[#D4D0CB]"
                  : "bg-[#F5F0EB] border-[#D4D0CB] shadow-sm"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                  isNext
                    ? "bg-[#1A1A1A] text-white"
                    : isCompleted
                    ? "bg-[#D4D0CB] text-[#8A8A8A]"
                    : "bg-[#E8E4DF] text-[#1A1A1A]"
                }`}
              >
                {race.round_number}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3
                    className={`font-semibold ${
                      isCompleted ? "text-[#8A8A8A]" : "text-[#1A1A1A]"
                    }`}
                  >
                    {race.name}
                  </h3>
                  {isNext && (
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
                      Next
                    </span>
                  )}
                  {isCompleted && (
                    <span className="text-[10px] font-bold uppercase text-[#A0A0A0]">
                      Completed
                    </span>
                  )}
                  {get250Region(race.round_number) && (
                    <RegionBadge region={get250Region(race.round_number)!} faded={isCompleted} />
                  )}
                  {TRIPLE_CROWN_ROUNDS.has(race.round_number) && (
                    <TripleCrownBadge faded={isCompleted} />
                  )}
                </div>
                {(venue || city) && (
                  <p
                    className={`text-sm ${
                      isCompleted ? "text-[#A0A0A0]" : "text-[#8A8A8A]"
                    }`}
                  >
                    {venue && <span className="font-medium">{venue}</span>}
                    {venue && city && " — "}
                    {city}
                  </p>
                )}
              </div>

              <div className="text-right shrink-0">
                <p
                  className={`text-sm font-medium ${
                    isCompleted ? "text-[#A0A0A0]" : "text-[#1A1A1A]"
                  }`}
                >
                  {race.date ? formatDate(race.date) : "TBD"}
                </p>
                {race.race_time && !isCompleted && (
                  <p className="text-xs text-[#8A8A8A] mt-0.5">
                    {formatTime(race.race_time)}
                  </p>
                )}
                {isCompleted && (
                  <p className="text-[10px] text-[#8A8A8A] mt-0.5">View Results</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Results Modal */}
      {selectedRace && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={() => setSelectedRace(null)}>
          <div className="bg-[#F5F0EB] rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[#1A1A1A] text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">
                  {selectedRace.round_number && `R${selectedRace.round_number}: `}
                  {selectedRace.name}
                </h3>
                <p className="text-gray-400 text-xs">Race Results</p>
              </div>
              <button onClick={() => setSelectedRace(null)} className="text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(80vh-4rem)]">
              {loadingResults ? (
                <p className="text-[#8A8A8A] text-sm text-center py-8">Loading results...</p>
              ) : results.length > 0 ? (
                <div>
                  {(() => {
                    const classes450 = results.filter((r) => r.rider_class === "450");
                    const classes250 = results.filter((r) => r.rider_class !== "450");
                    const sections: { label: string; items: RaceResult[] }[] = [];
                    if (classes450.length > 0) sections.push({ label: "450 Class", items: classes450 });
                    if (classes250.length > 0) sections.push({ label: "250 Class", items: classes250 });
                    return sections.map((section) => (
                      <div key={section.label}>
                        <div className="px-5 py-2 bg-[#E8E4DF] sticky top-0">
                          <span className="text-xs font-bold uppercase tracking-wider text-[#6B6B6B]">{section.label}</span>
                        </div>
                        <div className="divide-y divide-[#E8E4DF]">
                          {section.items.map((r, idx) => (
                            <div key={`${r.position}-${r.rider_number}-${idx}`} className="flex items-center gap-3 px-5 py-2.5">
                              <span className={`w-8 text-center font-bold text-sm ${
                                r.position === 1 ? "text-amber-500" : r.position === 2 ? "text-[#6B6B6B]" : r.position === 3 ? "text-[#1A1A1A]" : "text-[#A0A0A0]"
                              }`}>
                                {r.position}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[#1A1A1A] text-sm font-medium">
                                  <span className="text-[#8A8A8A] font-mono mr-1">#{r.rider_number}</span>
                                  {r.rider_name}
                                </p>
                                <p className="text-[#A0A0A0] text-xs">{r.rider_team}</p>
                              </div>
                              <span className="text-[#1A1A1A] font-bold text-sm">{r.points} pts</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              ) : (
                <p className="text-[#8A8A8A] text-sm text-center py-8">No results available</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
