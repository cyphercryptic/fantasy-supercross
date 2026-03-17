import Link from "next/link";

function NumberPlate({ number, accentColor }: { number: string; accentColor: string }) {
  return (
    <div className="flex-shrink-0" style={{ width: "clamp(70px, 12vw, 110px)", aspectRatio: "0.85" }}>
      <svg viewBox="0 0 200 235" className="w-full h-full drop-shadow-md" xmlns="http://www.w3.org/2000/svg">
        {/* Plate outline shape — shield/front number plate */}
        <defs>
          <clipPath id={`plate-${number}`}>
            <path d="M 20,2 L 180,2 Q 198,2 198,20 L 198,140 Q 198,170 170,190 L 130,220 Q 110,233 100,235 Q 90,233 70,220 L 30,190 Q 2,170 2,140 L 2,20 Q 2,2 20,2 Z" />
          </clipPath>
        </defs>
        {/* Black border */}
        <path d="M 20,2 L 180,2 Q 198,2 198,20 L 198,140 Q 198,170 170,190 L 130,220 Q 110,233 100,235 Q 90,233 70,220 L 30,190 Q 2,170 2,140 L 2,20 Q 2,2 20,2 Z" fill="#1A1A1A" />
        {/* White fill inset */}
        <path d="M 25,7 L 175,7 Q 193,7 193,22 L 193,138 Q 193,166 166,185 L 128,216 Q 110,228 100,230 Q 90,228 72,216 L 34,185 Q 7,166 7,138 L 7,22 Q 7,7 25,7 Z" fill="white" />
        {/* Color banner at top (where NAME would be) */}
        <rect x="7" y="7" width="186" height="55" rx="15" fill={accentColor} clipPath={`url(#plate-${number})`} />
        {/* Thin separator line below banner */}
        <line x1="20" y1="65" x2="180" y2="65" stroke="#1A1A1A" strokeWidth="3" />
        {/* Number */}
        <text x="100" y="165" textAnchor="middle" dominantBaseline="middle" fill="#1A1A1A" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="800" fontSize="100" letterSpacing="-4">
          {number}
        </text>
      </svg>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 relative overflow-hidden" style={{}}>
      <div className="text-center max-w-2xl relative z-10">
        <div className="flex items-center gap-4 md:gap-6 justify-center mb-4">
          <NumberPlate number="75" accentColor="#FF6600" />
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">
            <span className="text-[#1A1A1A]">Fantasy</span>{" "}
            <span className="text-[#8A8A8A]">Supercross</span>
          </h1>
          <NumberPlate number="99" accentColor="#DC2626" />
        </div>
        <p className="text-[#6B6B6B] text-lg md:text-xl mb-10 leading-relaxed relative">
          Draft your riders. Score points from real race results. Compete against friends.
          {/* Bar9 watermark — top aligned with bottom of this text, spans buttons + cards */}
          <span
            className="absolute left-1/2 -translate-x-1/2 font-black tracking-tighter leading-none whitespace-nowrap pointer-events-none select-none"
            style={{
              fontSize: "clamp(16rem, 49vw, 49rem)",
              top: "-120%",
              color: "transparent",
              WebkitTextFillColor: "transparent",
              textShadow: `
                -2px -2px 0 rgba(139, 35, 35, 0.03),
                 2px -2px 0 rgba(139, 35, 35, 0.03),
                -2px  2px 0 rgba(139, 35, 35, 0.03),
                 2px  2px 0 rgba(139, 35, 35, 0.03),
                 0px -2px 0 rgba(139, 35, 35, 0.03),
                 0px  2px 0 rgba(139, 35, 35, 0.03),
                -2px  0px 0 rgba(139, 35, 35, 0.03),
                 2px  0px 0 rgba(139, 35, 35, 0.03)
              `,
            }}
            aria-hidden="true"
          >
            Bar9
          </span>
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/register"
            className="bg-[#1A1A1A] hover:bg-[#333333] text-white px-8 py-3 rounded-lg text-lg font-semibold transition-all shadow-md hover:shadow-lg"
          >
            Get Started
          </Link>
          <Link
            href="/leagues"
            className="border-2 border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white px-8 py-3 rounded-lg text-lg font-semibold transition-all"
          >
            My Leagues
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mt-24 max-w-4xl w-full relative z-10">
        {[
          { num: "1", title: "Draft Riders", desc: "Pick up to 8 supercross riders for your fantasy team from the full roster." },
          { num: "2", title: "Score Points", desc: "Earn points based on your riders' finishing positions in each round." },
          { num: "3", title: "Win Your League", desc: "Compete against friends in your league all season long." },
        ].map((step) => (
          <div key={step.num} className="text-center bg-[#F5F0EB] rounded-xl p-6 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center mx-auto mb-4 text-lg font-bold">
              {step.num}
            </div>
            <h3 className="text-[#1A1A1A] font-semibold mb-2 text-lg">{step.title}</h3>
            <p className="text-[#8A8A8A] text-sm leading-relaxed">{step.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
