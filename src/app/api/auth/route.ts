import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import getDb from "@/lib/db";
import { createSession, destroySession, getCurrentUser } from "@/lib/auth";

// POST /api/auth — login, register, logout, or change_password
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, username, password, newPassword } = body;
  const db = getDb();

  if (action === "logout") {
    await destroySession();
    return NextResponse.json({ success: true });
  }

  if (action === "change_password") {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }
    if (!password || !newPassword) {
      return NextResponse.json({ error: "Current and new password required" }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
    }
    const dbUser = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(user.id) as { password_hash: string } | undefined;
    if (!dbUser || !bcrypt.compareSync(password, dbUser.password_hash)) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }
    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, user.id);
    return NextResponse.json({ success: true });
  }

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password required" }, { status: 400 });
  }

  if (action === "register") {
    const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
    if (existing) {
      return NextResponse.json({ error: "Username already taken" }, { status: 400 });
    }
    const hash = bcrypt.hashSync(password, 10);
    // First user becomes admin
    const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
    const isAdmin = userCount.count === 0 ? 1 : 0;
    const result = db
      .prepare("INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)")
      .run(username, hash, isAdmin);
    await createSession(Number(result.lastInsertRowid));
    return NextResponse.json({ success: true, isAdmin: isAdmin === 1 });
  }

  if (action === "login") {
    const user = db
      .prepare("SELECT * FROM users WHERE username = ?")
      .get(username) as { id: number; password_hash: string; is_admin: number } | undefined;
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    await createSession(user.id);
    return NextResponse.json({ success: true, isAdmin: user.is_admin === 1 });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
