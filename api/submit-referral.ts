// submit-referral.ts
//
// Client-portal endpoint: a completed client refers a friend. Lands in the
// same `leads` table the public inquiry form and CRM pipeline use (source
// 'referral'), rather than a separate referrals system -- one CRM entry
// point, not two.
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
    console.error("Auth error in submit-referral:", err);
    res.status(500).json({ error: "Something went wrong verifying your session" });
    return;
  }

  const { referred_name, referred_email } = (req.body || {}) as {
    referred_name?: string;
    referred_email?: string;
  };
  const trimmedName = typeof referred_name === "string" ? referred_name.trim() : "";
  const trimmedEmail = typeof referred_email === "string" ? referred_email.trim() : "";
  if (!trimmedName) {
    res.status(400).json({ error: "Please enter your friend's name" });
    return;
  }

  const admin = getAdminClient();

  const { data: client, error: clientError } = await admin
    .from("clients")
    .select("company_id, name")
    .eq("id", clientId)
    .maybeSingle();

  if (clientError || !client?.company_id) {
    res.status(500).json({ error: "Could not resolve your account" });
    return;
  }

  const { error: insertError } = await admin.from("leads").insert({
    company_id: client.company_id,
    name: trimmedName.slice(0, 200),
    email: trimmedEmail ? trimmedEmail.slice(0, 200) : null,
    source: "referral",
    message: `Referred by ${client.name}`,
    status: "new",
  });

  if (insertError) {
    console.error("Error saving referral:", insertError);
    res.status(500).json({ error: "Failed to save the referral — please try again" });
    return;
  }

  res.status(200).json({ ok: true });
}
