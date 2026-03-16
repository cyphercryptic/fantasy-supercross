import { cookies } from "next/headers";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "./supabase";

export interface User {
  id: number;
  username: string;
  is_admin: number;
}

export async function createSession(userId: number): Promise<string> {
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("sessions").insert({
    id: sessionId,
    user_id: userId,
    expires_at: expiresAt,
  });
  const cookieStore = await cookies();
  cookieStore.set("session", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
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

  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionCookie.value)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!session) return null;

  const { data: user } = await supabase
    .from("app_users")
    .select("id, username, is_admin")
    .eq("id", session.user_id)
    .maybeSingle();

  return user ?? null;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");
  if (sessionCookie) {
    await supabase.from("sessions").delete().eq("id", sessionCookie.value);
    cookieStore.delete("session");
  }
}
