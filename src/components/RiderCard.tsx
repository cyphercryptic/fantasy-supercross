"use client";

import TeamLogo from "./TeamLogo";

interface Rider {
  id: number;
  name: string;
  number: number | null;
  team: string | null;
  class: string;
}

interface RiderCardProps {
  rider: Rider;
  onDraft?: (riderId: number) => void;
  onDrop?: (riderId: number) => void;
  drafted?: boolean;
}

export default function RiderCard({ rider, onDraft, onDrop, drafted }: RiderCardProps) {
  return (
    <div className="bg-[#EBE7E2] rounded-lg p-4 border border-[#D4D0CB] hover:border-[#1A1A1A] transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TeamLogo team={rider.team} />
          <div>
            <div className="flex items-center gap-2">
              {rider.number != null && (
                <span className="text-[#1A1A1A] font-bold text-lg">#{rider.number}</span>
              )}
              <h3 className="text-[#1A1A1A] font-semibold">{rider.name}</h3>
            </div>
            <div className="flex gap-2 mt-1">
              {rider.team && (
                <span className="text-[#8A8A8A] text-sm">{rider.team}</span>
              )}
              <span className="text-[#A0A0A0] text-xs bg-[#E8E4DF] px-2 py-0.5 rounded">
                {rider.class}
              </span>
            </div>
          </div>
        </div>
        <div>
          {onDraft && !drafted && (
            <button
              onClick={() => onDraft(rider.id)}
              className="bg-[#1A1A1A] hover:bg-[#333333] text-white px-3 py-1.5 rounded text-sm"
            >
              Draft
            </button>
          )}
          {onDrop && (
            <button
              onClick={() => onDrop(rider.id)}
              className="bg-red-600 hover:bg-red-700 text-[#1A1A1A] px-3 py-1.5 rounded text-sm"
            >
              Drop
            </button>
          )}
          {drafted && !onDrop && (
            <span className="text-[#1A1A1A] text-sm">Drafted</span>
          )}
        </div>
      </div>
    </div>
  );
}
