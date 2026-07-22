// submit-offboarding.ts
//
// Client-portal endpoint for the two offboarding capture forms (Phase 7):
// testimonial and referral. Merged into one file -- combined with
// sign-agreement.ts + respond-deliverable.ts -> respond.ts, this keeps the
// project under Vercel Hobby's 12-serverless-function-per-deployment cap
// (was 14, hit a hard deploy failure at exactly that boundary).
//
// Testimonial always lands with is_approved=false -- the team reviews and
// approves before it can appear on the public testimonial wall
// (PublicSite.tsx's TestimonialWall, which only reads is_approved=true).
// Referral writes into the same `leads` table the public inquiry form and
// CRM pipeline use (source: 'referral'), not a separate referrals system.
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
    console.error("Auth error in submit-offboarding:", err);
    res.status(500).json({ error: "Something went wrong verifying your session" });
    return;
  }

  const body = (req.body || {}) as {
    type?: "testimonial" | "referral";
    quote?: string;
    author_name?: string;
    referred_name?: string;
    referred_email?: string;
  };

  if (body.type !== "testimonial" && body.type !== "referral") {
    res.status(400).json({ error: "type must be testimonial or referral" });
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

  if (body.type === "testimonial") {
    const trimmedQuote = typeof body.quote === "string" ? body.quote.trim() : "";
    const trimmedName = typeof body.author_name === "string" ? body.author_name.trim() : "";
    if (!trimmedQuote || !trimmedName) {
      res.status(400).json({ error: "Please fill in both fields" });
      return;
    }

    const { error: insertError } = await admin.from("testimonials").insert({
      company_id: client.company_id,
      client_id: clientId,
      quote: trimmedQuote.slice(0, 2000),
      author_name: trimmedName.slice(0, 200),
      is_approved: false,
    });

    if (insertError) {
      console.error("Error saving testimonial:", insertError);
      res.status(500).json({ error: "Failed to save your testimonial — please try again" });
      return;
    }

    res.status(200).json({ ok: true });
    return;
  }

  // type === "referral"
  const trimmedName = typeof body.referred_name === "string" ? body.referred_name.trim() : "";
  const trimmedEmail = typeof body.referred_email === "string" ? body.referred_email.trim() : "";
  if (!trimmedName) {
    res.status(400).json({ error: "Please enter your friend's name" });
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
