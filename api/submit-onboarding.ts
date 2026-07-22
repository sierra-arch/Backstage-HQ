// submit-onboarding.ts
//
// Client-portal endpoint: submits the post-acceptance onboarding form for a
// project and auto-generates the project's onboarding task list from the
// company's default 'onboarding' document_template (task_templates array).
// Same trust-boundary shape as the rest of this file's siblings -- the
// client's browser never writes to `projects`/`tasks` directly.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getRequestClientUser, getAdminClient, UnauthorizedError } from "./_lib/supabaseServer";

interface OnboardingTemplateStructure {
  questions: { key: string; label: string; kind: string }[];
  task_templates: { title: string; description: string }[];
}

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
    console.error("Auth error in submit-onboarding:", err);
    res.status(500).json({ error: "Something went wrong verifying your session" });
    return;
  }

  const { project_id, responses } = (req.body || {}) as {
    project_id?: string;
    responses?: Record<string, string>;
  };

  if (!project_id || typeof project_id !== "string") {
    res.status(400).json({ error: "project_id is required" });
    return;
  }
  if (!responses || typeof responses !== "object") {
    res.status(400).json({ error: "responses is required" });
    return;
  }

  const admin = getAdminClient();

  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("id, client_id, company_id, name, onboarding_completed_at")
    .eq("id", project_id)
    .maybeSingle();

  if (projectError || !project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  if (project.client_id !== clientId) {
    res.status(403).json({ error: "You don't have access to this project" });
    return;
  }
  if (project.onboarding_completed_at) {
    res.status(409).json({ error: "Onboarding has already been submitted for this project" });
    return;
  }

  // Sanitize responses down to only the string-typed answers the template
  // actually asks for -- never persist arbitrary client-sent keys/values.
  const { data: template } = await admin
    .from("document_templates")
    .select("structure")
    .eq("company_id", project.company_id)
    .eq("type", "onboarding")
    .eq("is_default", true)
    .maybeSingle();

  const structure = template?.structure as OnboardingTemplateStructure | undefined;
  const allowedKeys = new Set((structure?.questions ?? []).map((q) => q.key));
  const safeResponses: Record<string, string> = {};
  for (const [key, value] of Object.entries(responses)) {
    if (allowedKeys.has(key) && typeof value === "string") {
      safeResponses[key] = value.slice(0, 2000);
    }
  }

  const { error: updateError } = await admin
    .from("projects")
    .update({ onboarding_responses: safeResponses, onboarding_completed_at: new Date().toISOString() })
    .eq("id", project_id);

  if (updateError) {
    console.error("Error saving onboarding responses:", updateError);
    res.status(500).json({ error: "Failed to save your answers — please try again" });
    return;
  }

  if (structure?.task_templates?.length) {
    await admin.from("tasks").insert(
      structure.task_templates.map((t) => ({
        title: t.title,
        description: t.description,
        company_id: project.company_id,
        client_id: clientId,
        project_id: project.id,
        status: "active",
        priority: "medium",
        metadata: { auto_created: true, trigger: "onboarding_submitted" },
      }))
    );
  }

  res.status(200).json({ ok: true });
}
