// respond-deliverable.ts
//
// Client-portal endpoint: approve or request changes on a delivered item.
// Same trust-boundary shape as the rest of this file's siblings -- the
// client's browser has no direct write policy on `deliverables`.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getRequestClientUser, getAdminClient, UnauthorizedError } from "./_lib/supabaseServer";

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
    console.error("Auth error in respond-deliverable:", err);
    res.status(500).json({ error: "Something went wrong verifying your session" });
    return;
  }

  const { deliverable_id, action, revision_note } = (req.body || {}) as {
    deliverable_id?: string;
    action?: "approve" | "request_changes";
    revision_note?: string;
  };

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

  const admin = getAdminClient();

  const { data: deliverable, error: deliverableError } = await admin
    .from("deliverables")
    .select("id, status, client_visible, project_id, projects(client_id)")
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

  res.status(200).json({ ok: true });
}
