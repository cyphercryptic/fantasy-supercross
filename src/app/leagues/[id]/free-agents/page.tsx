"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import TeamLogo from "@/components/TeamLogo";

interface Rider {
  id: number;
  name: string;
  number: number | null;
  team: string | null;
  class: string;
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

interface FreeAgentData {
  freeAgents: Rider[];
  myRoster: Rider[];
  transactions: Transaction[];
  rosterSize: number;
}

export default function FreeAgentsPage() {
  const { id } = useParams();
  const [data, setData] = useState<FreeAgentData | null>(null);
  const [filter, setFilter] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [selectedAdd, setSelectedAdd] = useState<Rider | null>(null);
  const [selectedDrop, setSelectedDrop] = useState<Rider | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<"pool" | "roster" | "log">("pool");

  const loadData = useCallback(() => {
    fetch(`/api/leagues/${id}/free-agents`).then((r) => r.json()).then(setData);
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleTransaction() {
    if (!selectedAdd && !selectedDrop) return;
    setSubmitting(true);
    setMessage("");

    const res = await fetch(`/api/leagues/${id}/free-agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        addRiderId: selectedAdd?.id || null,
        dropRiderId: selectedDrop?.id || null,
      }),
    });

    const result = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setMessage(result.error);
      return;
    }

    setSelectedAdd(null);
    setSelectedDrop(null);
    setMessage("Transaction complete!");
    loadData();
    setTimeout(() => setMessage(""), 3000);
  }

  if (!data) {
    return <div className="max-w-4xl mx-auto px-4 py-8 text-[#8A8A8A]">Loading...</div>;
  }

  const rosterFull = data.myRoster.length >= data.rosterSize;

  const filteredFreeAgents = data.freeAgents.filter((r) => {
    const matchesSearch = r.name.toLowerCase().includes(filter.toLowerCase()) ||
      (r.team && r.team.toLowerCase().includes(filter.toLowerCase()));
    const matchesClass = classFilter === "all" || r.class === classFilter;
    return matchesSearch && matchesClass;
  });

  // Group roster by class
  const rosterByClass = {
    "450": data.myRoster.filter((r) => r.class === "450"),
    "250E": data.myRoster.filter((r) => r.class === "250E"),
    "250W": data.myRoster.filter((r) => r.class === "250W"),
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1A1A]">Free Agency</h1>
        <Link
          href={`/leagues/${id}`}
          className="text-[#8A8A8A] hover:text-[#1A1A1A] text-sm"
        >
          &larr; Back to League
        </Link>
      </div>
      <p className="text-[#8A8A8A] text-sm mb-6">
        Roster: {data.myRoster.length}/{data.rosterSize} riders
      </p>

      {/* Transaction Builder */}
      {(selectedAdd || selectedDrop) && (
        <div className="bg-[#1A1A1A] rounded-xl p-4 mb-6 text-white">
          <h3 className="text-xs uppercase tracking-wider text-gray-400 mb-3">Pending Transaction</h3>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {selectedAdd && (
              <div className="flex items-center gap-2 bg-green-900/30 border border-green-700 rounded-lg px-3 py-2 flex-1 w-full sm:w-auto">
                <span className="text-green-400 text-xs font-bold uppercase">Add</span>
                <TeamLogo team={selectedAdd.team} size="sm" />
                <span className="text-white text-sm font-medium">
                  {selectedAdd.number != null && `#${selectedAdd.number} `}{selectedAdd.name}
                </span>
                <button onClick={() => setSelectedAdd(null)} className="ml-auto text-gray-400 hover:text-white">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            {selectedAdd && selectedDrop && (
              <svg className="w-5 h-5 text-gray-500 shrink-0 rotate-90 sm:rotate-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            )}
            {selectedDrop && (
              <div className="flex items-center gap-2 bg-red-900/30 border border-red-700 rounded-lg px-3 py-2 flex-1 w-full sm:w-auto">
                <span className="text-red-400 text-xs font-bold uppercase">Drop</span>
                <TeamLogo team={selectedDrop.team} size="sm" />
                <span className="text-white text-sm font-medium">
                  {selectedDrop.number != null && `#${selectedDrop.number} `}{selectedDrop.name}
                </span>
                <button onClick={() => setSelectedDrop(null)} className="ml-auto text-gray-400 hover:text-white">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>
          {rosterFull && selectedAdd && !selectedDrop && (
            <p className="text-yellow-400 text-xs mt-2">Your roster is full. Select a rider to drop below.</p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleTransaction}
              disabled={submitting || (rosterFull && selectedAdd && !selectedDrop)}
              className="bg-white text-[#1A1A1A] hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-40"
            >
              {submitting ? "Processing..." : "Confirm Transaction"}
            </button>
            <button
              onClick={() => { setSelectedAdd(null); setSelectedDrop(null); }}
              className="text-gray-400 hover:text-white px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Status message */}
      {message && (
        <div className={`rounded-lg px-4 py-2 mb-4 text-sm font-medium ${
          message.includes("error") || message.includes("full") || message.includes("already")
            ? "bg-red-50 border border-red-200 text-red-700"
            : "bg-green-50 border border-green-200 text-green-700"
        }`}>
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-[#EBE7E2] rounded-lg p-1 mb-6">
        {[
          { key: "pool" as const, label: "Free Agents", count: data.freeAgents.length },
          { key: "roster" as const, label: "My Roster", count: data.myRoster.length },
          { key: "log" as const, label: "Activity", count: data.transactions.length },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              tab === key
                ? "bg-[#1A1A1A] text-white shadow-sm"
                : "text-[#6B6B6B] hover:text-[#1A1A1A]"
            }`}
          >
            {label} <span className="text-xs opacity-60">({count})</span>
          </button>
        ))}
      </div>

      {/* Free Agents Tab */}
      {tab === "pool" && (
        <>
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              placeholder="Search riders or teams..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="flex-1 bg-[#EBE7E2] border border-[#D4D0CB] rounded-lg px-3 py-2 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#1A1A1A]"
            />
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="bg-[#EBE7E2] border border-[#D4D0CB] rounded-lg px-3 py-2 text-[#1A1A1A] text-sm"
            >
              <option value="all">All Classes</option>
              <option value="450">450</option>
              <option value="250E">250 East</option>
              <option value="250W">250 West</option>
            </select>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredFreeAgents.map((rider) => {
              const isSelected = selectedAdd?.id === rider.id;
              return (
                <div
                  key={rider.id}
                  className={`rounded-lg p-3 border flex items-center justify-between transition-colors ${
                    isSelected
                      ? "bg-green-50 border-green-400"
                      : "bg-[#E8E4DF] border-[#D4D0CB] hover:border-[#8A8A8A]"
                  }`}
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
                    onClick={() => setSelectedAdd(isSelected ? null : rider)}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      isSelected
                        ? "bg-green-500 text-white"
                        : "bg-[#1A1A1A] hover:bg-[#333] text-white"
                    }`}
                  >
                    {isSelected ? "Selected" : "+ Add"}
                  </button>
                </div>
              );
            })}
            {filteredFreeAgents.length === 0 && (
              <p className="text-[#A0A0A0] text-center py-8">No free agents match your search.</p>
            )}
          </div>
        </>
      )}

      {/* My Roster Tab */}
      {tab === "roster" && (
        <div className="space-y-6">
          {(["450", "250E", "250W"] as const).map((cls) => {
            const label = cls === "450" ? "450 Class" : cls === "250E" ? "250 East" : "250 West";
            const riders = rosterByClass[cls];
            return (
              <div key={cls}>
                <h3 className="text-sm font-semibold text-[#8A8A8A] uppercase tracking-wide mb-2">{label}</h3>
                {riders.length === 0 ? (
                  <p className="text-[#A0A0A0] text-xs italic pl-1">No riders in this class</p>
                ) : (
                  <div className="space-y-2">
                    {riders.map((rider) => {
                      const isSelected = selectedDrop?.id === rider.id;
                      return (
                        <div
                          key={rider.id}
                          className={`rounded-lg p-3 border flex items-center justify-between transition-colors ${
                            isSelected
                              ? "bg-red-50 border-red-400"
                              : "bg-[#E8E4DF] border-[#D4D0CB]"
                          }`}
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
                              {rider.team && <p className="text-[#8A8A8A] text-xs mt-0.5">{rider.team}</p>}
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedDrop(isSelected ? null : rider)}
                            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                              isSelected
                                ? "bg-red-500 text-white"
                                : "bg-[#EBE7E2] hover:bg-red-100 hover:text-red-700 text-[#6B6B6B] border border-[#D4D0CB]"
                            }`}
                          >
                            {isSelected ? "Dropping" : "Drop"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Activity Log Tab */}
      {tab === "log" && (
        <div className="space-y-2">
          {data.transactions.length === 0 ? (
            <p className="text-[#A0A0A0] text-center py-8">No transactions yet.</p>
          ) : (
            data.transactions.map((txn) => (
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
    </div>
  );
}
