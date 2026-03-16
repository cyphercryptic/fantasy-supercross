"use client";

const TEAM_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  yamaha: { bg: "bg-blue-700", text: "text-white", label: "Y" },
  ktm: { bg: "bg-orange-500", text: "text-white", label: "KTM" },
  honda: { bg: "bg-red-600", text: "text-white", label: "H" },
  kawasaki: { bg: "bg-green-700", text: "text-white", label: "K" },
  husqvarna: { bg: "bg-slate-200", text: "text-blue-900", label: "HQ" },
  suzuki: { bg: "bg-yellow-400", text: "text-blue-900", label: "S" },
  triumph: { bg: "bg-black", text: "text-white", label: "T" },
  gasgas: { bg: "bg-red-700", text: "text-white", label: "GG" },
};

export default function TeamLogo({ team, size = "md" }: { team: string | null; size?: "sm" | "md" }) {
  if (!team) return null;

  const key = team.toLowerCase().replace(/\s+/g, "");
  const style = TEAM_STYLES[key] || { bg: "bg-gray-600", text: "text-white", label: team.slice(0, 2).toUpperCase() };

  const sizeClasses = size === "sm"
    ? "w-6 h-6 text-[9px]"
    : "w-9 h-9 text-sm";

  return (
    <div
      className={`${sizeClasses} ${style.bg} ${style.text} rounded-full flex items-center justify-center font-bold shrink-0`}
      title={team}
    >
      {style.label}
    </div>
  );
}
