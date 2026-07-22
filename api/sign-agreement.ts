// sign-agreement.ts
//
// Client-portal endpoint for e-signing an agreement. Lightweight signature
// capture (typed full name + server timestamp + IP), not a paid e-sign
// vendor -- per the Client Portal Expansion spec's vendor-cost reconciliation
// note. Same trust-boundary shape as submit-proposal-selections.ts: the
// client's browser never writes to `agreements` directly (no client RLS
// write policy exists for it), only this endpoint can.
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
    console.error("Auth error in sign-agreement:", err);
    res.status(500).json({ error: "Something went wrong verifying your session" });
    return;
  }

  const { agreement_id, signed_name } = (req.body || {}) as {
    agreement_id?: string;
    signed_name?: string;
  };

  if (!agreement_id || typeof agreement_id !== "string") {
    res.status(400).json({ error: "agreement_id is required" });
    return;
  }
  const trimmedName = typeof signed_name === "string" ? signed_name.trim() : "";
  if (!trimmedName) {
    res.status(400).json({ error: "Please type your full name to sign" });
    return;
  }

  const admin = getAdminClient();

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
    .update({
      status: "signed",
      signed_at: new Date().toISOString(),
      signed_name: trimmedName,
      signed_ip: ip,
    })
    .eq("id", agreement_id);

  if (updateError) {
    console.error("Error signing agreement:", updateError);
    res.status(500).json({ error: "Failed to record your signature — please try again" });
    return;
  }

  res.status(200).json({ ok: true });
}
