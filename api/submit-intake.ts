import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

// Public endpoint — no session, no auth header. This is intentional: the
// intake wizard is meant for anonymous visitors. It's still safe because
// clients/intake_responses have no anonymous-write RLS policy at all —
// the ONLY way to create a lead is through this validated endpoint using
// the service role key, never a direct client-side insert.

const REVENUE_POINTS: Record<string, number> = {
  under_25k: 0,
  "25k_75k": 1,
  "75k_200k": 2,
  over_200k: 3,
};

const TEAM_SIZE_POINTS: Record<string, number> = {
  just_me: 0,
  one_to_two: 1,
  small_team: 2,
  full_team: 3,
};

const STAGE_POINTS: Record<string, number> = {
  just_starting: 0,
  steady_but_scattered: 1,
  growing_but_stretched: 2,
  ready_to_multiply: 3,
};

function computeTrack(revenue: string, teamSize: string, stage: string) {
  const score =
    (REVENUE_POINTS[revenue] ?? 0) +
    (TEAM_SIZE_POINTS[teamSize] ?? 0) +
    (STAGE_POINTS[stage] ?? 0);

  if (score <= 2) return "freelancer";
  if (score <= 5) return "founder_mini";
  if (score <= 7) return "founder_full";
  return "ceo";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = req.body || {};
  const {
    company_slug,
    name,
    business_name,
    contact_email,
    contact_phone,
    revenue,
    team_size,
    stage,
    primary_goal,
    source,
  } = body;

  if (!company_slug || typeof company_slug !== "string") {
    res.status(400).json({ error: "company_slug is required" });
    return;
  }
  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  if (!contact_email || typeof contact_email !== "string" || !contact_email.includes("@")) {
    res.status(400).json({ error: "A valid email is required" });
    return;
  }
  if (!revenue || !team_size || !stage) {
    res.status(400).json({ error: "Please answer all questions about where your business is at" });
    return;
  }

  const url = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    res.status(500).json({ error: "Intake is not configured" });
    return;
  }

  const admin = createClient(url, serviceRoleKey);

  const { data: company, error: companyError } = await admin
    .from("companies")
    .select("id")
    .eq("slug", company_slug)
    .maybeSingle();

  if (companyError || !company) {
    res.status(404).json({ error: "We couldn't find that business — check the link and try again." });
    return;
  }

  const recommendedTrack = computeTrack(revenue, team_size, stage);

  const { data: client, error: clientError } = await admin
    .from("clients")
    .insert({
      company_id: company.id,
      name: business_name?.trim() || name.trim(),
      contact_email: contact_email.trim(),
      contact_phone: contact_phone?.trim() || null,
      description: primary_goal ? `Primary goal: ${primary_goal}` : null,
      stage: "lead",
      track: recommendedTrack,
      source: source || null,
    })
    .select()
    .single();

  if (clientError || !client) {
    console.error("Error creating client from intake:", clientError);
    res.status(500).json({ error: "Something went wrong submitting your application — please try again." });
    return;
  }

  const { error: intakeError } = await admin.from("intake_responses").insert({
    client_id: client.id,
    raw_answers: {
      name,
      business_name,
      contact_email,
      contact_phone,
      revenue,
      team_size,
      stage,
      primary_goal,
      source,
    },
    recommended_track: recommendedTrack,
  });

  if (intakeError) {
    console.error("Error recording intake response:", intakeError);
    // The lead itself was created successfully — don't fail the whole
    // submission over the response-log write.
  }

  res.status(200).json({ ok: true });
}
