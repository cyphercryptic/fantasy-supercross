import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

interface League {
  id: number;
  roster_size: number;
  draft_status: string;
  draft_order: number[] | null;
  max_members: number;
  draft_pick_timer: number | null;
  last_pick_at: string | null;
  draft_auto_users: number[] | null;
}

// Helper: compute whose turn it is and what pick number we're on
function getSnakeDraftInfo(league: League, pickCount: number) {
  const order: number[] = league.draft_order || [];
  const numUsers = order.length;
  const totalPicks = numUsers * league.roster_size;

  if (pickCount >= totalPicks) {
    return { completed: true, currentUserId: null, pickNumber: pickCount, round: 0, order };
  }

  const round = Math.floor(pickCount / numUsers) + 1;
  const posInRound = pickCount % numUsers;

  // Snake: odd rounds go forward, even rounds go backward
  const currentUserId = round % 2 === 1
    ? order[posInRound]
    : order[numUsers - 1 - posInRound];

  return { completed: false, currentUserId, pickNumber: pickCount + 1, round, order };
}

// GET /api/leagues/[id]/draft — get draft state
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;

  const { data: member } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const { data: league } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", id)
    .single();

  if (league.draft_status === "waiting") {
    return NextResponse.json({ draft_status: "waiting" });
  }

  // Get all picks so far
  const { data: rawPicks } = await supabase
    .from("draft_picks")
    .select("pick_number, round, user_id, rider_id, riders(name, number, team, class), users(username)")
    .eq("league_id", id)
    .order("pick_number", { ascending: true });

  const picks = (rawPicks || []).map((p) => {
    const rider = p.riders as unknown as Record<string, unknown> | null;
    const usr = p.users as unknown as Record<string, unknown> | null;
    return {
      pick_number: p.pick_number, round: p.round, user_id: p.user_id, rider_id: p.rider_id,
      rider_name: rider?.name, rider_number: rider?.number, team: rider?.team, class: rider?.class,
      username: usr?.username,
    };
  });

  const pickCount = picks.length;
  const info = getSnakeDraftInfo(league as League, pickCount);

  // Get all members with usernames and team logos
  const { data: rawMembers } = await supabase
    .from("league_members")
    .select("user_id, team_name, team_logo, users(id, username)")
    .eq("league_id", id);

  const members = (rawMembers || []).map((m) => ({
    id: (m.users as unknown as unknown as Record<string, unknown>).id,
    username: (m.users as unknown as unknown as Record<string, unknown>).username,
    team_name: m.team_name,
    team_logo: m.team_logo,
  }));

  const draftedRiderIds = picks.map((p) => p.rider_id);

  const autoUsers: number[] = (league as League).draft_auto_users || [];
  const baseTimer = (league as League).draft_pick_timer || 60;
  const effectiveTimer = info.currentUserId && autoUsers.includes(info.currentUserId) ? 10 : baseTimer;

  return NextResponse.json({
    draft_status: info.completed ? "completed" : "drafting",
    draft_order: info.order,
    current_user_id: info.currentUserId,
    pick_number: info.pickNumber,
    round: info.round,
    total_picks: league.max_members * league.roster_size,
    roster_size: league.roster_size,
    picks,
    members,
    drafted_rider_ids: draftedRiderIds,
    is_my_turn: info.currentUserId === user.id,
    my_id: user.id,
    pick_timer: effectiveTimer,
    pick_started_at: league.last_pick_at,
    server_time: new Date().toISOString(),
    auto_pick_users: autoUsers,
  });
}

// POST /api/leagues/[id]/draft — make a pick
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;
  const { riderId } = await req.json();

  const { data: member } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const { data: league } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", id)
    .single();

  if (league.draft_status !== "drafting") {
    return NextResponse.json({ error: "Draft is not active" }, { status: 400 });
  }

  const { count: pickCount } = await supabase
    .from("draft_picks")
    .select("*", { count: "exact", head: true })
    .eq("league_id", id);

  const info = getSnakeDraftInfo(league as League, pickCount || 0);

  if (info.completed) {
    return NextResponse.json({ error: "Draft is complete" }, { status: 400 });
  }

  if (info.currentUserId !== user.id) {
    return NextResponse.json({ error: "It's not your turn" }, { status: 400 });
  }

  // Check rider exists and isn't already drafted
  const { data: rider } = await supabase
    .from("riders")
    .select("id")
    .eq("id", riderId)
    .maybeSingle();
  if (!rider) {
    return NextResponse.json({ error: "Rider not found" }, { status: 404 });
  }

  const { data: alreadyDrafted } = await supabase
    .from("draft_picks")
    .select("id")
    .eq("league_id", id)
    .eq("rider_id", riderId)
    .maybeSingle();
  if (alreadyDrafted) {
    return NextResponse.json({ error: "Rider already drafted" }, { status: 400 });
  }

  // Make the pick
  await supabase.from("draft_picks").insert({
    league_id: Number(id), pick_number: info.pickNumber, round: info.round,
    user_id: user.id, rider_id: riderId,
  });

  // Also add to league_rosters (ignore if already exists)
  await supabase.from("league_rosters").upsert(
    { league_id: Number(id), user_id: user.id, rider_id: riderId },
    { onConflict: "league_id,user_id,rider_id", ignoreDuplicates: true }
  );

  // Remove user from auto-pick list (they manually picked)
  const currentAutoUsers: number[] = (league as League).draft_auto_users || [];
  if (currentAutoUsers.includes(user.id)) {
    const updated = currentAutoUsers.filter((uid) => uid !== user.id);
    await supabase.from("leagues").update({ draft_auto_users: updated }).eq("id", id);
  }

  // Reset pick timer
  await supabase.from("leagues").update({ last_pick_at: new Date().toISOString() }).eq("id", id);

  // Check if draft is now complete
  const newPickCount = (pickCount || 0) + 1;
  const newInfo = getSnakeDraftInfo(league as League, newPickCount);
  if (newInfo.completed) {
    await supabase.from("leagues").update({ draft_status: "completed" }).eq("id", id);
  }

  return NextResponse.json({ success: true, completed: newInfo.completed });
}

// PATCH /api/leagues/[id]/draft — auto-pick when timer expires
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;

  const { data: member } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const { data: league } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", id)
    .single();

  if (league.draft_status !== "drafting") {
    return NextResponse.json({ error: "Draft is not active" }, { status: 400 });
  }

  // Verify timer has actually expired server-side
  if (league.last_pick_at && league.draft_pick_timer) {
    const started = new Date(league.last_pick_at).getTime();
    const now = Date.now();
    const elapsed = Math.floor((now - started) / 1000);
    if (elapsed < league.draft_pick_timer) {
      return NextResponse.json({ error: "Timer has not expired yet" }, { status: 400 });
    }
  }

  const { count: pickCount } = await supabase
    .from("draft_picks")
    .select("*", { count: "exact", head: true })
    .eq("league_id", id);

  const info = getSnakeDraftInfo(league as League, pickCount || 0);

  if (info.completed) {
    return NextResponse.json({ error: "Draft is complete" }, { status: 400 });
  }

  // Find the top available rider (first rider not yet drafted, ordered by id)
  const { data: draftedPicks } = await supabase
    .from("draft_picks")
    .select("rider_id")
    .eq("league_id", id);

  const draftedIds = (draftedPicks || []).map((p) => p.rider_id);

  let riderQuery = supabase.from("riders").select("id").order("id").limit(1);
  if (draftedIds.length > 0) {
    riderQuery = riderQuery.not("id", "in", `(${draftedIds.join(",")})`);
  }
  const { data: topRider } = await riderQuery.maybeSingle();

  if (!topRider) {
    return NextResponse.json({ error: "No riders available" }, { status: 400 });
  }

  const currentUserId = info.currentUserId!;

  // Make the auto-pick
  await supabase.from("draft_picks").insert({
    league_id: Number(id), pick_number: info.pickNumber, round: info.round,
    user_id: currentUserId, rider_id: topRider.id,
  });

  await supabase.from("league_rosters").upsert(
    { league_id: Number(id), user_id: currentUserId, rider_id: topRider.id },
    { onConflict: "league_id,user_id,rider_id", ignoreDuplicates: true }
  );

  // Add user to auto-pick list (10s timer until they manually pick)
  const currentAutoUsers: number[] = (league as League).draft_auto_users || [];
  if (!currentAutoUsers.includes(currentUserId)) {
    currentAutoUsers.push(currentUserId);
    await supabase.from("leagues").update({ draft_auto_users: currentAutoUsers }).eq("id", id);
  }

  // Reset pick timer
  await supabase.from("leagues").update({ last_pick_at: new Date().toISOString() }).eq("id", id);

  // Check if draft is now complete
  const newPickCount = (pickCount || 0) + 1;
  const newInfo = getSnakeDraftInfo(league as League, newPickCount);
  if (newInfo.completed) {
    await supabase.from("leagues").update({ draft_status: "completed" }).eq("id", id);
  }

  return NextResponse.json({ success: true, auto_pick: true, completed: newInfo.completed });
}
