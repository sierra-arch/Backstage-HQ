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
  type Deliverable,
} from "./useDatabase";
import {
  computeDocumentTotals,
  getDesignBriefSection,
  getLineItemSections,
  clampSelection,
  type Selections,
} from "../api/_lib/proposalEngine";

const BRAND = {
  forestGreen: "#123D2C",
  ember: "#EA580C",
  cream: "#F3F7F1",
  sagePill: "#DCEEDA",
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
  company_id: string | null;
  onboarding_completed_at: string | null;
}

interface OnboardingQuestion {
  key: string;
  label: string;
  kind: string;
}

interface PortalTask {
  id: string;
  project_id: string;
  title: string;
  status: string;
  due_date: string | null;
}

interface PortalAgreement {
  id: string;
  status: "sent" | "signed" | "voided";
  signed_at: string | null;
  signed_name: string | null;
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
      deliverables: Deliverable[];
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
        .select("id, name, status, target_delivery_date, company_id, onboarding_completed_at")
        .eq("client_id", mapping.client_id)
        .order("created_at", { ascending: false });

      const projectIds = (projects ?? []).map((p) => p.id);
      let tasks: PortalTask[] = [];
      let deliverables: Deliverable[] = [];
      if (projectIds.length > 0) {
        const { data: taskRows } = await supabase
          .from("tasks")
          .select("id, project_id, title, status, due_date")
          .in("project_id", projectIds)
          .order("due_date", { ascending: true });
        tasks = taskRows ?? [];

        const { data: deliverableRows } = await supabase
          .from("deliverables")
          .select("*")
          .in("project_id", projectIds)
          .order("sort_order", { ascending: true });
        deliverables = deliverableRows ?? [];
      }

      const proposals = await fetchProposalsForClient(mapping.client_id).catch(() => []);

      if (mounted) {
        setState({ kind: "ready", client, projects: projects ?? [], tasks, proposals, deliverables });
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
    return <ClientLoginForm />;
  }

  if (state.kind === "not_authorized") {
    return (
      <CenteredMessage>
        This account isn't authorized to view a client portal.
        <br />
        <button
          onClick={() => supabase.auth.signOut()}
          className="mt-4 text-sm underline"
          style={{ color: BRAND.forestGreen }}
        >
          Sign out and try a different email
        </button>
      </CenteredMessage>
    );
  }

  if (state.kind === "error") {
    return <CenteredMessage>{state.message}</CenteredMessage>;
  }

  const { client, projects, tasks, proposals, deliverables } = state;

  return (
    <div className="min-h-screen" style={{ backgroundColor: BRAND.cream }}>
      <section
        className="px-6 py-16 md:px-16 text-white rounded-b-[2.5rem]"
        style={{ backgroundColor: BRAND.forestGreen }}
      >
        <h1 className="text-3xl md:text-4xl font-semibold text-white">Welcome back, {client.name}</h1>
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
          <div className="rounded-3xl bg-white border border-neutral-200/70 p-6 text-neutral-500">
            No active project yet — check back soon.
          </div>
        ) : (
          projects.map((project) => (
            <div key={project.id} className="rounded-3xl bg-white border border-neutral-200/70 shadow-sm p-6">
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

              {!project.onboarding_completed_at && (
                <div className="mb-4">
                  <OnboardingForm project={project} onSubmitted={refetchProposals} />
                </div>
              )}

              {deliverables.filter((d) => d.project_id === project.id).length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-semibold text-neutral-700 mb-2">Deliverables</p>
                  <div className="space-y-2">
                    {deliverables
                      .filter((d) => d.project_id === project.id)
                      .map((d) => (
                        <DeliverableRow key={d.id} deliverable={d} onResponded={refetchProposals} />
                      ))}
                  </div>
                </div>
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
                    className="flex items-center justify-between rounded-2xl border border-neutral-200/70 p-3 bg-neutral-50"
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
  const [agreement, setAgreement] = useState<PortalAgreement | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [saving, setSaving] = useState<"save" | "accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const refetchAgreement = () => {
    supabase
      .from("agreements")
      .select("id, status, signed_at, signed_name")
      .eq("proposal_id", proposal.id)
      .maybeSingle()
      .then(({ data }) => setAgreement(data as PortalAgreement | null));
  };

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
      setAgreement(null);
      return;
    }
    fetchPaymentScheduleForProposal(proposal.id).then((result) => {
      setInstallments(result?.installments || []);
    });
    refetchAgreement();
  }, [proposal.id, proposal.status]);

  async function handlePayNow(installmentId: string) {
    setPayingId(installmentId);
    setError(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setError("Your session expired — please refresh the page.");
      setPayingId(null);
      return;
    }
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ installment_id: installmentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setError(data.error || "Something went wrong starting your payment.");
        setPayingId(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Something went wrong starting your payment.");
      setPayingId(null);
    }
  }

  if (!doc || !template) {
    return (
      <div className="rounded-3xl bg-white border border-neutral-200/70 shadow-sm p-6 text-neutral-400 text-sm">
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
    <div className="rounded-3xl bg-white border border-neutral-200/70 shadow-sm p-6 space-y-6">
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
                    className="flex items-start justify-between gap-4 rounded-2xl border border-neutral-200/70 p-3 bg-neutral-50"
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
            {agreement ? (
              <AgreementCard agreement={agreement} onSigned={refetchAgreement} />
            ) : (
              <div className="rounded-2xl border border-dashed border-neutral-300 p-3 bg-neutral-50 text-sm text-neutral-500">
                Loading your agreement…
              </div>
            )}
          </div>

          {installments.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-neutral-700 mb-2">Payment Schedule</p>
              <div className="space-y-2">
                {installments.map((inst) => (
                  <div
                    key={inst.id}
                    className="flex items-center justify-between rounded-2xl border border-neutral-200/70 p-3 bg-neutral-50"
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
                      {inst.status === "paid" ? (
                        <span className="text-xs text-green-700 font-medium">Paid</span>
                      ) : (
                        <button
                          onClick={() => handlePayNow(inst.id)}
                          disabled={payingId !== null}
                          className="rounded-full px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
                          style={{ backgroundColor: BRAND.forestGreen }}
                        >
                          {payingId === inst.id ? "Redirecting…" : "Pay Now"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
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

const DELIVERABLE_STATUS_LABELS: Record<string, string> = {
  pending: "In progress",
  delivered: "Ready for your review",
  approved: "Approved",
  revision_requested: "Changes requested",
};

function DeliverableRow({ deliverable, onResponded }: { deliverable: Deliverable; onResponded: () => void }) {
  const [requestingChanges, setRequestingChanges] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState<"approve" | "request" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function respond(action: "approve" | "request_changes") {
    setSaving(action === "approve" ? "approve" : "request");
    setError(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setError("Your session expired — please refresh the page.");
      setSaving(null);
      return;
    }
    try {
      const res = await fetch("/api/respond-deliverable", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ deliverable_id: deliverable.id, action, revision_note: note.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong — please try again.");
        setSaving(null);
        return;
      }
      onResponded();
    } catch {
      setError("Something went wrong — please try again.");
      setSaving(null);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200/70 p-3 bg-neutral-50 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-neutral-700">{deliverable.title}</p>
          {deliverable.description && <p className="text-xs text-neutral-400 mt-0.5">{deliverable.description}</p>}
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-neutral-200 text-neutral-600 whitespace-nowrap">
          {DELIVERABLE_STATUS_LABELS[deliverable.status] || deliverable.status}
        </span>
      </div>

      {deliverable.status === "delivered" && !requestingChanges && (
        <div className="flex gap-2">
          <button
            onClick={() => respond("approve")}
            disabled={saving !== null}
            className="rounded-full px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            style={{ backgroundColor: BRAND.forestGreen }}
          >
            {saving === "approve" ? "Approving…" : "Approve"}
          </button>
          <button
            onClick={() => setRequestingChanges(true)}
            disabled={saving !== null}
            className="rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-neutral-100 disabled:opacity-50 transition-colors"
          >
            Request Changes
          </button>
        </div>
      )}

      {deliverable.status === "delivered" && requestingChanges && (
        <div className="space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What would you like changed?"
            rows={2}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs focus:outline-none bg-white"
          />
          <div className="flex gap-2">
            <button
              onClick={() => respond("request_changes")}
              disabled={saving !== null || !note.trim()}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: BRAND.ember }}
            >
              {saving === "request" ? "Sending…" : "Send Request"}
            </button>
            <button
              onClick={() => setRequestingChanges(false)}
              className="rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-neutral-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function OnboardingForm({ project, onSubmitted }: { project: PortalProject; onSubmitted: () => void }) {
  const [questions, setQuestions] = useState<OnboardingQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!project.company_id) {
      setQuestions([]);
      return;
    }
    supabase
      .from("document_templates")
      .select("structure")
      .eq("company_id", project.company_id)
      .eq("type", "onboarding")
      .eq("is_default", true)
      .maybeSingle()
      .then(({ data }) => setQuestions(data?.structure?.questions ?? []));
  }, [project.company_id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setError("Your session expired — please refresh the page.");
      setSubmitting(false);
      return;
    }
    try {
      const res = await fetch("/api/submit-onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ project_id: project.id, responses: answers }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong — please try again.");
        setSubmitting(false);
        return;
      }
      onSubmitted();
    } catch {
      setError("Something went wrong — please try again.");
      setSubmitting(false);
    }
  }

  if (questions === null) {
    return null;
  }
  if (questions.length === 0) {
    return null;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border p-4 space-y-4"
      style={{ borderColor: BRAND.forestGreen, backgroundColor: BRAND.sagePill }}
    >
      <div>
        <p className="text-sm font-semibold" style={{ color: BRAND.forestGreen }}>
          A few details to get started
        </p>
        <p className="text-xs text-neutral-600 mt-0.5">
          Fill this out whenever you're ready — it helps us plan your project.
        </p>
      </div>
      {questions.map((q) => (
        <div key={q.key}>
          <label className="text-xs font-medium text-neutral-700 block mb-1">{q.label}</label>
          {q.kind === "textarea" ? (
            <textarea
              value={answers[q.key] || ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
              rows={2}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none bg-white"
            />
          ) : (
            <input
              type="text"
              value={answers[q.key] || ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none bg-white"
            />
          )}
        </div>
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-full px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        style={{ backgroundColor: BRAND.forestGreen }}
      >
        {submitting ? "Submitting…" : "Submit"}
      </button>
    </form>
  );
}

function AgreementCard({ agreement, onSigned }: { agreement: PortalAgreement; onSigned: () => void }) {
  const [name, setName] = useState("");
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (agreement.status === "signed") {
    return (
      <div className="rounded-2xl border border-neutral-200/70 p-3 bg-neutral-50">
        <p className="text-sm text-neutral-700">
          Signed by <span className="font-medium">{agreement.signed_name}</span>
        </p>
        <p className="text-xs text-neutral-400 mt-0.5">
          {agreement.signed_at ? new Date(agreement.signed_at).toLocaleString() : ""}
        </p>
      </div>
    );
  }

  async function handleSign(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || signing) return;
    setSigning(true);
    setError(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setError("Your session expired — please refresh the page.");
      setSigning(false);
      return;
    }
    try {
      const res = await fetch("/api/sign-agreement", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ agreement_id: agreement.id, signed_name: name.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong — please try again.");
        setSigning(false);
        return;
      }
      onSigned();
    } catch {
      setError("Something went wrong — please try again.");
      setSigning(false);
    }
  }

  return (
    <form
      onSubmit={handleSign}
      className="rounded-2xl border border-neutral-200/70 p-3 bg-neutral-50 space-y-2"
    >
      <p className="text-xs text-neutral-500">
        Type your full name below to sign and accept the terms of this agreement.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none"
        />
        <button
          type="submit"
          disabled={signing}
          className="rounded-full px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
          style={{ backgroundColor: BRAND.forestGreen }}
        >
          {signing ? "Signing…" : "Sign Agreement"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}

function ClientLoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || status === "sending") return;
    setStatus("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${import.meta.env.VITE_SITE_URL}/portal`,
        shouldCreateUser: false,
      },
    });
    // Only surface real failures (rate limits, outages). An email that isn't
    // registered for portal access still shows the same "sent" message, so
    // this form never reveals which emails have portal access.
    if (error && (error.status ?? 0) >= 500) {
      setStatus("error");
      setErrorMessage("Something went wrong sending your link. Please try again.");
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <CenteredMessage>
        If that email has portal access, a login link is on its way — check your inbox.
      </CenteredMessage>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: BRAND.cream }}>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-8 text-center"
      >
        <h1 className="text-xl font-semibold" style={{ color: BRAND.forestGreen }}>
          Client Portal
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          Enter your email and we'll send you a login link.
        </p>
        <input
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-6 w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none"
        />
        {status === "error" && <p className="mt-2 text-sm text-red-600">{errorMessage}</p>}
        <button
          type="submit"
          disabled={status === "sending"}
          className="mt-4 w-full rounded-xl py-3 text-sm font-medium text-white disabled:opacity-60"
          style={{ backgroundColor: BRAND.forestGreen }}
        >
          {status === "sending" ? "Sending…" : "Send login link"}
        </button>
      </form>
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
