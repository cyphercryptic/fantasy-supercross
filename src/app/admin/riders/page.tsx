"use client";

import { useEffect, useState } from "react";

interface Rider {
  id: number;
  name: string;
  number: number | null;
  team: string | null;
  class: string;
}

export default function AdminRidersPage() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [team, setTeam] = useState("");
  const [riderClass, setRiderClass] = useState("450");
  const [message, setMessage] = useState("");
  const [csvMessage, setCsvMessage] = useState("");

  useEffect(() => {
    loadRiders();
  }, []);

  function loadRiders() {
    fetch("/api/riders").then((r) => r.json()).then(setRiders);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    const res = await fetch("/api/riders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, number: number ? parseInt(number) : null, team, class: riderClass }),
    });
    if (res.ok) {
      setName("");
      setNumber("");
      setTeam("");
      setMessage("Rider added!");
      loadRiders();
    }
  }

  async function handleDelete(id: number) {
    await fetch("/api/riders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadRiders();
  }

  async function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvMessage("");

    const text = await file.text();
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

    // Skip header row if it looks like a header
    const startIdx = lines[0]?.toLowerCase().includes("name") ? 1 : 0;

    const riderData = [];
    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i].split(",").map((p) => p.trim());
      if (parts[0]) {
        riderData.push({
          name: parts[0],
          number: parts[1] ? parseInt(parts[1]) : null,
          team: parts[2] || null,
          class: parts[3] || "450",
        });
      }
    }

    const res = await fetch("/api/riders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bulk: true, riders: riderData }),
    });
    const data = await res.json();
    if (res.ok) {
      setCsvMessage(`Imported ${data.imported} riders!`);
      loadRiders();
    } else {
      setCsvMessage("Error importing: " + data.error);
    }

    // Reset file input
    e.target.value = "";
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-[#1A1A1A] mb-8">Manage Riders</h1>

      {/* CSV Upload */}
      <div className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-[#1A1A1A] mb-2">Import from CSV</h2>
        <p className="text-[#8A8A8A] text-sm mb-3">
          Upload a CSV with columns: <span className="text-[#1A1A1A]">Name, Number, Team, Class</span>.
          Export from Google Sheets via File &gt; Download as CSV.
        </p>
        <input
          type="file"
          accept=".csv"
          onChange={handleCSV}
          className="text-sm text-[#8A8A8A] file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-[#1A1A1A] file:text-white file:font-medium file:cursor-pointer hover:file:bg-[#333333]"
        />
        {csvMessage && (
          <p className="text-[#1A1A1A] text-sm mt-2">{csvMessage}</p>
        )}
      </div>

      {/* Manual Add */}
      <div className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4">Add Rider Manually</h2>
        {message && <p className="text-[#1A1A1A] text-sm mb-3">{message}</p>}
        <form onSubmit={handleAdd} className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <input
            type="text"
            placeholder="Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-[#EBE7E2] border border-[#D4D0CB] rounded px-3 py-2 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#1A1A1A]"
            required
          />
          <input
            type="number"
            placeholder="Number"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className="bg-[#EBE7E2] border border-[#D4D0CB] rounded px-3 py-2 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#1A1A1A]"
          />
          <input
            type="text"
            placeholder="Team"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            className="bg-[#EBE7E2] border border-[#D4D0CB] rounded px-3 py-2 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#1A1A1A]"
          />
          <select
            value={riderClass}
            onChange={(e) => setRiderClass(e.target.value)}
            className="bg-[#EBE7E2] border border-[#D4D0CB] rounded px-3 py-2 text-[#1A1A1A] text-sm"
          >
            <option value="450">450</option>
            <option value="250E">250 East</option>
            <option value="250W">250 West</option>
          </select>
          <button
            type="submit"
            className="bg-[#1A1A1A] hover:bg-[#333333] text-white px-4 py-2 rounded text-sm font-semibold"
          >
            Add
          </button>
        </form>
      </div>

      {/* Rider List */}
      <div className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-6">
        <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4">
          Current Riders ({riders.length})
        </h2>
        <div className="space-y-2">
          {riders.map((rider) => (
            <div
              key={rider.id}
              className="flex items-center justify-between bg-[#EBE7E2] rounded px-4 py-2"
            >
              <div className="flex items-center gap-3">
                {rider.number && (
                  <span className="text-[#1A1A1A] font-bold">#{rider.number}</span>
                )}
                <span className="text-[#1A1A1A]">{rider.name}</span>
                {rider.team && (
                  <span className="text-[#A0A0A0] text-sm">{rider.team}</span>
                )}
                <span className="text-[#A0A0A0] text-xs bg-[#E8E4DF] px-2 py-0.5 rounded">
                  {rider.class}
                </span>
              </div>
              <button
                onClick={() => handleDelete(rider.id)}
                className="text-red-600 hover:text-red-600 text-sm"
              >
                Delete
              </button>
            </div>
          ))}
          {riders.length === 0 && (
            <p className="text-[#A0A0A0] text-center py-4">
              No riders yet. Upload a CSV or add riders manually above.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
