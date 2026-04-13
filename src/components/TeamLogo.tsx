"use client";

const MANUFACTURER_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  yamaha: { bg: "bg-blue-700", text: "text-white", label: "Y" },
  ktm: { bg: "bg-orange-500", text: "text-white", label: "KTM" },
  honda: { bg: "bg-red-600", text: "text-white", label: "H" },
  kawasaki: { bg: "bg-green-700", text: "text-white", label: "K" },
  husqvarna: { bg: "bg-slate-200", text: "text-blue-900", label: "HQ" },
  suzuki: { bg: "bg-yellow-400", text: "text-blue-900", label: "S" },
  triumph: { bg: "bg-black", text: "text-white", label: "T" },
  gasgas: { bg: "bg-red-700", text: "text-white", label: "GG" },
  beta: { bg: "bg-red-500", text: "text-white", label: "B" },
  ducati: { bg: "bg-white", text: "text-red-600", label: "D" },
};

// Teams whose name doesn't contain the manufacturer
const TEAM_MANUFACTURER_MAP: Record<string, string> = {
  "partzilla blaster prmx racing": "kawasaki",
  "team tedder": "ktm",
};

function getManufacturerStyle(team: string) {
  const lower = team.toLowerCase();
  // Check explicit team-to-manufacturer mapping first
  const mappedMfg = TEAM_MANUFACTURER_MAP[lower];
  if (mappedMfg && MANUFACTURER_STYLES[mappedMfg]) return MANUFACTURER_STYLES[mappedMfg];
  // Then check if team name contains a manufacturer
  for (const [mfg, style] of Object.entries(MANUFACTURER_STYLES)) {
    if (lower.includes(mfg)) return style;
  }
  return { bg: "bg-gray-600", text: "text-white", label: team.slice(0, 2).toUpperCase() };
}

export default function TeamLogo({ team, size = "md" }: { team: string | null; size?: "sm" | "md" }) {
  if (!team) return null;

  const style = getManufacturerStyle(team);

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
