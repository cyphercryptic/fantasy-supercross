"use client";

export const BIKE_BRANDS: Record<string, { color: string; label: string }> = {
  ktm: { color: "#FF6600", label: "KTM" },
  yamaha: { color: "#2563EB", label: "Yamaha" },
  honda: { color: "#E50000", label: "Honda" },
  kawasaki: { color: "#00A550", label: "Kawasaki" },
  husqvarna: { color: "#1E3A5F", label: "Husqvarna" },
  suzuki: { color: "#EAB308", label: "Suzuki" },
  gasgas: { color: "#CC0000", label: "GasGas" },
  triumph: { color: "#6B7280", label: "Triumph" },
};

export interface BikeConfig {
  brand: string;
  number: number;
}

export function parseBikeConfig(teamLogo: string | null): BikeConfig | null {
  if (!teamLogo || !teamLogo.startsWith("{")) return null;
  try {
    const config = JSON.parse(teamLogo);
    if (config.brand && config.number !== undefined) return config as BikeConfig;
    return null;
  } catch {
    return null;
  }
}

export default function MotoBike({
  brand,
  number,
  size = "md",
}: {
  brand: string;
  number: number;
  size?: "sm" | "md" | "lg";
}) {
  const brandInfo = BIKE_BRANDS[brand] || BIKE_BRANDS.ktm;
  const color = brandInfo.color;

  const dims = size === "sm" ? "w-9 h-9" : size === "lg" ? "w-20 h-20" : "w-12 h-12";

  // Scale font size based on digit count — keep numbers well inside the plate
  const digits = String(number).length;
  const fontSize = digits <= 1 ? "13" : digits <= 2 ? "12" : "7.5";

  return (
    <div className={`${dims} shrink-0`} title={`${brandInfo.label} #${number}`}>
      <svg viewBox="0 0 24 26" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        {/* Outer plate shape — black border */}
        <path
          d="M1 1.5 L23 1.5 L23 3 Q23 8 22 13 L20.5 18.5 Q19.5 21.5 17.5 23 L12 25.5 L6.5 23 Q4.5 21.5 3.5 18.5 L2 13 Q1 8 1 3 Z"
          fill="#1A1A1A"
          stroke="#111"
          strokeWidth="0.6"
        />

        {/* Inner white area — generous padding from edges */}
        <path
          d="M3 4 L21 4 L21 5 Q21 9 20.2 13 L19 17.5 Q18.2 20 16.5 21.5 L12 23.5 L7.5 21.5 Q5.8 20 5 17.5 L3.8 13 Q3 9 3 5 Z"
          fill="white"
        />

        {/* Brand color accent stripe at top */}
        <path
          d="M1 1.5 L23 1.5 L23 3 Q23 4.5 22.8 5.5 L1.2 5.5 Q1 4.5 1 3 Z"
          fill={color}
        />

        {/* Brand color accent at bottom point */}
        <path
          d="M7 22.5 L12 25 L17 22.5 L16 23.5 L12 25.5 L8 23.5 Z"
          fill={color}
          opacity="0.85"
        />

        {/* Side accent lines */}
        <line x1="2.2" y1="6.5" x2="4.2" y2="16.5" stroke={color} strokeWidth="1.3" strokeLinecap="round" opacity="0.6" />
        <line x1="21.8" y1="6.5" x2="19.8" y2="16.5" stroke={color} strokeWidth="1.3" strokeLinecap="round" opacity="0.6" />

        {/* Number — centered in the white area */}
        <text
          x="12"
          y="14"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fontSize}
          fontWeight="900"
          fill="#1A1A1A"
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="-0.5"
        >
          {number}
        </text>
      </svg>
    </div>
  );
}
