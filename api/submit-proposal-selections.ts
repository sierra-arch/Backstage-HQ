// submit-proposal-selections.ts
//
// Client-portal endpoint for saving/accepting/declining a proposal. This is
// the ONLY way a client's browser can ever change a generated_documents row
// or create payment_installments — there is no RLS write policy granting
// clients direct table access, by design (see migration 0007). This
// endpoint is the trust boundary:
//   - verifies the caller's session maps to a real client_users row
//   - confirms the target document actually belongs to THAT client
//   - re-validates every submitted selection against the authored template
//     bounds (never trusts client-sent prices or quantities above default)
//   - never touches field_values.authored, under any action or payload
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getRequestClientUser, getAdminClient, UnauthorizedError } from "./_lib/supabaseServer";
import {
  computeDocumentTotals,
  validateSelections,
  getPaymentRules,
  buildInstallments,
  type TemplateSection,
  type Selections,
} from "./_lib/proposalEngine";

interface FieldValues {
  authored: Record<string, unknown>;
  selections: Selections;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let clientId: string;
  try {
    ({ clientId } = await getRequestClientUser(req.headers.authorization));
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      res.status(401).json({ error: err.message });
      return;
    }
    console.error("Auth error in submit-proposal-selections:", err);
    res.status(500).json({ error: "Something went wrong verifying your session" });
    return;
  }

  const body = req.body || {};
  const { generated_document_id, action, selections: rawSelections } = body as {
    generated_document_id?: string;
    action?: "save" | "accept" | "decline";
    selections?: unknown;
  };

  if (!generated_document_id || typeof generated_document_id !== "string") {
    res.status(400).json({ error: "generated_document_id is required" });
    return;
  }
  if (action !== "save" && action !== "accept" && action !== "decline") {
    res.status(400).json({ error: "action must be one of: save, accept, decline" });
    return;
  }

  const admin = getAdminClient();

  const { data: doc, error: docError } = await admin
    .from("generated_documents")
    .select("id, template_id, client_id, field_values, status, edit_locked_at")
    .eq("id", generated_document_id)
    .maybeSingle();

  if (docError || !doc) {
    res.status(404).json({ error: "Proposal not found" });
    return;
  }

  // The core authorization check: this document must belong to the exact
  // client the verified session resolved to. No exceptions, regardless of
  // what the request body claims.
  if (doc.client_id !== clientId) {
    res.status(403).json({ error: "You don't have access to this proposal" });
    return;
  }

  if (doc.edit_locked_at) {
    res.status(409).json({ error: "This proposal has already been finalized and can no longer be changed" });
    return;
  }

  const { data: template, error: templateError } = await admin
    .from("document_templates")
    .select("structure")
    .eq("id", doc.template_id)
    .single();

  if (templateError || !template) {
    res.status(500).json({ error: "Could not load the proposal template" });
    return;
  }

  const structure = template.structure as TemplateSection[];
  const fieldValues = (doc.field_values ?? { authored: {}, selections: {} }) as FieldValues;

  const validation = validateSelections(structure, rawSelections ?? fieldValues.selections);
  if (!validation.ok) {
    res.status(400).json({ error: validation.error });
    return;
  }
  const safeSelections = validation.selections;

  // field_values.authored is never read from the request body — it is
  // carried forward untouched from whatever the team last set it to.
  const nextFieldValues: FieldValues = {
    authored: fieldValues.authored ?? {},
    selections: safeSelections,
  };

  if (action === "save") {
    // "viewed" marks that the client has actively engaged with (and
    // possibly adjusted) their proposal — distinct from "sent", which the
    // team sets when they first share it.
    const { error: updateError } = await admin
      .from("generated_documents")
      .update({ field_values: nextFieldValues, status: "viewed" })
      .eq("id", doc.id);

    if (updateError) {
      console.error("Error saving proposal selections:", updateError);
      res.status(500).json({ error: "Failed to save your selections" });
      return;
    }

    const totals = computeDocumentTotals(structure, safeSelections);
    res.status(200).json({ ok: true, grand_total: totals.grand_total });
    return;
  }

  if (action === "decline") {
    // generated_documents' status enum has no "declined" value (it tracks
    // draft/sent/viewed/finalized) — "declined" is a property of the
    // proposal itself, so it lives on the proposals row. We still persist
    // the client's final selections for the record, but leave the document
    // unlocked/status untouched in case the team wants to revive it.
    const { error: updateError } = await admin
      .from("generated_documents")
      .update({ field_values: nextFieldValues })
      .eq("id", doc.id);

    if (updateError) {
      console.error("Error declining proposal:", updateError);
      res.status(500).json({ error: "Failed to decline the proposal" });
      return;
    }

    await admin.from("proposals").update({ status: "declined" }).eq("generated_document_id", doc.id);

    res.status(200).json({ ok: true });
    return;
  }

  // action === "accept" — the only path that creates money-moving records.
  const { data: proposal, error: proposalError } = await admin
    .from("proposals")
    .select("id, event_date")
    .eq("generated_document_id", doc.id)
    .maybeSingle();

  if (proposalError || !proposal) {
    res.status(500).json({ error: "Could not find the linked proposal record" });
    return;
  }
  if (!proposal.event_date) {
    res.status(400).json({ error: "This proposal has no event date set yet — contact your florist before accepting" });
    return;
  }

  const totals = computeDocumentTotals(structure, safeSelections);
  const rules = getPaymentRules(structure);
  if (rules.length === 0) {
    res.status(500).json({ error: "This proposal template has no payment schedule configured" });
    return;
  }
  if (totals.grand_total <= 0) {
    res.status(400).json({ error: "Your selected total must be greater than $0" });
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const installments = buildInstallments(rules, totals.grand_total, proposal.event_date, today);

  const { data: schedule, error: scheduleError } = await admin
    .from("payment_schedules")
    .insert({ proposal_id: proposal.id, client_id: clientId, total_amount: totals.grand_total })
    .select("id")
    .single();

  if (scheduleError || !schedule) {
    console.error("Error creating payment schedule:", scheduleError);
    res.status(500).json({ error: "Failed to set up the payment schedule" });
    return;
  }

  const { error: installmentsError } = await admin.from("payment_installments").insert(
    installments.map((inst) => ({
      payment_schedule_id: schedule.id,
      sequence_number: inst.sequence_number,
      amount: inst.amount,
      due_rule_type: inst.due_rule_type,
      due_rule_offset_days: inst.due_rule_offset_days,
      due_date: inst.due_date,
      status: "pending",
    }))
  );

  if (installmentsError) {
    console.error("Error creating payment installments:", installmentsError);
    // Roll back the orphaned schedule rather than leaving a schedule with
    // no installments sitting around.
    await admin.from("payment_schedules").delete().eq("id", schedule.id);
    res.status(500).json({ error: "Failed to set up the payment schedule" });
    return;
  }

  const { error: acceptError } = await admin
    .from("generated_documents")
    .update({ field_values: nextFieldValues, status: "finalized", edit_locked_at: new Date().toISOString() })
    .eq("id", doc.id);

  if (acceptError) {
    console.error("Error finalizing accepted proposal:", acceptError);
    res.status(500).json({ error: "Payment schedule was created, but finalizing the proposal failed — contact support" });
    return;
  }

  await admin.from("proposals").update({ status: "accepted" }).eq("id", proposal.id);

  res.status(200).json({ ok: true, grand_total: totals.grand_total, installments });
}
