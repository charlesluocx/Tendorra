import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// The DB also stamps company_id via a BEFORE INSERT trigger as a safety net,
// but the generated Insert types require it explicitly (NOT NULL columns
// without a DDL-level DEFAULT aren't inferred as optional), so callers fetch
// it once and pass it along.
export async function getCurrentCompanyId(supabase: SupabaseClient<Database>): Promise<string> {
  const { data, error } = await supabase.rpc("current_company_id");
  if (error || !data) throw new Error(error?.message ?? "You're not part of a company yet.");
  return data;
}

export type Membership = { companyId: string; role: "owner" | "admin" | "member" };

export async function getCurrentMembership(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Membership | null> {
  const { data } = await supabase
    .from("company_users")
    .select("company_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { companyId: data.company_id, role: data.role as Membership["role"] };
}
