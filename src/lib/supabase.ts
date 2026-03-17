import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.CUSTOM_SUPABASE_URL;
    const key = process.env.CUSTOM_SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Missing CUSTOM_SUPABASE_URL or CUSTOM_SUPABASE_SERVICE_ROLE_KEY");
    }
    _supabase = createClient(url, key, { db: { schema: "public" } });
  }
  return _supabase;
}

// Keep backward-compatible named export that lazily initializes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
