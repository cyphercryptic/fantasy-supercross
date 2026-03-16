"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
  roster_size: number;
  draft_status: string;
}

export default function LeagueRosterPage() {
  const { id } = useParams();
  const [league, setLeague] = useState<League | null>(null);
  const [roster, setRoster] = useState<Rider[]>([]);

  useEffect(() => {
    fetch(`/api/leagues/${id}`).then((r) => r.json()).then(setLeague);
    fetch(`/api/leagues/${id}/roster`).then((r) => r.json()).then(setRoster);
  }, [id]);

  if (!league) return <div className="max-w-4xl mx-auto px-4 py-8 text-[#8A8A8A]">Loading...</div>;

  const classes = [
    { key: "450", label: "450 Class" },
    { key: "250E", label: "250 East" },
    { key: "250W", label: "250 West" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1A1A1A]">Your Roster</h1>
          <p className="text-[#8A8A8A] text-sm">{league.name}</p>
        </div>
        <span className="text-[#8A8A8A] text-sm">
          {roster.length}/{league.roster_size} riders
        </span>
      </div>

      {league.draft_status !== "completed" && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl mb-6 text-sm">
          Your roster will be filled during the snake draft.
        </div>
      )}

      {classes.map(({ key, label }) => {
        const classRiders = roster.filter((r) => r.class === key);
        if (classRiders.length === 0) return null;

        return (
          <div key={key} className="mb-6">
            <h2 className="text-lg font-semibold text-[#1A1A1A] mb-3">{label}</h2>
            <div className="space-y-2">
              {classRiders.map((rider) => (
                <div
                  key={rider.id}
                  className="bg-[#EBE7E2] rounded-lg p-3 border border-[#D4D0CB] flex items-center gap-3"
                >
                  <TeamLogo team={rider.team} />
                  <div>
                    <div className="flex items-center gap-2">
                      {rider.number != null && (
                        <span className="text-[#1A1A1A] font-bold">#{rider.number}</span>
                      )}
                      <span className="text-[#1A1A1A] font-medium">{rider.name}</span>
                    </div>
                    {rider.team && (
                      <span className="text-[#8A8A8A] text-sm">{rider.team}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {roster.length === 0 && (
        <p className="text-[#A0A0A0] text-center py-8">
          No riders on your roster yet. Complete the draft to fill your roster.
        </p>
      )}
    </div>
  );
}
