import type { SupabaseClient } from "@supabase/supabase-js";
import { isAllowed } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/** Server routes: only the owner gets through. */
export async function requireOwner(): Promise<{ supabase: SupabaseClient } | { denied: Response }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!isAllowed(data?.claims?.email as string | undefined)) {
    return { denied: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { supabase };
}
