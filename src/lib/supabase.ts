import { createClient } from "@supabase/supabase-js";

// Force fresh client after app_users table rename
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "public" } }
);
