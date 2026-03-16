"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import MotoBike, { parseBikeConfig } from "@/components/MotoBike";

interface User {
  id: number;
  username: string;
  is_admin: number;
}

interface MyLeague {
  id: number;
  name: string;
  team_name: string | null;
  team_logo: string | null;
}

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [leagues, setLeagues] = useState<MyLeague[]>([]);
  const [teamOpen, setTeamOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setUser(d.user);
        if (d.user) {
          fetch("/api/leagues")
            .then((r) => r.json())
            .then((data: MyLeague[]) => setLeagues(data));
        }
      });
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setTeamOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function logout() {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    setUser(null);
    setMobileOpen(false);
    setProfileOpen(false);
    router.push("/");
    router.refresh();
  }

  async function handleChangePassword() {
    setPasswordError("");
    setPasswordMessage("");

    if (!currentPassword || !newPassword) {
      setPasswordError("All fields are required");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords don't match");
      return;
    }

    setChangingPassword(true);
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "change_password",
        password: currentPassword,
        newPassword,
      }),
    });
    const data = await res.json();
    setChangingPassword(false);

    if (!res.ok) {
      setPasswordError(data.error);
      return;
    }

    setPasswordMessage("Password changed successfully!");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setTimeout(() => {
      setShowPasswordModal(false);
      setPasswordMessage("");
    }, 1500);
  }

  function openPasswordModal() {
    setProfileOpen(false);
    setMobileOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
    setPasswordMessage("");
    setShowPasswordModal(true);
  }

  return (
    <>
      <nav className="bg-[#1A1A1A] border-b border-[#333333] relative z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-white tracking-tight">
            Fantasy SX
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-6">
            {user ? (
              <>
                {/* My Team Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setTeamOpen(!teamOpen)}
                    className="text-gray-300 hover:text-white text-sm flex items-center gap-1"
                  >
                    My Team
                    <svg className={`w-3 h-3 transition-transform ${teamOpen ? "rotate-180" : ""}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {teamOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-[#D4D0CB] rounded-lg shadow-xl z-50 py-1 overflow-hidden">
                      {leagues.length > 0 ? (
                        leagues.map((league) => (
                          <Link
                            key={league.id}
                            href={`/leagues/${league.id}/team`}
                            onClick={() => setTeamOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#F5F0EB] transition-colors"
                          >
                            <div className="w-7 h-7 rounded bg-[#E8E4DF] flex items-center justify-center overflow-hidden shrink-0">
                              {parseBikeConfig(league.team_logo) ? (
                                <MotoBike brand={parseBikeConfig(league.team_logo)!.brand} number={parseBikeConfig(league.team_logo)!.number} size="sm" />
                              ) : (
                                <span className="text-xs text-[#6B6B6B]">
                                  {(league.team_name || league.name).charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[#1A1A1A] text-sm font-medium truncate">
                                {league.team_name || league.name}
                              </p>
                              {league.team_name && (
                                <p className="text-[#8A8A8A] text-xs truncate">{league.name}</p>
                              )}
                            </div>
                          </Link>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-[#8A8A8A] text-sm">
                          No leagues yet
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Link href="/schedule" className="text-gray-300 hover:text-white text-sm">
                  Schedule
                </Link>
                <Link href="/leagues" className="text-gray-300 hover:text-white text-sm">
                  Leagues
                </Link>
                {user.is_admin === 1 && (
                  <Link href="/admin" className="text-yellow-400 hover:text-yellow-300 text-sm">
                    Admin
                  </Link>
                )}

                {/* Profile Dropdown */}
                <div className="relative" ref={profileRef}>
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 text-gray-300 hover:text-white text-sm transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-[#333] border border-[#555] flex items-center justify-center">
                      <span className="text-xs font-bold text-white uppercase">
                        {user.username.charAt(0)}
                      </span>
                    </div>
                    <span>{user.username}</span>
                    <svg className={`w-3 h-3 transition-transform ${profileOpen ? "rotate-180" : ""}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {profileOpen && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-[#D4D0CB] rounded-lg shadow-xl z-50 py-1 overflow-hidden">
                      <div className="px-4 py-2 border-b border-[#E8E4DF]">
                        <p className="text-[#1A1A1A] text-sm font-semibold">{user.username}</p>
                        <p className="text-[#A0A0A0] text-xs">{user.is_admin === 1 ? "Admin" : "Member"}</p>
                      </div>
                      <button
                        onClick={openPasswordModal}
                        className="w-full text-left px-4 py-2.5 text-sm text-[#1A1A1A] hover:bg-[#F5F0EB] transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 text-[#8A8A8A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Change Password
                      </button>
                      <button
                        onClick={logout}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/schedule" className="text-gray-300 hover:text-white text-sm">
                  Schedule
                </Link>
                <Link href="/login" className="text-gray-300 hover:text-white text-sm">
                  Login
                </Link>
                <Link
                  href="/register"
                  className="bg-[#1A1A1A] hover:bg-[#333333] text-white px-4 py-2 rounded text-sm"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden text-gray-300 hover:text-white p-2"
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden bg-[#1A1A1A] border-t border-[#333333] px-4 pb-4">
            {user ? (
              <div className="flex flex-col gap-1 pt-2">
                {/* Profile section */}
                <div className="flex items-center gap-3 px-3 py-3 mb-1">
                  <div className="w-10 h-10 rounded-full bg-[#333] border border-[#555] flex items-center justify-center">
                    <span className="text-sm font-bold text-white uppercase">
                      {user.username.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold">{user.username}</p>
                    <p className="text-[#666] text-xs">{user.is_admin === 1 ? "Admin" : "Member"}</p>
                  </div>
                </div>

                <div className="border-t border-[#333] my-1" />

                {/* My Team section */}
                <p className="text-[#666] text-xs uppercase tracking-wider mt-2 mb-1 px-3">My Teams</p>
                {leagues.length > 0 ? (
                  leagues.map((league) => (
                    <Link
                      key={league.id}
                      href={`/leagues/${league.id}/team`}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#2A2A2A] transition-colors"
                    >
                      <div className="w-8 h-8 rounded bg-[#333] flex items-center justify-center overflow-hidden shrink-0">
                        {parseBikeConfig(league.team_logo) ? (
                          <MotoBike brand={parseBikeConfig(league.team_logo)!.brand} number={parseBikeConfig(league.team_logo)!.number} size="sm" />
                        ) : (
                          <span className="text-xs text-[#999] font-bold">
                            {(league.team_name || league.name).charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate">
                          {league.team_name || league.name}
                        </p>
                        {league.team_name && (
                          <p className="text-[#666] text-xs truncate">{league.name}</p>
                        )}
                      </div>
                    </Link>
                  ))
                ) : (
                  <p className="text-[#666] text-sm px-3 py-2">No leagues yet</p>
                )}

                <div className="border-t border-[#333] my-2" />

                <Link
                  href="/schedule"
                  onClick={() => setMobileOpen(false)}
                  className="text-gray-300 hover:text-white hover:bg-[#2A2A2A] text-sm px-3 py-2.5 rounded-lg"
                >
                  Schedule
                </Link>
                <Link
                  href="/leagues"
                  onClick={() => setMobileOpen(false)}
                  className="text-gray-300 hover:text-white hover:bg-[#2A2A2A] text-sm px-3 py-2.5 rounded-lg"
                >
                  Leagues
                </Link>
                {user.is_admin === 1 && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="text-yellow-400 hover:text-yellow-300 hover:bg-[#2A2A2A] text-sm px-3 py-2.5 rounded-lg"
                  >
                    Admin
                  </Link>
                )}

                <div className="border-t border-[#333] my-2" />

                <button
                  onClick={openPasswordModal}
                  className="text-gray-300 hover:text-white hover:bg-[#2A2A2A] text-sm px-3 py-2.5 rounded-lg text-left flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Change Password
                </button>
                <button
                  onClick={logout}
                  className="text-red-400 hover:text-red-300 hover:bg-[#2A2A2A] text-sm px-3 py-2.5 rounded-lg text-left flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-1 pt-2">
                <Link
                  href="/schedule"
                  onClick={() => setMobileOpen(false)}
                  className="text-gray-300 hover:text-white hover:bg-[#2A2A2A] text-sm px-3 py-2.5 rounded-lg"
                >
                  Schedule
                </Link>
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="text-gray-300 hover:text-white hover:bg-[#2A2A2A] text-sm px-3 py-2.5 rounded-lg"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileOpen(false)}
                  className="bg-white text-[#1A1A1A] hover:bg-gray-200 text-sm px-3 py-2.5 rounded-lg text-center font-medium mt-1"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={() => setShowPasswordModal(false)}>
          <div className="bg-[#F5F0EB] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[#1A1A1A] text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">Change Password</h3>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              {passwordMessage && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-sm">
                  {passwordMessage}
                </div>
              )}
              {passwordError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                  {passwordError}
                </div>
              )}

              <div>
                <label className="block text-[#8A8A8A] text-xs uppercase tracking-wide mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-white border border-[#D4D0CB] rounded-lg px-3 py-2 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>
              <div>
                <label className="block text-[#8A8A8A] text-xs uppercase tracking-wide mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-white border border-[#D4D0CB] rounded-lg px-3 py-2 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>
              <div>
                <label className="block text-[#8A8A8A] text-xs uppercase tracking-wide mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleChangePassword()}
                  className="w-full bg-white border border-[#D4D0CB] rounded-lg px-3 py-2 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleChangePassword}
                  disabled={changingPassword}
                  className="flex-1 bg-[#1A1A1A] hover:bg-[#333333] text-white py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {changingPassword ? "Saving..." : "Update Password"}
                </button>
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2.5 text-[#8A8A8A] hover:text-[#1A1A1A] text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
