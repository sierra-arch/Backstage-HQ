// submit-testimonial.ts
//
// Client-portal endpoint: submits a testimonial for the client's own
// completed project. Always lands with is_approved=false -- the team
// reviews and approves before it can appear on the public testimonial wall
// (PublicSite.tsx's TestimonialWall, which only reads is_approved=true).
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
    console.error("Auth error in submit-testimonial:", err);
    res.status(500).json({ error: "Something went wrong verifying your session" });
    return;
  }

  const { quote, author_name } = (req.body || {}) as { quote?: string; author_name?: string };
  const trimmedQuote = typeof quote === "string" ? quote.trim() : "";
  const trimmedName = typeof author_name === "string" ? author_name.trim() : "";
  if (!trimmedQuote || !trimmedName) {
    res.status(400).json({ error: "Please fill in both fields" });
    return;
  }

  const admin = getAdminClient();

  const { data: client, error: clientError } = await admin
    .from("clients")
    .select("company_id")
    .eq("id", clientId)
    .maybeSingle();

  if (clientError || !client?.company_id) {
    res.status(500).json({ error: "Could not resolve your account" });
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
}
