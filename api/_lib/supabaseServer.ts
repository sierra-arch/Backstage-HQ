import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export class UnauthorizedError extends Error {}

export interface RequestUser {
  supabase: SupabaseClient;
  user: User;
  displayName: string;
  role: string;
  isTeamMember: boolean;
}

// Verifies the caller's own Supabase session token and returns a client
// scoped to that same token, so server-side queries run with exactly the
// permissions the signed-in user already has in the browser — no
// service-role key needed in this codebase.
export async function getRequestUser(authHeader: string | undefined): Promise<RequestUser> {
  const token = authHeader?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new UnauthorizedError("Missing bearer token");

  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  }

  const verifier = createClient(url, anonKey);
  const { data, error } = await verifier.auth.getUser(token);
  if (error || !data.user) throw new UnauthorizedError("Invalid or expired session");

  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("id", data.user.id)
    .single();

  return {
    supabase,
    user: data.user,
    displayName: profile?.display_name ?? "Unknown",
    role: profile?.role ?? "team",
    // profiles is RLS-gated to team members only (team_full_access), so a
    // successful lookup here is itself proof of team membership — not just
    // a display-name nicety.
    isTeamMember: profile != null,
  };
}
