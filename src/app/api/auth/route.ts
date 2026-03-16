import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";
import { createSession, destroySession, getCurrentUser } from "@/lib/auth";

// POST /api/auth — login, register, logout, or change_password
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, username, password, newPassword } = body;

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
    const { data: dbUser } = await supabase
      .from("app_users")
      .select("password_hash")
      .eq("id", user.id)
      .single();
    if (!dbUser || !bcrypt.compareSync(password, dbUser.password_hash)) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }
    const hash = bcrypt.hashSync(newPassword, 10);
    await supabase.from("app_users").update({ password_hash: hash }).eq("id", user.id);
    return NextResponse.json({ success: true });
  }

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password required" }, { status: 400 });
  }

  if (action === "register") {
    const { data: existing } = await supabase
      .from("app_users")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "Username already taken" }, { status: 400 });
    }
    const hash = bcrypt.hashSync(password, 10);
    // First user becomes admin
    const { count } = await supabase
      .from("app_users")
      .select("*", { count: "exact", head: true });
    const isAdmin = count === 0 ? 1 : 0;
    const { data: newUser, error: insertError } = await supabase
      .from("app_users")
      .insert({ username, password_hash: hash, is_admin: isAdmin })
      .select("id")
      .single();
    if (insertError || !newUser) {
      console.error("Registration insert error:", insertError);
      return NextResponse.json({ error: insertError?.message || "Failed to create account" }, { status: 500 });
    }
    await createSession(newUser.id);
    return NextResponse.json({ success: true, isAdmin: isAdmin === 1 });
  }

  if (action === "login") {
    const { data: user } = await supabase
      .from("app_users")
      .select("id, password_hash, is_admin")
      .eq("username", username)
      .maybeSingle();
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    await createSession(user.id);
    return NextResponse.json({ success: true, isAdmin: user.is_admin === 1 });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
