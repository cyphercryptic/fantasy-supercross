"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }
    let data;
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register", username, password }),
      });
      data = await res.json();
      if (!res.ok) {
        setError(data.error || `Registration failed (${res.status})`);
        return;
      }
    } catch (err) {
      setError("Network error — please try again");
      return;
    }
    if (data.isAdmin) {
      router.push("/admin");
    } else {
      router.push("/leagues");
    }
    router.refresh();
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-start justify-center px-4 pt-12 sm:pt-24">
      <div className="bg-[#F5F0EB] p-8 rounded-xl border border-[#D4D0CB] w-full max-w-md shadow-sm">
        <h1 className="text-2xl font-bold text-[#1A1A1A] mb-6">Create Account</h1>
        <p className="text-[#A0A0A0] text-sm mb-4">
          The first account created will be the admin.
        </p>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4 text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[#8A8A8A] text-sm mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-white border border-[#D4D0CB] rounded-lg px-3 py-2.5 text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A] focus:ring-1 focus:ring-[#1A1A1A]"
              required
            />
          </div>
          <div>
            <label className="block text-[#8A8A8A] text-sm mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white border border-[#D4D0CB] rounded-lg px-3 py-2.5 text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A] focus:ring-1 focus:ring-[#1A1A1A]"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-[#1A1A1A] hover:bg-[#333333] text-white py-2.5 rounded-lg font-semibold transition-all shadow-sm hover:shadow-md"
          >
            Sign Up
          </button>
        </form>
        <p className="text-[#A0A0A0] text-sm mt-4 text-center">
          Already have an account?{" "}
          <Link href="/login" className="text-[#1A1A1A] font-medium underline underline-offset-2 hover:text-[#000000]">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
