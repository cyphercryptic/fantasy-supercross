"use client";

import Link from "next/link";

export default function AdminPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-[#1A1A1A] mb-8">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/admin/riders"
          className="bg-[#F5F0EB] border border-[#D4D0CB] hover:border-[#1A1A1A] rounded-xl p-6 transition-all shadow-sm hover:shadow-md"
        >
          <h2 className="text-xl font-semibold text-[#1A1A1A] mb-2">Manage Riders</h2>
          <p className="text-[#8A8A8A] text-sm">
            Add riders manually or upload a CSV from Google Sheets. Edit or remove existing riders.
          </p>
        </Link>
        <Link
          href="/admin/races"
          className="bg-[#F5F0EB] border border-[#D4D0CB] hover:border-[#1A1A1A] rounded-xl p-6 transition-all shadow-sm hover:shadow-md"
        >
          <h2 className="text-xl font-semibold text-[#1A1A1A] mb-2">Manage Races</h2>
          <p className="text-[#8A8A8A] text-sm">
            Create races, enter finishing positions, and publish results to update league standings.
          </p>
        </Link>
      </div>
    </div>
  );
}
