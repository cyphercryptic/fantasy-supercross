import { cookies } from "next/headers";
import { v4 as uuidv4 } from "uuid";
import getDb from "./db";

export interface User {
  id: number;
  username: string;
  is_admin: number;
}

export async function createSession(userId: number): Promise<string> {
  const db = getDb();
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
  db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(
    sessionId,
    userId,
    expiresAt
  );
  const cookieStore = await cookies();
  cookieStore.set("session", sessionId, {
    httpOnly: true,
    secure: false, // set to true in production
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return sessionId;
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");
  if (!sessionCookie) return null;

  const db = getDb();
  const session = db
    .prepare("SELECT * FROM sessions WHERE id = ? AND expires_at > datetime('now')")
    .get(sessionCookie.value) as { user_id: number } | undefined;

  if (!session) return null;

  const user = db
    .prepare("SELECT id, username, is_admin FROM users WHERE id = ?")
    .get(session.user_id) as User | undefined;

  return user ?? null;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");
  if (sessionCookie) {
    const db = getDb();
    db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionCookie.value);
    cookieStore.delete("session");
  }
}
