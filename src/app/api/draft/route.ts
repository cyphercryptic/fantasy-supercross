import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_TEAM_SIZE = 8;

// GET /api/draft — get current user's team
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { data: entries } = await supabase
    .from("user_teams")
    .select("riders(*)")
    .eq("user_id", user.id);
  const team = (entries || []).map((e) => e.riders);
  return NextResponse.json(team);
}

// POST /api/draft — draft a rider
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { riderId } = await req.json();

  const { count } = await supabase
    .from("user_teams")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((count || 0) >= MAX_TEAM_SIZE) {
    return NextResponse.json(
      { error: `Maximum team size is ${MAX_TEAM_SIZE} riders` },
      { status: 400 }
    );
  }

  const { data: existing } = await supabase
    .from("user_teams")
    .select("id")
    .eq("user_id", user.id)
    .eq("rider_id", riderId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Rider already on your team" }, { status: 400 });
  }

  await supabase.from("user_teams").insert({ user_id: user.id, rider_id: riderId });
  return NextResponse.json({ success: true });
}

// DELETE /api/draft — drop a rider
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { riderId } = await req.json();
  await supabase.from("user_teams").delete().eq("user_id", user.id).eq("rider_id", riderId);
  return NextResponse.json({ success: true });
}
