import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { getRequestUser, UnauthorizedError } from "./_lib/supabaseServer.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let requestUser;
  try {
    requestUser = await getRequestUser(req.headers.authorization);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    console.error("Auth error in /api/invite-client:", err);
    res.status(500).json({ error: "Something went wrong" });
    return;
  }

  if (!requestUser.isTeamMember) {
    res.status(403).json({ error: "Only team members can send portal invites" });
    return;
  }

  const clientId = req.body?.client_id;
  if (!clientId || typeof clientId !== "string") {
    res.status(400).json({ error: "client_id is required" });
    return;
  }

  const { supabase } = requestUser;

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, name, contact_email")
    .eq("id", clientId)
    .single();

  if (clientError || !client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  if (!client.contact_email) {
    res.status(400).json({ error: "This client has no contact email on file" });
    return;
  }

  const { data: existing } = await supabase
    .from("client_users")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle();

  if (existing) {
    res.status(409).json({ error: `${client.name} has already been invited to the portal` });
    return;
  }

  const url = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const siteUrl = process.env.VITE_SITE_URL;
  if (!url || !serviceRoleKey || !siteUrl) {
    console.error("Missing VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or VITE_SITE_URL");
    res.status(500).json({ error: "Invite is not configured" });
    return;
  }

  const admin = createClient(url, serviceRoleKey);

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    client.contact_email,
    { redirectTo: `${siteUrl}/portal` }
  );

  if (inviteError || !invited?.user) {
    console.error("Error inviting client:", inviteError);
    res.status(500).json({ error: inviteError?.message ?? "Failed to send invite" });
    return;
  }

  const { error: linkError } = await admin.from("client_users").insert({
    id: invited.user.id,
    client_id: clientId,
    email: client.contact_email,
  });

  if (linkError) {
    console.error("Error linking client_users:", linkError);
    res.status(500).json({ error: "Invite sent, but failed to link the account — contact support" });
    return;
  }

  res.status(200).json({ ok: true, email: client.contact_email });
}
