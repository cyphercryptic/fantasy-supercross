"use client";

import { useEffect, useState } from "react";
import TeamLogo from "@/components/TeamLogo";
import StatusBadge from "@/components/StatusBadge";

export interface ModalRider {
  id: number;
  name: string;
  number: number | null;
  team: string | null;
  class: string;
  status?: string;
}

export interface ModalRiderStats {
  avgFinish: number;
  totalPoints: number;
  totalBonus?: number;
  racesRaced: number;
  recent: { round: number; raceName: string; position: number; points: number; motos?: { moto: number; position: number; points: number }[] | null }[];
}

// Color a finishing position the same way across single + per-moto badges.
function posBadgeClass(position: number): string {
  return position <= 3
    ? "bg-[#C8A84E]/20 text-[#C8A84E]"
    : position <= 10
    ? "bg-[#1A1A1A]/10 text-[#1A1A1A]"
    : "bg-[#E8E4DF] text-[#8A8A8A] border border-[#D4D0CB]";
}

interface NewsItem {
  id: number;
  title: string;
  description: string | null;
  link: string;
  image_url: string | null;
  author: string | null;
  published_at: string;
  category: string | null;
}

function formatNewsDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function RiderStatsModal({
  rider,
  stats,
  onClose,
}: {
  rider: ModalRider;
  stats: ModalRiderStats | undefined;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"stats" | "news">("stats");
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);

  useEffect(() => {
    if (tab !== "news" || news !== null) return;
    setNewsLoading(true);
    fetch(`/api/riders/${rider.id}/news`)
      .then((r) => r.json())
      .then((d) => {
        if (d && Array.isArray(d.news)) setNews(d.news);
        else setNews([]);
      })
      .catch(() => setNews([]))
      .finally(() => setNewsLoading(false));
  }, [tab, rider.id, news]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#F5F0EB] rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-[#1A1A1A] text-white p-4 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-lg">Rider Profile</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <TeamLogo team={rider.team} size="sm" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {rider.number != null && <span className="font-bold">#{rider.number}</span>}
                <span className="font-medium">{rider.name}</span>
                <StatusBadge status={rider.status} />
              </div>
              <div className="flex gap-2 mt-0.5 flex-wrap">
                {rider.team && <span className="text-gray-400 text-xs">{rider.team}</span>}
                <span className="text-gray-500 text-xs bg-white/10 px-1.5 py-0.5 rounded">{rider.class}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-[#EBE7E2] border-b border-[#D4D0CB] shrink-0">
          <button
            onClick={() => setTab("stats")}
            className={`flex-1 py-2.5 text-sm font-medium ${tab === "stats" ? "text-[#1A1A1A] border-b-2 border-[#1A1A1A]" : "text-[#8A8A8A]"}`}
          >
            Stats
          </button>
          <button
            onClick={() => setTab("news")}
            className={`flex-1 py-2.5 text-sm font-medium ${tab === "news" ? "text-[#1A1A1A] border-b-2 border-[#1A1A1A]" : "text-[#8A8A8A]"}`}
          >
            News {news !== null && news.length > 0 && <span className="text-[10px] text-[#A0A0A0] ml-1">({news.length})</span>}
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {tab === "stats" && (
            stats ? (
              <>
                <div className="grid grid-cols-3 gap-3 p-4 border-b border-[#D4D0CB]">
                  <div className="text-center bg-[#EBE7E2] rounded-lg p-3">
                    <div className="text-2xl font-bold text-[#1A1A1A]">P{stats.avgFinish}</div>
                    <div className="text-[#8A8A8A] text-xs uppercase tracking-wide">Avg Finish</div>
                  </div>
                  <div className="text-center bg-[#EBE7E2] rounded-lg p-3">
                    <div className="text-2xl font-bold text-[#1A1A1A]">{stats.totalPoints}</div>
                    <div className="text-[#8A8A8A] text-xs uppercase tracking-wide">Points</div>
                  </div>
                  <div className="text-center bg-[#EBE7E2] rounded-lg p-3">
                    <div className="text-2xl font-bold text-[#1A1A1A]">{stats.racesRaced}</div>
                    <div className="text-[#8A8A8A] text-xs uppercase tracking-wide">Races</div>
                  </div>
                </div>

                <div className="p-4">
                  <h4 className="text-xs font-bold text-[#8A8A8A] uppercase tracking-widest mb-3">Race Results</h4>
                  {stats.recent.length > 0 ? (
                    <div className="space-y-2">
                      {stats.recent.map((r, i) => (
                        <div key={i} className="flex items-center justify-between bg-[#E8E4DF] rounded-lg px-3 py-2.5 border border-[#D4D0CB]">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[#8A8A8A] text-xs font-bold w-8 shrink-0">R{r.round}</span>
                            <span className="text-[#1A1A1A] text-sm font-medium truncate">{r.raceName || `Round ${r.round}`}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {r.motos && r.motos.length > 0 ? (
                              // MX: show each moto's finish (e.g. M1 P3 · M2 P6)
                              <div className="flex items-center gap-1.5">
                                {r.motos.map((m) => (
                                  <span key={m.moto} className="flex items-center gap-1" title={`Moto ${m.moto}: P${m.position} (${m.points}pts)`}>
                                    <span className="text-[#A0A0A0] text-[10px] font-semibold">M{m.moto}</span>
                                    <span className={`text-xs w-7 h-7 flex items-center justify-center rounded-full font-bold ${posBadgeClass(m.position)}`}>
                                      {m.position}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className={`text-xs w-7 h-7 flex items-center justify-center rounded-full font-bold ${posBadgeClass(r.position)}`}>
                                {r.position}
                              </span>
                            )}
                            <span className="text-[#8A8A8A] text-xs w-10 text-right">{r.points}pts</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[#A0A0A0] text-center py-4 text-sm">No race results yet.</p>
                  )}
                </div>
              </>
            ) : (
              <div className="p-8 text-center">
                <p className="text-[#A0A0A0] text-sm">No stats available yet.</p>
              </div>
            )
          )}

          {tab === "news" && (
            <div className="p-4">
              {newsLoading ? (
                <p className="text-[#A0A0A0] text-center py-6 text-sm">Loading news...</p>
              ) : news === null || news.length === 0 ? (
                <p className="text-[#A0A0A0] text-center py-6 text-sm">No recent news mentioning {rider.name}.</p>
              ) : (
                <div className="space-y-2">
                  {news.map((item) => (
                    <a
                      key={item.id}
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-[#E8E4DF] rounded-lg p-3 border border-[#D4D0CB] hover:border-[#8A8A8A] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-[#1A1A1A] text-sm font-semibold leading-tight">{item.title}</p>
                        <span className="text-[#A0A0A0] text-[10px] shrink-0 mt-0.5">{formatNewsDate(item.published_at)}</span>
                      </div>
                      {item.description && (
                        <p className="text-[#8A8A8A] text-xs leading-snug line-clamp-2">{item.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        {item.author && <span className="text-[#A0A0A0] text-[10px]">{item.author}</span>}
                        {item.category && (
                          <span className="text-[10px] text-[#A0A0A0] bg-[#D4D0CB]/50 px-1.5 py-0.5 rounded">{item.category}</span>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
