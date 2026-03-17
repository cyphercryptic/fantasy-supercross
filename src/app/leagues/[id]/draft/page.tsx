"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import TeamLogo from "@/components/TeamLogo";
import MotoBike, { parseBikeConfig } from "@/components/MotoBike";

interface Rider {
  id: number;
  name: string;
  number: number | null;
  team: string | null;
  class: string;
}

interface Pick {
  pick_number: number;
  round: number;
  user_id: number;
  rider_id: number;
  rider_name: string;
  rider_number: number | null;
  team: string | null;
  class: string;
  username: string;
}

interface Member {
  id: number;
  username: string;
  team_name: string | null;
  team_logo: string | null;
}

interface DraftState {
  draft_status: string;
  draft_order: number[];
  current_user_id: number | null;
  pick_number: number;
  round: number;
  total_picks: number;
  roster_size: number;
  picks: Pick[];
  members: Member[];
  drafted_rider_ids: number[];
  is_my_turn: boolean;
  my_id: number;
  pick_timer: number;
  pick_started_at: string | null;
  server_time: string;
  auto_pick_users: number[];
}

export default function DraftPage() {
  const { id } = useParams();
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [allRiders, setAllRiders] = useState<Rider[]>([]);
  const [filter, setFilter] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [viewingRosterId, setViewingRosterId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [picking, setPicking] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoPickTriggered = useRef(false);

  const loadDraft = useCallback(() => {
    fetch(`/api/leagues/${id}/draft`).then((r) => r.json()).then(setDraft);
  }, [id]);

  useEffect(() => {
    loadDraft();
    fetch("/api/riders").then((r) => r.json()).then(setAllRiders);
  }, [loadDraft]);

  // Poll for updates every 3 seconds
  useEffect(() => {
    if (!draft || draft.draft_status !== "drafting") return;
    const interval = setInterval(loadDraft, 3000);
    return () => clearInterval(interval);
  }, [draft?.draft_status, loadDraft]);

  // Countdown timer — use server time to avoid clock drift
  const pickStartedAt = draft?.pick_started_at ?? null;
  const pickTimer = draft?.pick_timer ?? 60;
  const draftStatus = draft?.draft_status ?? "";
  const serverTime = draft?.server_time ?? null;

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (draftStatus !== "drafting" || !pickStartedAt || !serverTime) {
      setTimeLeft(null);
      return;
    }
    const raw = pickStartedAt.endsWith("Z") ? pickStartedAt : pickStartedAt + "Z";
    const started = new Date(raw).getTime();
    const serverNow = new Date(serverTime).getTime();
    const elapsedAtFetch = Math.floor((serverNow - started) / 1000);
    const fetchedAt = Date.now();

    const calcRemaining = () => {
      const sinceLastFetch = Math.floor((Date.now() - fetchedAt) / 1000);
      return Math.max(0, pickTimer - elapsedAtFetch - sinceLastFetch);
    };
    setTimeLeft(calcRemaining());
    timerRef.current = setInterval(() => {
      setTimeLeft(calcRemaining());
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [pickStartedAt, pickTimer, draftStatus, serverTime]);

  // Auto-pick when timer expires
  useEffect(() => {
    if (timeLeft !== 0 || autoPickTriggered.current) return;
    autoPickTriggered.current = true;
    fetch(`/api/leagues/${id}/draft`, { method: "PATCH" })
      .then((r) => r.json())
      .then(() => {
        autoPickTriggered.current = false;
        loadDraft();
      })
      .catch(() => {
        autoPickTriggered.current = false;
      });
  }, [timeLeft, id, loadDraft]);

  // Reset auto-pick flag when pick changes
  useEffect(() => {
    autoPickTriggered.current = false;
  }, [pickStartedAt]);

  async function handlePick(riderId: number) {
    setPicking(true);
    setMessage("");
    const res = await fetch(`/api/leagues/${id}/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ riderId }),
    });
    const data = await res.json();
    setPicking(false);

    if (!res.ok) {
      setMessage(data.error);
      return;
    }

    loadDraft();
  }

  if (!draft) return <div className="max-w-6xl mx-auto px-4 py-8 text-[#8A8A8A]">Loading...</div>;

  if (draft.draft_status === "waiting") {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <h1 className="text-3xl font-bold text-[#1A1A1A] mb-4">Draft Not Started</h1>
        <p className="text-[#8A8A8A]">Waiting for the commissioner to start the draft once all members have joined.</p>
      </div>
    );
  }

  const draftedSet = new Set(draft.drafted_rider_ids);
  const currentUser = draft.members.find((m) => m.id === draft.current_user_id);
  const memberMap = new Map(draft.members.map((m) => [m.id, m]));

  // Compute upcoming pick order (snake draft: 1,2,3,4,4,3,2,1,1,2,3,4...)
  const upcomingOrder: number[] = [];
  const numUsers = draft.draft_order.length;
  const remainingPicks = draft.total_picks - draft.pick_number + 1;
  const showCount = remainingPicks; // Show all remaining picks to fill the ticker
  for (let i = 0; i < showCount; i++) {
    const futurePickNum = draft.pick_number + i;
    const futureRound = Math.floor((futurePickNum - 1) / numUsers) + 1;
    const posInRound = (futurePickNum - 1) % numUsers;
    const userId = futureRound % 2 === 1
      ? draft.draft_order[posInRound]
      : draft.draft_order[numUsers - 1 - posInRound];
    upcomingOrder.push(userId);
  }

  const available = allRiders.filter((r) => {
    if (draftedSet.has(r.id)) return false;
    const matchesSearch = r.name.toLowerCase().includes(filter.toLowerCase()) ||
      (r.team && r.team.toLowerCase().includes(filter.toLowerCase()));
    const matchesClass = classFilter === "all" || r.class === classFilter;
    return matchesSearch && matchesClass;
  });

  // Build roster per user
  const userRosters = new Map<number, Pick[]>();
  for (const pick of draft.picks) {
    if (!userRosters.has(pick.user_id)) userRosters.set(pick.user_id, []);
    userRosters.get(pick.user_id)!.push(pick);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1A1A]">Snake Draft</h1>
        {timeLeft !== null && draft.draft_status === "drafting" && (
          <div className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-mono text-lg sm:text-xl font-bold ${
            timeLeft <= 10 ? "bg-red-100 text-red-600" : timeLeft <= 30 ? "bg-yellow-100 text-yellow-700" : "bg-[#F5F0EB] text-[#1A1A1A]"
          }`}>
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
          </div>
        )}
      </div>
      <p className="text-center text-lg sm:text-xl font-semibold text-[#1A1A1A] mb-4">
        Pick {((draft.pick_number - 1) % draft.draft_order.length) + 1} of {draft.draft_order.length}
        {" · "}Round {draft.round > draft.roster_size ? draft.roster_size : draft.round}
      </p>

      {/* NFL-Style Draft Ticker */}
      {draft.draft_status === "drafting" && (
        <div className="flex gap-0 mb-6 rounded-xl overflow-hidden border border-[#D4D0CB]">
          {/* Last Pick — hidden on small screens to save space */}
          {draft.picks.length > 0 ? (() => {
            const lastPick = draft.picks[draft.picks.length - 1];
            const picker = memberMap.get(lastPick.user_id);
            return (
              <div className="hidden sm:flex bg-[#E8E4DF] px-4 py-3 items-center gap-3 border-r border-[#D4D0CB] shrink-0">
                <div className="text-[#A0A0A0] text-[10px] uppercase font-semibold">Last Pick</div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#D4D0CB] overflow-hidden flex items-center justify-center shrink-0">
                    {parseBikeConfig(picker?.team_logo ?? null) ? (
                      <MotoBike brand={parseBikeConfig(picker!.team_logo)!.brand} number={parseBikeConfig(picker!.team_logo)!.number} size="sm" />
                    ) : (
                      <span className="text-[#8A8A8A] text-xs font-bold">{(picker?.team_name || picker?.username || "?")[0].toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[#1A1A1A] text-sm font-semibold truncate">{lastPick.rider_name}</p>
                    <p className="text-[#8A8A8A] text-[10px]">{picker?.team_name || picker?.username}</p>
                  </div>
                </div>
              </div>
            );
          })() : (
            <div className="hidden sm:flex bg-[#E8E4DF] px-4 py-3 items-center border-r border-[#D4D0CB] shrink-0">
              <span className="text-[#A0A0A0] text-xs">No picks yet</span>
            </div>
          )}

          {/* On the Clock + Up Next */}
          <div className="flex-1 flex items-stretch overflow-x-auto bg-[#F5F0EB]">
            {upcomingOrder.map((userId, idx) => {
              const member = memberMap.get(userId);
              const isOnClock = idx === 0;
              const isAutoUser = draft.auto_pick_users?.includes(userId);
              return (
                <div
                  key={idx}
                  className={`flex flex-col items-center justify-center px-3 sm:px-4 py-2 border-r border-[#D4D0CB] last:border-r-0 min-w-[70px] sm:min-w-[90px] shrink-0 ${
                    isOnClock ? "bg-[#1A1A1A]" : ""
                  }`}
                >
                  {isOnClock && (
                    <p className="text-[9px] sm:text-[10px] uppercase font-bold text-green-400 tracking-wider mb-1">On the Clock</p>
                  )}
                  {!isOnClock && idx === 1 && (
                    <p className="text-[9px] sm:text-[10px] uppercase font-semibold text-[#A0A0A0] tracking-wider mb-1">Up Next</p>
                  )}
                  {!isOnClock && idx > 1 && (
                    <p className="text-[9px] sm:text-[10px] uppercase font-semibold text-[#A0A0A0] tracking-wider mb-1">&nbsp;</p>
                  )}
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden flex items-center justify-center shrink-0 ${
                    isOnClock ? "ring-2 ring-green-400 bg-[#333]" : isAutoUser ? "bg-[#D4D0CB] ring-1 ring-orange-300" : "bg-[#D4D0CB]"
                  }`}>
                    {parseBikeConfig(member?.team_logo ?? null) ? (
                      <MotoBike brand={parseBikeConfig(member!.team_logo)!.brand} number={parseBikeConfig(member!.team_logo)!.number} size="sm" />
                    ) : (
                      <span className={`text-xs sm:text-sm font-bold ${isOnClock ? "text-white" : "text-[#8A8A8A]"}`}>
                        {(member?.team_name || member?.username || "?")[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className={`text-[10px] sm:text-[11px] mt-1 font-medium truncate max-w-[60px] sm:max-w-[80px] ${
                    isOnClock ? "text-white" : "text-[#6B6B6B]"
                  }`}>
                    {member?.team_name || member?.username || "Unknown"}
                  </p>
                  {isAutoUser && (
                    <p className="text-[8px] uppercase font-bold text-orange-500 mt-0.5">Auto</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {draft.draft_status === "completed" && (
        <div className="bg-[#1A1A1A]/10 border border-[#C8A84E] rounded-xl p-4 mb-6 text-center">
          <p className="text-[#1A1A1A] font-bold text-lg">Draft Complete!</p>
          <p className="text-[#8A8A8A] text-sm mt-1">Head back to your league to set your weekly lineup.</p>
        </div>
      )}

      {/* Turn indicator */}
      {draft.draft_status === "drafting" && (
        <div className={`rounded-xl p-3 mb-6 text-center font-bold text-base ${
          draft.is_my_turn
            ? "bg-[#1A1A1A]/10 border border-[#1A1A1A] text-[#1A1A1A]"
            : "bg-[#F5F0EB] border border-[#D4D0CB] text-[#6B6B6B]"
        }`}>
          {draft.is_my_turn
            ? "It's your turn! Select a rider below."
            : `Waiting for ${currentUser?.username || "..."} to pick...`}
        </div>
      )}

      {message && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4 text-sm">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Roster — shows below riders on mobile, left sidebar on desktop */}
        <div className="lg:col-span-1 order-2 lg:order-1 space-y-4">
          <div className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <select
                value={viewingRosterId ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setViewingRosterId(val ? parseInt(val) : null);
                }}
                className="bg-[#EBE7E2] border border-[#D4D0CB] rounded-lg px-2 py-1.5 text-[#1A1A1A] text-sm font-semibold w-full"
              >
                <option value="">My Roster</option>
                {draft.members
                  .filter((m) => m.id !== draft.my_id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.team_name || m.username}
                    </option>
                  ))}
              </select>
            </div>
            {(() => {
              const rosterUserId = viewingRosterId ?? draft.my_id;
              const rosterPicks = userRosters.get(rosterUserId) || [];
              return [
                { key: "450", label: "450 Class" },
                { key: "250E", label: "250 East" },
                { key: "250W", label: "250 West" },
              ].map(({ key, label }) => {
                const classRiders = rosterPicks.filter((p) => p.class === key);
                return (
                  <div key={key} className="mb-3 last:mb-0">
                    <p className="text-xs font-semibold text-[#8A8A8A] mb-1">{label}</p>
                    {classRiders.length === 0 ? (
                      <p className="text-[#A0A0A0] text-xs italic pl-1">None drafted</p>
                    ) : (
                      <div className="space-y-1">
                        {classRiders.map((pick) => (
                          <div key={pick.pick_number} className="flex items-center gap-2 bg-[#EBE7E2] rounded px-2 py-1.5">
                            <TeamLogo team={pick.team} size="sm" />
                            {pick.rider_number != null && (
                              <span className="text-[#1A1A1A] font-bold text-xs">#{pick.rider_number}</span>
                            )}
                            <span className="text-[#1A1A1A] text-sm">{pick.rider_name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>

          {/* Recent Picks */}
          <div className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-4">
            <h2 className="text-sm font-semibold text-[#8A8A8A] uppercase tracking-wide mb-3">Recent Picks</h2>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {[...draft.picks].reverse().slice(0, 15).map((pick) => {
                const picker = memberMap.get(pick.user_id);
                return (
                  <div key={pick.pick_number} className="flex items-center gap-2 px-2 py-1.5 text-sm">
                    <span className="text-[#A0A0A0] w-6 text-right shrink-0">#{pick.pick_number}</span>
                    <div className="w-5 h-5 rounded-full bg-[#D4D0CB] overflow-hidden flex items-center justify-center shrink-0">
                      {parseBikeConfig(picker?.team_logo ?? null) ? (
                        <MotoBike brand={parseBikeConfig(picker!.team_logo)!.brand} number={parseBikeConfig(picker!.team_logo)!.number} size="sm" />
                      ) : (
                        <span className="text-[#8A8A8A] text-[9px] font-bold">{(picker?.username || "?")[0].toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[#1A1A1A]">{pick.rider_name}</span>
                    </div>
                  </div>
                );
              })}
              {draft.picks.length === 0 && (
                <p className="text-[#A0A0A0] text-sm text-center py-2">No picks yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Available Riders — shows first on mobile */}
        <div className="lg:col-span-2 order-1 lg:order-2">
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              placeholder="Search riders or teams..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="flex-1 bg-[#EBE7E2] border border-[#D4D0CB] rounded px-3 py-2 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#1A1A1A]"
            />
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="bg-[#EBE7E2] border border-[#D4D0CB] rounded px-3 py-2 text-[#1A1A1A] text-sm"
            >
              <option value="all">All Classes</option>
              <option value="450">450</option>
              <option value="250E">250 East</option>
              <option value="250W">250 West</option>
            </select>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {available.map((rider) => (
              <div
                key={rider.id}
                className="bg-[#EBE7E2] rounded-lg p-3 border border-[#D4D0CB] hover:border-[#D4D0CB] flex items-center justify-between"
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
                      <span className="text-[#A0A0A0] text-xs bg-[#E8E4DF] px-1.5 py-0.5 rounded">{rider.class}</span>
                    </div>
                  </div>
                </div>
                {draft.is_my_turn && draft.draft_status === "drafting" && (
                  <button
                    onClick={() => handlePick(rider.id)}
                    disabled={picking}
                    className="bg-[#1A1A1A] hover:bg-[#333333] text-white px-3 py-1.5 rounded text-sm font-medium disabled:opacity-50"
                  >
                    {picking ? "..." : "Pick"}
                  </button>
                )}
              </div>
            ))}
            {available.length === 0 && (
              <p className="text-[#A0A0A0] text-center py-8">No riders match your search.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
