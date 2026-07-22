// ClientPortalApp.tsx
// Entirely separate from App.tsx/AuthGate/ensureProfile on purpose — a
// client login must never create a `profiles` row (that would grant full
// internal-tool access once combined with is_team_member()). This file
// does its own session check and its own identity resolution against
// `client_users`, and touches nothing else.
import React, { useEffect, useState } from "react";
import { supabase } from "./supabase";

const BRAND = {
  forestGreen: "#2C4A3E",
  ember: "#C4622D",
  cream: "#F7F3EC",
};

interface PortalClient {
  id: string;
  name: string;
  stage: string;
}

interface PortalProject {
  id: string;
  name: string;
  status: string;
  target_delivery_date: string | null;
}

interface PortalTask {
  id: string;
  project_id: string;
  title: string;
  status: string;
  due_date: string | null;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "signed_out" }
  | { kind: "not_authorized" }
  | { kind: "ready"; client: PortalClient; projects: PortalProject[]; tasks: PortalTask[] }
  | { kind: "error"; message: string };

const STAGE_LABELS: Record<string, string> = {
  lead: "Getting to know you",
  proposal_sent: "Reviewing your proposal",
  active: "In progress",
  delivered: "Delivered",
  archived: "Archived",
};

export function ClientPortalApp() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let mounted = true;

    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        if (mounted) setState({ kind: "signed_out" });
        return;
      }

      const { data: mapping } = await supabase
        .from("client_users")
        .select("client_id")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!mapping) {
        if (mounted) setState({ kind: "not_authorized" });
        return;
      }

      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("id, name, stage")
        .eq("id", mapping.client_id)
        .single();

      if (clientError || !client) {
        if (mounted) setState({ kind: "error", message: "Couldn't load your account." });
        return;
      }

      const { data: projects } = await supabase
        .from("projects")
        .select("id, name, status, target_delivery_date")
        .eq("client_id", mapping.client_id)
        .order("created_at", { ascending: false });

      const projectIds = (projects ?? []).map((p) => p.id);
      let tasks: PortalTask[] = [];
      if (projectIds.length > 0) {
        const { data: taskRows } = await supabase
          .from("tasks")
          .select("id, project_id, title, status, due_date")
          .in("project_id", projectIds)
          .order("due_date", { ascending: true });
        tasks = taskRows ?? [];
      }

      if (mounted) {
        setState({ kind: "ready", client, projects: projects ?? [], tasks });
      }
    }

    load().catch(() => {
      if (mounted) setState({ kind: "error", message: "Something went wrong loading your portal." });
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (state.kind === "loading") {
    return <CenteredMessage>Loading your portal…</CenteredMessage>;
  }

  if (state.kind === "signed_out") {
    return (
      <CenteredMessage>
        Please use the invite link sent to your email to access your portal.
      </CenteredMessage>
    );
  }

  if (state.kind === "not_authorized") {
    return <CenteredMessage>This account isn't authorized to view a client portal.</CenteredMessage>;
  }

  if (state.kind === "error") {
    return <CenteredMessage>{state.message}</CenteredMessage>;
  }

  const { client, projects, tasks } = state;

  return (
    <div className="min-h-screen" style={{ backgroundColor: BRAND.cream }}>
      <section
        className="px-6 py-16 md:px-16 text-white"
        style={{ backgroundColor: BRAND.forestGreen }}
      >
        <h1 className="text-3xl md:text-4xl font-semibold">Welcome back, {client.name}</h1>
        <p className="mt-2 text-white/80">
          {STAGE_LABELS[client.stage] ?? client.stage}
        </p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="mt-6 text-sm text-white/70 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </section>

      <main className="px-6 py-10 md:px-16 max-w-4xl mx-auto space-y-6">
        {projects.length === 0 ? (
          <div className="rounded-2xl bg-white border p-6 text-neutral-500">
            No active project yet — check back soon.
          </div>
        ) : (
          projects.map((project) => (
            <div key={project.id} className="rounded-2xl bg-white border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">{project.name}</h2>
                <span
                  className="text-xs px-3 py-1 rounded-full font-medium text-white"
                  style={{ backgroundColor: BRAND.ember }}
                >
                  {project.status}
                </span>
              </div>
              {project.target_delivery_date && (
                <p className="text-sm text-neutral-500 mb-4">
                  Target delivery: {new Date(project.target_delivery_date).toLocaleDateString()}
                </p>
              )}

              <div className="space-y-2">
                {tasks.filter((t) => t.project_id === project.id).length === 0 && (
                  <div className="text-sm text-neutral-400 text-center py-6">
                    Nothing to show yet.
                  </div>
                )}
                {tasks
                  .filter((t) => t.project_id === project.id)
                  .map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-xl border p-3 bg-neutral-50"
                  >
                    <span className="text-sm text-neutral-700">{task.title}</span>
                    <div className="flex items-center gap-3">
                      {task.due_date && (
                        <span className="text-xs text-neutral-400">
                          {new Date(task.due_date).toLocaleDateString()}
                        </span>
                      )}
                      <span className="text-xs px-2 py-1 rounded-full bg-neutral-200 text-neutral-600">
                        {task.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 text-center"
      style={{ backgroundColor: BRAND.cream }}
    >
      <p className="text-neutral-600 max-w-sm">{children}</p>
    </div>
  );
}
