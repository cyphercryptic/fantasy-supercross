import Link from "next/link";

function NumberPlate({ number, accentColor }: { number: string; accentColor: string }) {
  // Motocross front plate shape: peaked top corners, concave waist, angular forked bottom
  const outerPath = `
    M 18,18 Q 10,4 28,2 L 90,10 Q 100,12 110,10 L 172,2 Q 190,4 182,18
    Q 200,55 196,95 Q 192,135 172,158
    L 152,180 L 140,170 L 118,208 L 100,235 L 82,208 L 60,170 L 48,180 L 28,158
    Q 8,135 4,95 Q 0,55 18,18 Z
  `;
  const innerPath = `
    M 23,22 Q 17,10 32,8 L 90,15 Q 100,17 110,15 L 168,8 Q 183,10 177,22
    Q 194,55 190,93 Q 186,131 168,153
    L 150,174 L 140,165 L 119,202 L 100,228 L 81,202 L 60,165 L 50,174 L 32,153
    Q 14,131 10,93 Q 6,55 23,22 Z
  `;
  return (
    <div className="flex-shrink-0" style={{ width: "clamp(70px, 12vw, 110px)", aspectRatio: "0.85" }}>
      <svg viewBox="0 0 200 240" className="w-full h-full drop-shadow-md" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id={`plate-${number}`}>
            <path d={innerPath} />
          </clipPath>
        </defs>
        {/* Black border */}
        <path d={outerPath} fill="#1A1A1A" />
        {/* White fill inset */}
        <path d={innerPath} fill="white" />
        {/* Color banner at top */}
        <rect x="6" y="6" width="188" height="58" fill={accentColor} clipPath={`url(#plate-${number})`} />
        {/* Separator line below banner */}
        <line x1="25" y1="68" x2="175" y2="68" stroke="#1A1A1A" strokeWidth="3" />
        {/* Number */}
        <text x="100" y="135" textAnchor="middle" dominantBaseline="middle" fill="#1A1A1A" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="800" fontSize="95" letterSpacing="-4">
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
