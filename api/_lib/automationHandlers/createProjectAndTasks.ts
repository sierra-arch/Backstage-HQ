// createProjectAndTasks.ts
//
// The vetted handler behind the 'create_project_and_tasks' action_type.
// Extracted verbatim from api/submit-proposal-selections.ts's inline
// proposal-accepted kickoff logic (project + tasks + stage advance +
// agreement placeholder) so the automation runtime and that call site share
// one implementation instead of two copies drifting apart. Framework/client-
// agnostic like projectAutomation.ts itself -- takes whichever
// SupabaseClient the caller already has (service-role from an API route, or
// the browser client under a team member's own session), never assumes one.

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildKickoffTasks, kickoffProjectName, KICKOFF_TASK_METADATA } from "../projectAutomation";

export interface CreateProjectAndTasksContext {
  clientId: string;
  clientName: string;
  companyId: string;
  proposalId?: string;
  startDate: string; // YYYY-MM-DD
}

export async function createProjectAndTasks(supabase: SupabaseClient, ctx: CreateProjectAndTasksContext): Promise<void> {
  const { data: project } = await supabase
    .from("projects")
    .insert({
      client_id: ctx.clientId,
      company_id: ctx.companyId,
      name: kickoffProjectName(ctx.clientName),
      status: "active",
      start_date: ctx.startDate,
    })
    .select("id")
    .single();

  const kickoffTasks = buildKickoffTasks(ctx.clientName);
  if (project) {
    await supabase.from("tasks").insert(
      kickoffTasks.map((t) => ({
        title: t.title,
        description: t.description,
        company_id: ctx.companyId,
        client_id: ctx.clientId,
        project_id: project.id,
        status: t.autoComplete ? "completed" : "active",
        completed_at: t.autoComplete ? new Date().toISOString() : null,
        priority: "medium",
        metadata: KICKOFF_TASK_METADATA,
      }))
    );
  }

  await supabase.from("clients").update({ stage: "active" }).eq("id", ctx.clientId);

  if (ctx.proposalId) {
    await supabase.from("agreements").insert({ client_id: ctx.clientId, proposal_id: ctx.proposalId, status: "sent" });
  }
}
