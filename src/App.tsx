import React from "react";
import { supabase } from "./supabase";
import DashboardApp from "./DashboardApp";

/* ---------------- Types ---------------- */
type AppRole = "founder" | "team";

type Profile = {
  id: string;
  display_name: string | null;
  role: AppRole | null;
};

type Session = ReturnType<typeof supabase.auth.getSession> extends Promise<{
  data: { session: infer S };
}>
  ? S
  : any;

/* ---------------- Session hook ---------------- */
function useSession() {
  const [session, setSession] = React.useState<Session | null | undefined>(
    undefined
  );

  React.useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!alive) return;
      setSession(s ?? null);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // undefined = loading, null = signed out, object = signed in
  return session;
}

/* ---------------- Ensure profile row exists ---------------- */
async function ensureProfile(seedRole: AppRole = "team") {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  // Optional: auto-promote certain emails to founder on first login.
  const founderEmails = new Set([
    "sierra@gobackstage.ai",
    "sierra@backstageop.com",
  ]);

  const role: AppRole = founderEmails.has(user.email ?? "")
    ? "founder"
    : seedRole;

  await supabase.from("profiles").upsert(
    {
      id: user.id,
      display_name:
        (user.user_metadata?.full_name as string | undefined) ||
        user.email?.split("@")[0] ||
        "User",
      role,
    },
    { onConflict: "id" }
  );
}

/* ---------------- Profile fetch ---------------- */
async function fetchProfile(): Promise<Profile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  return (data as Profile) ?? null;
}

/* ---------------- Google OAuth button ---------------- */
function GoogleSignInButton() {
  const [loading, setLoading] = React.useState(false);

  async function signIn() {
    setLoading(true);
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // keep it simple: return to the same origin
          redirectTo: window.location.origin,
          // queryParams: { prompt: "select_account" }, // optional
        },
      });
    } catch (e: any) {
      alert(e?.message || "Failed to start Google sign-in");
      setLoading(false);
    }
  }

  return (
    <button
      onClick={signIn}
      disabled={loading}
      className="w-full rounded-xl border px-3 py-2 bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60"
    >
      {loading ? "Redirecting…" : "Sign in with Google"}
    </button>
  );
}

/* ---------------- Optional Sign-out button (exported) ---------------- */
export function SignOutButton() {
  return (
    <button
      className="rounded-xl border px-2 py-1 text-xs"
      onClick={() => supabase.auth.signOut()}
    >
      Sign out
    </button>
  );
}

/* ---------------- Auth gate + role routing ----------------
   Fix: children must be a single ReactElement if we want to clone it.
*/
type AuthInjectedProps = {
  appRole: AppRole;
  profile: Profile | null;
  session: Session;
};

function AuthGate({ children }: { children: React.ReactElement }) {
  const session = useSession();

  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [role, setRole] = React.useState<AppRole | null>(null);
  const [loadingProfile, setLoadingProfile] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;

    async function loadProfile() {
      if (!session) return;

      setErrorMsg(null);
      setLoadingProfile(true);

      try {
        await ensureProfile("team"); // safe to call repeatedly
        const row = await fetchProfile();

        if (!alive) return;

        setProfile(row);
        setRole((row?.role as AppRole | null) ?? "team");
      } catch (err: any) {
        if (!alive) return;
        setErrorMsg(err?.message || "Failed to load profile");
        setRole("team"); // fallback so app still loads
      } finally {
        if (!alive) return;
        setLoadingProfile(false);
      }
    }

    loadProfile();

    return () => {
      alive = false;
    };
  }, [session]);

  // 1) Loading the initial auth state
  if (session === undefined) {
    return (
      <div className="grid place-items-center min-h-screen bg-white">
        <div className="text-sm text-neutral-400">Checking session…</div>
      </div>
    );
  }

  // 2) Signed out → show Google sign-in
  if (!session) {
    return (
      <div className="min-h-screen flex">
        {/* Left panel */}
        <div className="flex-1 flex flex-col justify-center items-center bg-white px-8 py-12">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <div className="text-xs font-semibold tracking-widest text-teal-600 uppercase mb-2">Backstage Dashboard</div>
              <h1 className="text-3xl font-bold text-neutral-900 leading-tight">Welcome to the team.</h1>
              <p className="text-neutral-500 text-sm mt-2 whitespace-nowrap">Sign in to see your tasks, earn points, and stay in sync.</p>
            </div>
            <GoogleSignInButton />
            <p className="text-xs text-neutral-400 text-center mt-4">Only invited team members can access this workspace.</p>
          </div>
        </div>

        {/* Right panel */}
        <div className="hidden md:flex flex-1 flex-col justify-between relative overflow-hidden"
          style={{ backgroundColor: "#0C3B37" }}>
          {/* Watermark lettermark */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
            <span style={{
              fontSize: "32vw",
              fontWeight: 900,
              color: "rgba(255,255,255,0.045)",
              lineHeight: 1,
              letterSpacing: "-0.05em",
              userSelect: "none",
            }}>B</span>
          </div>
          {/* Quote */}
          <div className="relative z-10 mt-auto p-10">
            <p className="text-white/70 text-sm leading-relaxed max-w-xs">
              "The best ops teams don't just execute — they build systems that run without them."
            </p>
            <p className="text-white/40 text-xs mt-3 font-medium">Backstage HQ</p>
          </div>
        </div>
      </div>
    );
  }

  // 3) Signed in but profile/role still loading
  if (loadingProfile || !role) {
    return (
      <div className="grid place-items-center min-h-screen bg-white">
        <div className="text-sm text-neutral-400">Loading your workspace…</div>
      </div>
    );
  }

  // Optional: show profile-load warning (non-blocking)
  // (You can remove this block if you want zero UI for errors.)
  const warning = errorMsg ? (
    <div className="fixed bottom-3 left-3 rounded-xl border bg-white px-3 py-2 text-xs shadow">
      {errorMsg}
    </div>
  ) : null;

  // 4) Signed in → inject props into the single child element
  const injected: AuthInjectedProps = {
    appRole: role,
    profile,
    session,
  };

  return (
    <>
      {React.cloneElement(children, injected as any)}
      {warning}
    </>
  );
}

/* ---------------- App root ---------------- */
export default function App() {
  return (
    <AuthGate>
      <DashboardApp />
    </AuthGate>
  );
}
