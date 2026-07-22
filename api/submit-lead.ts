import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

// Public endpoint — no session, no auth header, same pattern as
// submit-intake.ts. Anonymous visitors on the public marketing site
// (src/PublicSite.tsx) hit this to submit the lead-capture form.
//
// `leads` has no anonymous-write RLS policy (see
// supabase/migrations/0013_company_scoped_rls.sql) — this service-role
// endpoint is the only way to create one, matching the existing
// submit-intake.ts pattern.
const BACKSTAGE_COMPANY_ID = "bf72821a-f6ec-4bee-8563-fc8a96c41f79";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = req.body || {};
  const { name, email, message, source } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "A valid email is required" });
    return;
  }

  const url = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    res.status(500).json({ error: "Lead capture is not configured" });
    return;
  }

  const admin = createClient(url, serviceRoleKey);

  const { error } = await admin.from("leads").insert({
    company_id: BACKSTAGE_COMPANY_ID,
    name: name.trim(),
    email: email.trim(),
    message: message?.trim() || null,
    source: source || "public_site",
    status: "new",
  });

  if (error) {
    console.error("Error inserting lead:", error);
    res.status(500).json({ error: "Something went wrong submitting your info — please try again." });
    return;
  }

  res.status(200).json({ ok: true });
}
