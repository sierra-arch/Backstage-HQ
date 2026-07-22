// ClientPortalApp.tsx
// Entirely separate from App.tsx/AuthGate/ensureProfile on purpose — a
// client login must never create a `profiles` row (that would grant full
// internal-tool access once combined with is_team_member()). This file
// does its own session check and its own identity resolution against
// `client_users`, and touches nothing else.
import React, { useEffect, useState } from "react";
import { supabase } from "./supabase";
import {
  fetchProposalsForClient,
  fetchPaymentScheduleForProposal,
  type ProposalWithDocument,
  type DocumentTemplate,
  type PaymentInstallment,
} from "./useDatabase";
import {
  computeDocumentTotals,
  getDesignBriefSection,
  getLineItemSections,
  clampSelection,
  type Selections,
} from "../api/_lib/proposalEngine";

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
  | {
      kind: "ready";
      client: PortalClient;
      projects: PortalProject[];
      tasks: PortalTask[];
      proposals: ProposalWithDocument[];
    }
  | { kind: "error"; message: string };

const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Awaiting your review",
  viewed: "In progress",
  accepted: "Accepted",
  declined: "Declined",
};

const STAGE_LABELS: Record<string, string> = {
  lead: "Getting to know you",
  proposal_sent: "Reviewing your proposal",
  active: "In progress",
  delivered: "Delivered",
  archived: "Archived",
};

export function ClientPortalApp() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [refreshKey, setRefreshKey] = useState(0);
  const refetchProposals = () => setRefreshKey((k) => k + 1);

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

      const proposals = await fetchProposalsForClient(mapping.client_id).catch(() => []);

      if (mounted) {
        setState({ kind: "ready", client, projects: projects ?? [], tasks, proposals });
      }
    }

    load().catch(() => {
      if (mounted) setState({ kind: "error", message: "Something went wrong loading your portal." });
    });

    return () => {
      mounted = false;
    };
  }, [refreshKey]);

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

  const { client, projects, tasks, proposals } = state;

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
        {proposals.length > 0 && (
          <div className="space-y-6">
            {proposals.map((p) => (
              <ProposalCard key={p.id} proposal={p} onUpdated={refetchProposals} />
            ))}
          </div>
        )}

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

function ProposalCard({
  proposal,
  onUpdated,
}: {
  proposal: ProposalWithDocument;
  onUpdated: () => void;
}) {
  const doc = proposal.generated_documents;
  const [template, setTemplate] = useState<DocumentTemplate | null>(null);
  const [selections, setSelections] = useState<Selections>(doc?.field_values.selections || {});
  const [installments, setInstallments] = useState<PaymentInstallment[]>([]);
  const [saving, setSaving] = useState<"save" | "accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!doc) return;
    setSelections(doc.field_values.selections || {});
    supabase
      .from("document_templates")
      .select("*")
      .eq("id", doc.template_id)
      .single()
      .then(({ data }) => setTemplate(data as DocumentTemplate | null));
  }, [doc?.id, doc?.template_id]);

  useEffect(() => {
    if (proposal.status !== "accepted") {
      setInstallments([]);
      return;
    }
    fetchPaymentScheduleForProposal(proposal.id).then((result) => {
      setInstallments(result?.installments || []);
    });
  }, [proposal.id, proposal.status]);

  if (!doc || !template) {
    return (
      <div className="rounded-2xl bg-white border shadow-sm p-6 text-neutral-400 text-sm">
        Loading your proposal…
      </div>
    );
  }

  const locked = proposal.status === "accepted" || proposal.status === "declined";
  const designBrief = getDesignBriefSection(template.structure);
  const authored = (doc.field_values.authored || {}) as Record<string, unknown>;
  const totals = computeDocumentTotals(template.structure, selections);

  function updateSelection(itemKey: string, raw: { included?: boolean; quantity?: number }) {
    const section = getLineItemSections(template!.structure).find((s) =>
      s.items.some((i) => i.key === itemKey)
    );
    const item = section?.items.find((i) => i.key === itemKey);
    if (!item) return;
    const merged = { ...selections[itemKey], ...raw };
    const { included, quantity } = clampSelection(item, merged);
    setSelections((prev) => ({ ...prev, [itemKey]: { included, quantity } }));
  }

  async function handleAction(action: "save" | "accept" | "decline") {
    setSaving(action);
    setError(null);
    setSavedMessage(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setError("Your session expired — please refresh the page.");
      setSaving(null);
      return;
    }
    try {
      const res = await fetch("/api/submit-proposal-selections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ generated_document_id: doc.id, action, selections }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong — please try again.");
        return;
      }
      if (action === "save") setSavedMessage("Your changes have been saved.");
      onUpdated();
    } catch {
      setError("Something went wrong — please try again.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="rounded-2xl bg-white border shadow-sm p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your Floral Proposal</h2>
        <span
          className="text-xs px-3 py-1 rounded-full font-medium text-white"
          style={{ backgroundColor: BRAND.ember }}
        >
          {PROPOSAL_STATUS_LABELS[proposal.status] || proposal.status}
        </span>
      </div>

      {designBrief && (
        <div className="space-y-3 border-b pb-6">
          <p className="text-sm font-semibold text-neutral-700">{designBrief.title}</p>
          {designBrief.fields
            .filter((f) => f.kind !== "image_list")
            .map((field) => {
              const value = authored[field.key];
              if (value === undefined || value === null || value === "") return null;
              const display = Array.isArray(value) ? value.join(", ") : String(value);
              return (
                <div key={field.key}>
                  <p className="text-xs uppercase tracking-wide text-neutral-400">{field.label}</p>
                  <p className="text-sm text-neutral-700 whitespace-pre-wrap">{display}</p>
                </div>
              );
            })}
        </div>
      )}

      <div className="space-y-5">
        {getLineItemSections(template.structure).map((section) => (
          <div key={section.key}>
            <p className="text-sm font-semibold text-neutral-700 mb-1">{section.name}</p>
            {section.description && (
              <p className="text-xs text-neutral-400 mb-2">{section.description}</p>
            )}
            <div className="space-y-2">
              {section.items.map((item) => {
                const { included, quantity } = clampSelection(item, selections[item.key]);
                const lineTotal = included ? item.unit_price * quantity : 0;
                return (
                  <div
                    key={item.key}
                    className="flex items-start justify-between gap-4 rounded-xl border p-3 bg-neutral-50"
                  >
                    <div className="flex items-start gap-3 flex-1">
                      {item.is_optional && !locked && (
                        <input
                          type="checkbox"
                          checked={included}
                          onChange={(e) => updateSelection(item.key, { included: e.target.checked })}
                          className="mt-1"
                        />
                      )}
                      <div>
                        <p className="text-sm font-medium text-neutral-700">{item.name}</p>
                        {item.description && (
                          <p className="text-xs text-neutral-400">{item.description}</p>
                        )}
                        {item.is_optional && included && !locked && item.default_quantity > 1 && (
                          <div className="flex items-center gap-2 mt-2">
                            <label className="text-xs text-neutral-400">Qty</label>
                            <input
                              type="number"
                              min={0}
                              max={item.default_quantity}
                              value={quantity}
                              onChange={(e) =>
                                updateSelection(item.key, { quantity: Number(e.target.value) })
                              }
                              className="w-16 rounded-lg border px-2 py-1 text-xs"
                            />
                            <span className="text-xs text-neutral-400">of {item.default_quantity} max</span>
                          </div>
                        )}
                        {(!item.is_optional || locked) && (
                          <p className="text-xs text-neutral-400 mt-1">Qty: {quantity}</p>
                        )}
                      </div>
                    </div>
                    <p className="text-sm font-medium text-neutral-700 whitespace-nowrap">
                      ${lineTotal.toLocaleString()}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        <span className="text-sm font-medium text-neutral-700">Estimated Total</span>
        <span className="text-2xl font-semibold" style={{ color: BRAND.forestGreen }}>
          ${totals.grand_total.toLocaleString()}
        </span>
      </div>

      {proposal.status === "accepted" && (
        <div className="border-t pt-4 space-y-4">
          <div>
            <p className="text-sm font-semibold text-neutral-700 mb-2">Your Agreement</p>
            <div className="flex items-center justify-between rounded-xl border border-dashed border-neutral-300 p-3 bg-neutral-50">
              <div>
                <p className="text-sm text-neutral-600">Signature status: Not sent yet</p>
                <p className="text-xs text-neutral-400 mt-0.5">We'll email you when it's ready to review and sign.</p>
              </div>
              <button
                disabled
                title="Coming soon"
                className="rounded-full border px-3 py-1.5 text-xs font-medium text-neutral-400 border-neutral-200 cursor-not-allowed whitespace-nowrap"
              >
                Review & Sign
              </button>
            </div>
          </div>

          {installments.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-neutral-700 mb-2">Payment Schedule</p>
              <div className="space-y-2">
                {installments.map((inst) => (
                  <div
                    key={inst.id}
                    className="flex items-center justify-between rounded-xl border p-3 bg-neutral-50"
                  >
                    <p className="text-sm text-neutral-700">
                      ${inst.amount.toLocaleString()}{" "}
                      <span className="text-xs text-neutral-400">
                        due {inst.due_date ? new Date(inst.due_date + "T00:00:00").toLocaleDateString() : "—"}
                      </span>
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-neutral-200 text-neutral-600 capitalize">
                        {inst.status}
                      </span>
                      <button
                        disabled
                        title="Online payments coming soon"
                        className="rounded-full border px-3 py-1.5 text-xs font-medium text-neutral-400 border-neutral-200 cursor-not-allowed whitespace-nowrap"
                      >
                        Pay Now
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-neutral-400 mt-2">Online payments are coming soon — we'll follow up with instructions in the meantime.</p>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {savedMessage && <p className="text-sm text-green-600">{savedMessage}</p>}

      {!locked && (
        <div className="flex flex-wrap gap-3 border-t pt-4">
          <button
            onClick={() => handleAction("save")}
            disabled={saving !== null}
            className="rounded-full border px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 transition-colors"
          >
            {saving === "save" ? "Saving…" : "Save Changes"}
          </button>
          <button
            onClick={() => handleAction("accept")}
            disabled={saving !== null}
            className="rounded-full px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            style={{ backgroundColor: BRAND.forestGreen }}
          >
            {saving === "accept" ? "Booking…" : "Accept & Book"}
          </button>
          <button
            onClick={() => handleAction("decline")}
            disabled={saving !== null}
            className="rounded-full px-4 py-2 text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            {saving === "decline" ? "Submitting…" : "Decline"}
          </button>
        </div>
      )}
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
