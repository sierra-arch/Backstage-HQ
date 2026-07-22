// send-broadcast.ts
//
// Team-only endpoint: sends a drafted broadcast to a segment (all clients /
// active clients / leads) immediately via Resend. One email per recipient
// (not a single multi-recipient send), so recipients never see each other's
// addresses.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getRequestUser, UnauthorizedError } from "./_lib/supabaseServer";
import { getResendClient, getFromAddress } from "./_lib/resend";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let supabase;
  try {
    ({ supabase } = await getRequestUser(req.headers.authorization));
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    console.error("Auth error in send-broadcast:", err);
    res.status(500).json({ error: "Something went wrong" });
    return;
  }

  const { broadcast_id } = (req.body || {}) as { broadcast_id?: string };
  if (!broadcast_id || typeof broadcast_id !== "string") {
    res.status(400).json({ error: "broadcast_id is required" });
    return;
  }

  // Uses the caller's own team-scoped session (team_full_access RLS), so
  // this can only ever act on a broadcast the caller's company can see.
  const { data: broadcast, error: broadcastError } = await supabase
    .from("email_broadcasts")
    .select("id, company_id, subject, body, recipient_filter, status")
    .eq("id", broadcast_id)
    .maybeSingle();

  if (broadcastError || !broadcast) {
    res.status(404).json({ error: "Broadcast not found" });
    return;
  }
  if (broadcast.status === "sent") {
    res.status(409).json({ error: "This broadcast has already been sent" });
    return;
  }

  let recipients: string[] = [];
  if (broadcast.recipient_filter === "leads") {
    const { data } = await supabase.from("leads").select("email").eq("company_id", broadcast.company_id).not("email", "is", null);
    recipients = (data || []).map((r) => r.email).filter(Boolean);
  } else {
    let query = supabase.from("clients").select("contact_email").eq("company_id", broadcast.company_id).not("contact_email", "is", null);
    if (broadcast.recipient_filter === "active_clients") query = query.eq("stage", "active");
    const { data } = await query;
    recipients = (data || []).map((r) => r.contact_email).filter(Boolean);
  }

  recipients = [...new Set(recipients)];

  if (recipients.length === 0) {
    res.status(400).json({ error: "No recipients match this segment" });
    return;
  }

  let resend;
  try {
    resend = getResendClient();
  } catch {
    res.status(500).json({ error: "Email sending is not configured yet" });
    return;
  }

  const results = await Promise.allSettled(
    recipients.map((to) =>
      resend.emails.send({ from: getFromAddress(), to, subject: broadcast.subject, html: broadcast.body })
    )
  );
  const sentCount = results.filter((r) => r.status === "fulfilled").length;

  await supabase
    .from("email_broadcasts")
    .update({ status: "sent", sent_at: new Date().toISOString(), sent_count: sentCount })
    .eq("id", broadcast_id);

  res.status(200).json({ ok: true, sent_count: sentCount, attempted: recipients.length });
}
