"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface NewsItem {
  id: number;
  title: string;
  description: string;
  link: string;
  image_url: string | null;
  author: string | null;
  published_at: string;
  category: string;
}

interface OutRider {
  id: number;
  name: string;
  number: number | null;
  team: string | null;
  class: string;
}

interface NewsData {
  news: NewsItem[];
  outRiders: OutRider[];
}

export default function NewsPage() {
  const [data, setData] = useState<NewsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/news")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F0EB] flex items-center justify-center">
        <div className="text-[#8A8A8A] text-lg">Loading news...</div>
      </div>
    );
  }

  if (!data) return null;

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <div className="min-h-screen bg-[#F5F0EB]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">News & Injury Report</h1>
            <p className="text-[#8A8A8A] text-sm mt-1">
              Powered by Racer X Online
            </p>
          </div>
          <Link
            href="/"
            className="text-[#8A8A8A] hover:text-[#1A1A1A] text-sm"
          >
            Back
          </Link>
        </div>

        {/* Injury Report Banner */}
        {data.outRiders.length > 0 && (
          <div className="bg-white border border-red-200 rounded-xl p-5 mb-8 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-[#1A1A1A]">Current Injuries</h2>
              <span className="ml-auto bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {data.outRiders.length} OUT
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.outRiders.map((rider) => (
                <div
                  key={rider.id}
                  className="flex items-center gap-3 bg-red-50 rounded-lg p-3 border border-red-100"
                >
                  <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {rider.number != null && (
                        <span className="text-[#1A1A1A] font-bold text-sm">#{rider.number}</span>
                      )}
                      <span className="text-[#1A1A1A] font-medium text-sm">{rider.name}</span>
                      <span className="text-red-600 text-xs font-bold ml-1">OUT</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {rider.team && (
                        <p className="text-[#8A8A8A] text-xs">{rider.team}</p>
                      )}
                      <span className="text-[#A0A0A0] text-xs">{rider.class}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* News Articles */}
        <h2 className="text-lg font-bold text-[#1A1A1A] mb-4">Latest Injury Reports</h2>

        {data.news.length === 0 ? (
          <div className="bg-white border border-[#D4D0CB] rounded-xl p-8 text-center">
            <p className="text-[#8A8A8A]">No news articles yet. Check back soon.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {data.news.map((item) => (
              <a
                key={item.id}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-white border border-[#D4D0CB] rounded-xl overflow-hidden hover:border-[#8A8A8A] transition-colors shadow-sm"
              >
                <div className="flex">
                  {item.image_url && (
                    <div className="w-28 sm:w-40 shrink-0">
                      <img
                        src={item.image_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-4 min-w-0 flex-1">
                    <h3 className="text-[#1A1A1A] font-bold text-sm sm:text-base leading-snug mb-1 line-clamp-2">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="text-[#8A8A8A] text-xs sm:text-sm line-clamp-2 mb-2">
                        {item.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-[#A0A0A0]">
                      <span>{timeAgo(item.published_at)}</span>
                      {item.author && <span>by {item.author}</span>}
                      <span className="ml-auto text-[#B0A090] font-medium">Racer X</span>
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
