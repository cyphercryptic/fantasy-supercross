"use client";

import { useParams } from "next/navigation";
import Link from "next/link";

const POINTS_TABLE = [
  { pos: "1st", pts: 10 },
  { pos: "2nd", pts: 8 },
  { pos: "3rd", pts: 7 },
  { pos: "4th", pts: 6 },
  { pos: "5th", pts: 5 },
  { pos: "6th", pts: 4 },
  { pos: "7th", pts: 4 },
  { pos: "8th", pts: 3 },
  { pos: "9th", pts: 3 },
  { pos: "10th", pts: 3 },
  { pos: "11th", pts: 2 },
  { pos: "12th", pts: 2 },
  { pos: "13th", pts: 2 },
  { pos: "14th", pts: 2 },
  { pos: "15th", pts: 1 },
  { pos: "16th", pts: 1 },
  { pos: "17th", pts: 1 },
  { pos: "18th", pts: 1 },
  { pos: "19th", pts: 1 },
  { pos: "20th", pts: 1 },
  { pos: "21st", pts: 1 },
  { pos: "22nd", pts: 1 },
];

export default function RulesPage() {
  const { id } = useParams();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link
        href={`/leagues/${id}`}
        className="text-[#8A8A8A] hover:text-[#1A1A1A] text-sm mb-6 inline-flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to League
      </Link>

      <h1 className="text-3xl font-bold text-[#1A1A1A] tracking-tight mb-2">Rules & Scoring</h1>
      <p className="text-[#8A8A8A] mb-8">Everything you need to know about how Fantasy Supercross works.</p>

      {/* How It Works */}
      <section className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-6 mb-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-xs font-bold">?</span>
          How It Works
        </h2>
        <div className="space-y-3 text-[#4A4A4A] text-sm leading-relaxed">
          <p>Fantasy Supercross lets you build a team of real AMA Supercross riders and earn points based on their actual race finishes throughout the season.</p>
          <ol className="list-decimal list-inside space-y-2 ml-1">
            <li><strong>Create or join a league</strong> with friends using an invite code.</li>
            <li><strong>Draft riders</strong> in a live snake draft to build your roster.</li>
            <li><strong>Set your lineup</strong> each week, choosing which riders will score for you.</li>
            <li><strong>Earn points</strong> based on how your riders finish in real races.</li>
            <li><strong>Manage your roster</strong> by picking up free agents and dropping riders throughout the season.</li>
          </ol>
        </div>
      </section>

      {/* The Draft */}
      <section className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-6 mb-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-xs font-bold">1</span>
          The Draft
        </h2>
        <div className="space-y-3 text-[#4A4A4A] text-sm leading-relaxed">
          <p>Once all members have joined, the commissioner starts a <strong>snake draft</strong>.</p>
          <ul className="list-disc list-inside space-y-2 ml-1">
            <li><strong>Snake order</strong> — The pick order reverses each round. If you pick 1st in Round 1, you pick last in Round 2, then 1st again in Round 3, and so on.</li>
            <li><strong>Timed picks</strong> — Each pick has a timer set by the commissioner. If time runs out, a rider is auto-picked for you.</li>
            <li><strong>Any class</strong> — You can draft riders from any class (450, 250E, 250W) in any order.</li>
            <li><strong>Roster fills up</strong> — The draft continues until every team has a full roster.</li>
          </ul>
        </div>
      </section>

      {/* Lineup & Roster */}
      <section className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-6 mb-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-xs font-bold">2</span>
          Lineup & Roster
        </h2>
        <div className="space-y-3 text-[#4A4A4A] text-sm leading-relaxed">
          <p>Your <strong>roster</strong> is your full pool of drafted riders. Your <strong>lineup</strong> is the subset of riders who will score points for you each week.</p>
          <ul className="list-disc list-inside space-y-2 ml-1">
            <li><strong>Starters</strong> — Only riders in your active lineup earn points. The number of lineup slots per class is set by your league commissioner.</li>
            <li><strong>Backups</strong> — Riders on your roster but not in the lineup do not score points that week.</li>
            <li><strong>Set it before race day</strong> — Make sure your lineup is locked in before each round.</li>
          </ul>
        </div>
      </section>

      {/* Free Agency */}
      <section className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-6 mb-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-xs font-bold">3</span>
          Free Agency
        </h2>
        <div className="space-y-3 text-[#4A4A4A] text-sm leading-relaxed">
          <p>After the draft, you can improve your team by picking up <strong>free agents</strong> — riders not on any team in your league.</p>
          <ul className="list-disc list-inside space-y-2 ml-1">
            <li><strong>Add/Drop</strong> — To pick up a free agent when your roster is full, you must drop an existing rider.</li>
            <li><strong>Dropped riders</strong> — When you drop a rider, they become a free agent available to everyone.</li>
            <li><strong>No limits</strong> — You can make as many transactions as you want throughout the season.</li>
          </ul>
        </div>
      </section>

      {/* Scoring */}
      <section className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-6 mb-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-xs font-bold">4</span>
          Scoring
        </h2>
        <div className="space-y-3 text-[#4A4A4A] text-sm leading-relaxed">
          <p>Points are awarded based on your rider&apos;s <strong>main event finishing position</strong>. Only riders in your active lineup earn points.</p>
        </div>

        {/* Points table */}
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-0">
          <div>
            <div className="flex justify-between text-xs text-[#8A8A8A] uppercase tracking-wide border-b border-[#D4D0CB] pb-1 mb-1 font-medium">
              <span>Position</span>
              <span>Points</span>
            </div>
            {POINTS_TABLE.slice(0, 11).map((row) => (
              <div key={row.pos} className="flex justify-between text-sm py-1 border-b border-[#E8E4DF]">
                <span className="text-[#4A4A4A]">{row.pos}</span>
                <span className="text-[#1A1A1A] font-semibold">{row.pts}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="flex justify-between text-xs text-[#8A8A8A] uppercase tracking-wide border-b border-[#D4D0CB] pb-1 mb-1 font-medium">
              <span>Position</span>
              <span>Points</span>
            </div>
            {POINTS_TABLE.slice(11).map((row) => (
              <div key={row.pos} className="flex justify-between text-sm py-1 border-b border-[#E8E4DF]">
                <span className="text-[#4A4A4A]">{row.pos}</span>
                <span className="text-[#1A1A1A] font-semibold">{row.pts}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[#8A8A8A] text-xs mt-3 italic">Finishing outside the top 22 earns 0 points. DNS / DNF / DQ = 0 points.</p>
      </section>

      {/* Bonus Points */}
      <section className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-6 mb-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-xs font-bold">+</span>
          Bonus Points
        </h2>
        <div className="space-y-3 text-[#4A4A4A] text-sm leading-relaxed">
          <p>In addition to main event finishing points, riders can earn <strong>+1 bonus point</strong> for each of the following:</p>
        </div>
        <div className="mt-3 space-y-2">
          {[
            { label: "Heat Race Win", desc: "Winning any heat race", pts: "+1" },
            { label: "LCQ Win", desc: "Winning the Last Chance Qualifier", pts: "+1" },
            { label: "Holeshot", desc: "Getting the main event holeshot", pts: "+1" },
          ].map((bonus) => (
            <div key={bonus.label} className="flex items-center justify-between bg-[#EBE7E2] rounded-lg px-4 py-3">
              <div>
                <p className="text-[#1A1A1A] text-sm font-medium">{bonus.label}</p>
                <p className="text-[#8A8A8A] text-xs">{bonus.desc}</p>
              </div>
              <span className="text-[#1A1A1A] font-bold text-sm bg-[#F5F0EB] px-3 py-1 rounded">{bonus.pts}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Standings */}
      <section className="bg-[#F5F0EB] border border-[#D4D0CB] rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-xs font-bold">5</span>
          Standings & Winning
        </h2>
        <div className="space-y-3 text-[#4A4A4A] text-sm leading-relaxed">
          <p>Your total score is the <strong>cumulative points</strong> earned by your active lineup riders across all completed races.</p>
          <ul className="list-disc list-inside space-y-2 ml-1">
            <li><strong>Leaderboard</strong> — The league standings are ranked by total points.</li>
            <li><strong>Season long</strong> — Points accumulate all season. The team with the most total points at the end of the season wins.</li>
            <li><strong>Expand standings</strong> — Click on any team in the leaderboard to see a rider-by-rider breakdown of how their points were scored.</li>
          </ul>
        </div>
      </section>

      {/* Back to league */}
      <div className="text-center mt-8">
        <Link
          href={`/leagues/${id}`}
          className="text-[#8A8A8A] hover:text-[#1A1A1A] text-sm"
        >
          Back to League Home
        </Link>
      </div>
    </div>
  );
}
