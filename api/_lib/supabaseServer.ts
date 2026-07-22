import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export class UnauthorizedError extends Error {}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

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

export interface RequestClientUser {
  user: User;
  clientId: string;
}

// Verifies a *client-portal* session token (a client_users identity, not a
// profiles/team identity) and resolves it to the client_id it's mapped to.
// Uses the service-role key to read client_users because this check must
// succeed reliably regardless of RLS nuances — but it never uses the
// service-role key to authorize anything beyond "which client_id does this
// verified auth.uid() belong to". Callers are still responsible for
// scoping every subsequent read/write to that exact clientId.
export async function getRequestClientUser(authHeader: string | undefined): Promise<RequestClientUser> {
  const token = authHeader?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new UnauthorizedError("Missing bearer token");

  const url = requireEnv("VITE_SUPABASE_URL");
  const anonKey = requireEnv("VITE_SUPABASE_ANON_KEY");

  const verifier = createClient(url, anonKey);
  const { data, error } = await verifier.auth.getUser(token);
  if (error || !data.user) throw new UnauthorizedError("Invalid or expired session");

  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(url, serviceRoleKey);

  const { data: mapping } = await admin
    .from("client_users")
    .select("client_id")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!mapping) throw new UnauthorizedError("This account isn't authorized for a client portal");

  return { user: data.user, clientId: mapping.client_id };
}

export function getAdminClient(): SupabaseClient {
  const url = requireEnv("VITE_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceRoleKey);
}
