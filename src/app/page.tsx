import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background watermark */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
        aria-hidden="true"
      >
        <span className="text-[20rem] md:text-[28rem] font-black tracking-tighter text-[#1A1A1A] opacity-[0.03] leading-none">
          Bar9
        </span>
      </div>
      <div className="text-center max-w-2xl relative z-10">
        <h1 className="text-5xl md:text-7xl font-extrabold mb-4 tracking-tight">
          <span className="text-[#1A1A1A]">Fantasy</span>{" "}
          <span className="text-[#8A8A8A]">Supercross</span>
        </h1>
        <p className="text-[#6B6B6B] text-lg md:text-xl mb-10 leading-relaxed">
          Draft your riders. Score points from real race results. Compete against friends.
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
