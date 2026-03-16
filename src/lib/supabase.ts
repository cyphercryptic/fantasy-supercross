import { createClient } from "@supabase/supabase-js";

// Force fresh client after app_users table rename
export const supabase = createClient(
  process.env.CUSTOM_SUPABASE_URL!,
  process.env.CUSTOM_SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "public" } }
);
