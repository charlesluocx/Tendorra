import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Service-role client that bypasses RLS. Server-only: never import this from
// a Client Component or expose SUPABASE_SERVICE_ROLE_KEY to the browser.
// Used by trusted server-side code (route handlers, edge functions) that
// must act across companies, e.g. the cron job that flags stale projects.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
