// respond.ts
//
// Client-portal endpoint for the two "client responds to something"
// actions: e-signing an agreement (sign-agreement.ts) and approving /
// requesting changes on a deliverable (respond-deliverable.ts). Merged into
// one file to stay under Vercel Hobby's 12-serverless-function-per-
// deployment cap (was 14, hit a hard deploy failure at exactly that
// boundary). Same trust-boundary shape as this file's siblings -- the
// client's browser has no direct write policy on either `agreements` or
// `deliverables`, only this endpoint can write to them.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getRequestClientUser, getAdminClient, UnauthorizedError } from "./_lib/supabaseServer";
import { runTrigger } from "./_lib/automationRuntime";

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
    console.error("Auth error in respond:", err);
    res.status(500).json({ error: "Something went wrong verifying your session" });
    return;
  }

  const body = (req.body || {}) as {
    type?: "agreement" | "deliverable";
    agreement_id?: string;
    signed_name?: string;
    deliverable_id?: string;
    action?: "approve" | "request_changes";
    revision_note?: string;
  };

  const admin = getAdminClient();

  if (body.type === "agreement") {
    const { agreement_id, signed_name } = body;
    if (!agreement_id || typeof agreement_id !== "string") {
      res.status(400).json({ error: "agreement_id is required" });
      return;
    }
    const trimmedName = typeof signed_name === "string" ? signed_name.trim() : "";
    if (!trimmedName) {
      res.status(400).json({ error: "Please type your full name to sign" });
      return;
    }

    const { data: agreement, error: agreementError } = await admin
      .from("agreements")
      .select("id, client_id, status")
      .eq("id", agreement_id)
      .maybeSingle();

    if (agreementError || !agreement) {
      res.status(404).json({ error: "Agreement not found" });
      return;
    }
    if (agreement.client_id !== clientId) {
      res.status(403).json({ error: "You don't have access to this agreement" });
      return;
    }
    if (agreement.status === "signed") {
      res.status(409).json({ error: "This agreement has already been signed" });
      return;
    }
    if (agreement.status === "voided") {
      res.status(409).json({ error: "This agreement is no longer active" });
      return;
    }

    const forwardedFor = req.headers["x-forwarded-for"];
    const ip = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(",")[0]?.trim() || req.socket?.remoteAddress || null;

    const { error: updateError } = await admin
      .from("agreements")
      .update({ status: "signed", signed_at: new Date().toISOString(), signed_name: trimmedName, signed_ip: ip })
      .eq("id", agreement_id);

    if (updateError) {
      console.error("Error signing agreement:", updateError);
      res.status(500).json({ error: "Failed to record your signature — please try again" });
      return;
    }

    res.status(200).json({ ok: true });
    return;
  }

  if (body.type === "deliverable") {
    const { deliverable_id, action, revision_note } = body;
    if (!deliverable_id || typeof deliverable_id !== "string") {
      res.status(400).json({ error: "deliverable_id is required" });
      return;
    }
    if (action !== "approve" && action !== "request_changes") {
      res.status(400).json({ error: "action must be approve or request_changes" });
      return;
    }
    const trimmedNote = typeof revision_note === "string" ? revision_note.trim() : "";
    if (action === "request_changes" && !trimmedNote) {
      res.status(400).json({ error: "Please describe what you'd like changed" });
      return;
    }

    const { data: deliverable, error: deliverableError } = await admin
      .from("deliverables")
      .select("id, title, status, client_visible, project_id, projects(client_id, company_id, clients(name))")
      .eq("id", deliverable_id)
      .maybeSingle();

    if (deliverableError || !deliverable) {
      res.status(404).json({ error: "Deliverable not found" });
      return;
    }

    const ownerClientId = (deliverable as any).projects?.client_id;
    if (ownerClientId !== clientId || !deliverable.client_visible) {
      res.status(403).json({ error: "You don't have access to this deliverable" });
      return;
    }
    if (deliverable.status !== "delivered") {
      res.status(409).json({ error: "This item isn't ready for a response yet" });
      return;
    }

    const update =
      action === "approve"
        ? { status: "approved", approved_at: new Date().toISOString(), revision_note: null }
        : { status: "revision_requested", revision_note: trimmedNote };

    const { error: updateError } = await admin.from("deliverables").update(update).eq("id", deliverable_id);

    if (updateError) {
      console.error("Error responding to deliverable:", updateError);
      res.status(500).json({ error: "Failed to save your response — please try again" });
      return;
    }

    // Automation: deliverable approved -> notify the team, through the
    // Automation Web runtime (migration 0028) instead of a hardcoded
    // insert -- which node(s) actually run is data, not this call site.
    // Best-effort: the client's response has already saved successfully,
    // so a notification failure must not roll it back or surface as an
    // error.
    if (action === "approve") {
      try {
        const projectData = (deliverable as any).projects;
        const companyId = projectData?.company_id;
        const clientName = projectData?.clients?.name ?? "A client";
        if (companyId) {
          await runTrigger(admin, companyId, "deliverable_approved", {
            companyId,
            message: `${clientName} approved "${deliverable.title}"`,
          });
        }
      } catch (notifyError) {
        console.error("Deliverable-approved notification failed (non-fatal):", notifyError);
      }
    }

    res.status(200).json({ ok: true });
    return;
  }

  res.status(400).json({ error: "type must be agreement or deliverable" });
}
