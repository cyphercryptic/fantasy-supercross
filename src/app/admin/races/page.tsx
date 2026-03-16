"use client";

import { useEffect, useState } from "react";

interface Race {
  id: number;
  name: string;
  round_number: number | null;
  date: string | null;
  location: string | null;
  status: string;
  race_time: string | null;
  event_id: string | null;
}

interface Rider {
  id: number;
  name: string;
  number: number | null;
  team: string | null;
}

interface RaceResult {
  rider_id: number;
  rider_name: string;
  rider_number: number | null;
  position: number;
  points: number;
}

export default function AdminRacesPage() {
  const [races, setRaces] = useState<Race[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [name, setName] = useState("");
  const [roundNumber, setRoundNumber] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [message, setMessage] = useState("");

  // Results entry
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [results, setResults] = useState<{ riderId: number; position: string }[]>([]);
  const [existingResults, setExistingResults] = useState<RaceResult[]>([]);

  // Bonus points
  const [lcq450, setLcq450] = useState<number | "">("");
  const [lcq250, setLcq250] = useState<number | "">("");
  const [holeshot450, setHoleshot450] = useState<number | "">("");
  const [holeshot250, setHoleshot250] = useState<number | "">("");
  const [heat1_450, setHeat1_450] = useState<number | "">("");
  const [heat2_450, setHeat2_450] = useState<number | "">("");
  const [heat1_250, setHeat1_250] = useState<number | "">("");
  const [heat2_250, setHeat2_250] = useState<number | "">("");

  // Create race extra fields
  const [raceTime, setRaceTime] = useState("");
  const [eventId, setEventId] = useState("");

  // Import from supercrosslive
  const [importRace, setImportRace] = useState<Race | null>(null);
  const [importEventId, setImportEventId] = useState("");
  const [importing, setImporting] = useState(false);
  const [importLog, setImportLog] = useState<string[]>([]);

  useEffect(() => {
    loadRaces();
    fetch("/api/riders").then((r) => r.json()).then(setRiders);
  }, []);

  function loadRaces() {
    fetch("/api/races").then((r) => r.json()).then(setRaces);
  }

  async function handleCreateRace(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    const res = await fetch("/api/races", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        round_number: roundNumber ? parseInt(roundNumber) : null,
        date: date || null,
        location: location || null,
        race_time: raceTime || null,
        event_id: eventId || null,
      }),
    });
    if (res.ok) {
      setName("");
      setRoundNumber("");
      setDate("");
      setLocation("");
      setRaceTime("");
      setEventId("");
      setMessage("Race created!");
      loadRaces();
    }
  }

  async function openResults(race: Race) {
    setSelectedRace(race);
    setLcq450("");
    setLcq250("");
    setHoleshot450("");
    setHoleshot250("");
    setHeat1_450("");
    setHeat2_450("");
    setHeat1_250("");
    setHeat2_250("");
    // Load existing results
    const res = await fetch(`/api/races?id=${race.id}`);
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      setExistingResults(data.results);
      setResults(
        data.results.map((r: RaceResult) => ({
          riderId: r.rider_id,
          position: String(r.position),
        }))
      );
    } else {
      setExistingResults([]);
      setResults(
        riders.map((r) => ({ riderId: r.id, position: "" }))
      );
    }
    // Load existing bonuses
    if (data.bonuses && Array.isArray(data.bonuses)) {
      for (const b of data.bonuses as { rider_id: number; bonus_type: string }[]) {
        if (b.bonus_type === "lcq_450") setLcq450(b.rider_id);
        if (b.bonus_type === "lcq_250") setLcq250(b.rider_id);
        if (b.bonus_type === "holeshot_450") setHoleshot450(b.rider_id);
        if (b.bonus_type === "holeshot_250") setHoleshot250(b.rider_id);
        if (b.bonus_type === "heat1_450") setHeat1_450(b.rider_id);
        if (b.bonus_type === "heat2_450") setHeat2_450(b.rider_id);
        if (b.bonus_type === "heat1_250") setHeat1_250(b.rider_id);
        if (b.bonus_type === "heat2_250") setHeat2_250(b.rider_id);
      }
    }
  }

  async function submitResults() {
    if (!selectedRace) return;
    const validResults = results
      .filter((r) => r.position && parseInt(r.position) > 0)
      .map((r) => ({ riderId: r.riderId, position: parseInt(r.position) }));

    if (validResults.length === 0) {
      setMessage("Enter at least one result");
      return;
    }

    const bonuses: { riderId: number; type: string }[] = [];
    if (lcq450) bonuses.push({ riderId: Number(lcq450), type: "lcq_450" });
    if (lcq250) bonuses.push({ riderId: Number(lcq250), type: "lcq_250" });
    if (holeshot450) bonuses.push({ riderId: Number(holeshot450), type: "holeshot_450" });
    if (holeshot250) bonuses.push({ riderId: Number(holeshot250), type: "holeshot_250" });
    if (heat1_450) bonuses.push({ riderId: Number(heat1_450), type: "heat1_450" });
    if (heat2_450) bonuses.push({ riderId: Number(heat2_450), type: "heat2_450" });
    if (heat1_250) bonuses.push({ riderId: Number(heat1_250), type: "heat1_250" });
    if (heat2_250) bonuses.push({ riderId: Number(heat2_250), type: "heat2_250" });

    const res = await fetch("/api/races", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "results", raceId: selectedRace.id, results: validResults, bonuses }),
    });
    if (res.ok) {
      setMessage("Results saved!");
      setSelectedRace(null);
      loadRaces();
    }
  }

  async function handleDeleteRace(id: number) {
    await fetch("/api/races", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadRaces();
  }

  function openImport(race: Race) {
    setImportRace(race);
    setImportLog([]);
    setImporting(false);
    setImportEventId(race.event_id || "");
  }

  async function runImport() {
    if (!importRace || !importEventId) return;
    setImporting(true);
    setImportLog(["Fetching results from supercrosslive.com..."]);

    try {
      const res = await fetch("/api/import-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: importEventId, raceId: importRace.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setImportLog([
          ...data.log,
          "",
          `Imported ${data.resultsImported} race results and ${data.bonuses} bonus points.`,
        ]);
        loadRaces();
      } else {
        setImportLog([`Error: ${data.error}`]);
      }
    } catch (err) {
      setImportLog([`Network error: ${(err as Error).message}`]);
    }
    setImporting(false);
  }

  function updatePosition(riderId: number, position: string) {
    setResults((prev) =>
      prev.map((r) => (r.riderId === riderId ? { ...r, position } : r))
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-[#1A1A1A] mb-8">Manage Races</h1>

      {message && (
        <div className="bg-[#1A1A1A]/10 border border-[#1A1A1A] text-[#1A1A1A] px-4 py-2 rounded mb-4 text-sm">
          {message}
        </div>
      )}

      {/* Results Entry Modal */}
      {selectedRace && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#1A1A1A]">
                Results: {selectedRace.name}
              </h2>
              <button
                onClick={() => setSelectedRace(null)}
                className="text-[#8A8A8A] hover:text-[#000000]"
              >
                Close
              </button>
            </div>
            <p className="text-[#8A8A8A] text-sm mb-4">
              Enter finishing position for each rider (leave blank for DNS/DNF).
            </p>

            {/* Bonus Points */}
            <div className="bg-[#E8E4DF] rounded-lg p-4 mb-4">
              <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">Bonus Points (+1 pt each)</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#8A8A8A] text-xs mb-1">450 Holeshot</label>
                  <select
                    value={holeshot450}
                    onChange={(e) => setHoleshot450(e.target.value ? Number(e.target.value) : "")}
                    className="w-full bg-white border border-[#D4D0CB] rounded px-2 py-1.5 text-[#1A1A1A] text-sm"
                  >
                    <option value="">None</option>
                    {riders.filter(r => results.find(res => res.riderId === r.id && res.position)).map((r) => (
                      <option key={r.id} value={r.id}>{r.number ? `#${r.number} ` : ""}{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#8A8A8A] text-xs mb-1">250 Holeshot</label>
                  <select
                    value={holeshot250}
                    onChange={(e) => setHoleshot250(e.target.value ? Number(e.target.value) : "")}
                    className="w-full bg-white border border-[#D4D0CB] rounded px-2 py-1.5 text-[#1A1A1A] text-sm"
                  >
                    <option value="">None</option>
                    {riders.filter(r => results.find(res => res.riderId === r.id && res.position)).map((r) => (
                      <option key={r.id} value={r.id}>{r.number ? `#${r.number} ` : ""}{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#8A8A8A] text-xs mb-1">450 LCQ Winner</label>
                  <select
                    value={lcq450}
                    onChange={(e) => setLcq450(e.target.value ? Number(e.target.value) : "")}
                    className="w-full bg-white border border-[#D4D0CB] rounded px-2 py-1.5 text-[#1A1A1A] text-sm"
                  >
                    <option value="">None</option>
                    {riders.filter(r => results.find(res => res.riderId === r.id && res.position)).map((r) => (
                      <option key={r.id} value={r.id}>{r.number ? `#${r.number} ` : ""}{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#8A8A8A] text-xs mb-1">250 LCQ Winner</label>
                  <select
                    value={lcq250}
                    onChange={(e) => setLcq250(e.target.value ? Number(e.target.value) : "")}
                    className="w-full bg-white border border-[#D4D0CB] rounded px-2 py-1.5 text-[#1A1A1A] text-sm"
                  >
                    <option value="">None</option>
                    {riders.filter(r => results.find(res => res.riderId === r.id && res.position)).map((r) => (
                      <option key={r.id} value={r.id}>{r.number ? `#${r.number} ` : ""}{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#8A8A8A] text-xs mb-1">450 Heat 1 Winner</label>
                  <select
                    value={heat1_450}
                    onChange={(e) => setHeat1_450(e.target.value ? Number(e.target.value) : "")}
                    className="w-full bg-white border border-[#D4D0CB] rounded px-2 py-1.5 text-[#1A1A1A] text-sm"
                  >
                    <option value="">None</option>
                    {riders.filter(r => results.find(res => res.riderId === r.id && res.position)).map((r) => (
                      <option key={r.id} value={r.id}>{r.number ? `#${r.number} ` : ""}{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#8A8A8A] text-xs mb-1">450 Heat 2 Winner</label>
                  <select
                    value={heat2_450}
                    onChange={(e) => setHeat2_450(e.target.value ? Number(e.target.value) : "")}
                    className="w-full bg-white border border-[#D4D0CB] rounded px-2 py-1.5 text-[#1A1A1A] text-sm"
                  >
                    <option value="">None</option>
                    {riders.filter(r => results.find(res => res.riderId === r.id && res.position)).map((r) => (
                      <option key={r.id} value={r.id}>{r.number ? `#${r.number} ` : ""}{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#8A8A8A] text-xs mb-1">250 Heat 1 Winner</label>
                  <select
                    value={heat1_250}
                    onChange={(e) => setHeat1_250(e.target.value ? Number(e.target.value) : "")}
                    className="w-full bg-white border border-[#D4D0CB] rounded px-2 py-1.5 text-[#1A1A1A] text-sm"
                  >
                    <option value="">None</option>
                    {riders.filter(r => results.find(res => res.riderId === r.id && res.position)).map((r) => (
                      <option key={r.id} value={r.id}>{r.number ? `#${r.number} ` : ""}{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#8A8A8A] text-xs mb-1">250 Heat 2 Winner</label>
                  <select
                    value={heat2_250}
                    onChange={(e) => setHeat2_250(e.target.value ? Number(e.target.value) : "")}
                    className="w-full bg-white border border-[#D4D0CB] rounded px-2 py-1.5 text-[#1A1A1A] text-sm"
                  >
                    <option value="">None</option>
                    {riders.filter(r => results.find(res => res.riderId === r.id && res.position)).map((r) => (
                      <option key={r.id} value={r.id}>{r.number ? `#${r.number} ` : ""}{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {results.map((r) => {
                const rider = riders.find((rd) => rd.id === r.riderId);
                if (!rider) return null;
                return (
                  <div key={r.riderId} className="flex items-center gap-3 bg-[#EBE7E2] rounded px-4 py-2">
                    <input
                      type="number"
                      min="1"
                      max="40"
                      value={r.position}
                      onChange={(e) => updatePosition(r.riderId, e.target.value)}
                      placeholder="Pos"
                      className="w-16 bg-[#E8E4DF] border border-[#D4D0CB] rounded px-2 py-1 text-[#1A1A1A] text-sm text-center focus:outline-none focus:border-[#1A1A1A]"
                    />
                    <span className="text-[#1A1A1A] font-bold text-sm">
                      {rider.number ? `#${rider.number}` : ""}
                    </span>
                    <span className="text-[#1A1A1A] text-sm">{rider.name}</span>
                    {rider.team && (
                      <span className="text-[#A0A0A0] text-xs">{rider.team}</span>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              onClick={submitResults}
              className="w-full bg-[#1A1A1A] hover:bg-[#333333] text-white py-2 rounded font-semibold"
            >
              Save Results
            </button>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {importRace && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#1A1A1A]">
                Import: {importRace.name}
              </h2>
              <button
                onClick={() => setImportRace(null)}
                className="text-[#8A8A8A] hover:text-[#000000]"
              >
                Close
              </button>
            </div>
            <p className="text-[#8A8A8A] text-sm mb-4">
              Import results from supercrosslive.com. This will fetch main event positions,
              heat race winners, LCQ winners, and holeshot data automatically.
            </p>
            <div className="mb-4">
              <label className="block text-[#1A1A1A] text-sm font-medium mb-1">
                Supercross Live Event ID
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={importEventId}
                  onChange={(e) => setImportEventId(e.target.value)}
                  placeholder="e.g. 487830"
                  className="flex-1 bg-[#EBE7E2] border border-[#D4D0CB] rounded px-3 py-2 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#1A1A1A]"
                />
                <button
                  onClick={runImport}
                  disabled={importing || !importEventId}
                  className="bg-[#1A1A1A] hover:bg-[#333333] disabled:bg-[#8A8A8A] text-white px-4 py-2 rounded text-sm font-semibold"
                >
                  {importing ? "Importing..." : "Import"}
                </button>
              </div>
              <p className="text-[#A0A0A0] text-xs mt-1">
                Find at: results.supercrosslive.com/results/?p=view_event&id=EVENT_ID
              </p>
            </div>

            {importLog.length > 0 && (
              <div className="bg-[#1A1A1A] rounded-lg p-3 font-mono text-xs text-green-400 max-h-60 overflow-y-auto">
                {importLog.map((line, i) => (
                  <div key={i} className={line.startsWith("WARNING") ? "text-yellow-400" : line.startsWith("Error") ? "text-red-400" : ""}>
                    {line || "\u00A0"}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Race */}
      <div className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4">Create Race</h2>
        <form onSubmit={handleCreateRace} className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Race name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-[#EBE7E2] border border-[#D4D0CB] rounded px-3 py-2 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#1A1A1A]"
              required
            />
            <input
              type="number"
              placeholder="Round #"
              value={roundNumber}
              onChange={(e) => setRoundNumber(e.target.value)}
              className="bg-[#EBE7E2] border border-[#D4D0CB] rounded px-3 py-2 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#1A1A1A]"
            />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-[#EBE7E2] border border-[#D4D0CB] rounded px-3 py-2 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#1A1A1A]"
            />
            <input
              type="text"
              placeholder="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="bg-[#EBE7E2] border border-[#D4D0CB] rounded px-3 py-2 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#1A1A1A]"
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[#8A8A8A] text-xs mb-1">Lineup Lock Time</label>
              <input
                type="datetime-local"
                value={raceTime}
                onChange={(e) => setRaceTime(e.target.value)}
                className="w-full bg-[#EBE7E2] border border-[#D4D0CB] rounded px-3 py-2 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#1A1A1A]"
              />
            </div>
            <div>
              <label className="block text-[#8A8A8A] text-xs mb-1">SCX Live Event ID</label>
              <input
                type="text"
                placeholder="e.g. 487830"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="w-full bg-[#EBE7E2] border border-[#D4D0CB] rounded px-3 py-2 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#1A1A1A]"
              />
            </div>
            <button
              type="submit"
              className="self-end bg-[#1A1A1A] hover:bg-[#333333] text-white px-4 py-2 rounded text-sm font-semibold"
            >
              Create
            </button>
          </div>
        </form>
      </div>

      {/* Race List */}
      <div className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-6">
        <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4">
          Races ({races.length})
        </h2>
        <div className="space-y-2">
          {races.map((race) => (
            <div
              key={race.id}
              className="flex items-center justify-between bg-[#EBE7E2] rounded px-4 py-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[#1A1A1A] font-medium">{race.name}</span>
                  {race.round_number && (
                    <span className="text-[#A0A0A0] text-sm">Round {race.round_number}</span>
                  )}
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      race.status === "completed"
                        ? "bg-green-900 text-[#1A1A1A]"
                        : "bg-[#E8E4DF] text-[#8A8A8A]"
                    }`}
                  >
                    {race.status}
                  </span>
                </div>
                {(race.location || race.date) && (
                  <div className="text-[#A0A0A0] text-sm">
                    {race.location}
                    {race.location && race.date && " - "}
                    {race.date}
                    {race.race_time && ` | Locks: ${new Date(race.race_time).toLocaleString()}`}
                  </div>
                )}
                {race.event_id && (
                  <div className="text-[#A0A0A0] text-xs">Event ID: {race.event_id}</div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openImport(race)}
                  className="bg-blue-700 hover:bg-blue-800 text-white px-3 py-1 rounded text-sm"
                >
                  Import
                </button>
                <button
                  onClick={() => openResults(race)}
                  className="bg-[#1A1A1A] hover:bg-[#333333] text-white px-3 py-1 rounded text-sm"
                >
                  {race.status === "completed" ? "Edit Results" : "Enter Results"}
                </button>
                <button
                  onClick={() => handleDeleteRace(race.id)}
                  className="text-red-600 hover:text-red-600 text-sm px-2"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {races.length === 0 && (
            <p className="text-[#A0A0A0] text-center py-4">
              No races yet. Create one above.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
