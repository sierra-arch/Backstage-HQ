// automationRuntime.ts
//
// Walks the automation web (Automation Web feature, migration 0028): a
// trigger fires, this looks up every active `automations` row for that
// company/trigger, and walks `automation_edges` from each match to execute
// the chain in order. Each node's action_type dispatches to a real,
// reviewed handler in automationHandlers/ -- there is no path for a founder
// to make a node execute logic that isn't one of the vetted handlers below
// (see the Automation Web build spec, Section 3: bounded, not arbitrary).
//
// If a company's web has no active row for a trigger, this is a no-op --
// per spec Section 8, an empty web means nothing fires, it does not fall
// back to any hardcoded behavior.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createProjectAndTasks, type CreateProjectAndTasksContext } from "./automationHandlers/createProjectAndTasks";
import { notifyTeam, type NotifyTeamContext } from "./automationHandlers/notifyTeam";
import { requestTestimonial, type RequestTestimonialContext } from "./automationHandlers/requestTestimonial";

export type TriggerType = "proposal_accepted" | "deliverable_approved" | "project_completed";
export type ActionType = "create_project_and_tasks" | "notify_team" | "request_testimonial";

// Every field any handler might need. A given trigger only ever populates
// the subset its handlers actually read -- see each handler's own Context
// type for what's required.
export interface AutomationTriggerContext {
  companyId: string;
  clientId?: string;
  clientName?: string;
  proposalId?: string;
  message?: string;
  startDate?: string;
}

interface AutomationRow {
  id: string;
  company_id: string;
  trigger_type: TriggerType;
  action_type: ActionType;
  active: boolean;
}

async function dispatchAction(supabase: SupabaseClient, node: AutomationRow, ctx: AutomationTriggerContext): Promise<void> {
  switch (node.action_type) {
    case "create_project_and_tasks": {
      if (!ctx.clientId || !ctx.clientName) return;
      const handlerCtx: CreateProjectAndTasksContext = {
        clientId: ctx.clientId,
        clientName: ctx.clientName,
        companyId: ctx.companyId,
        proposalId: ctx.proposalId,
        startDate: ctx.startDate ?? new Date().toISOString().slice(0, 10),
      };
      return createProjectAndTasks(supabase, handlerCtx);
    }
    case "notify_team": {
      if (!ctx.message) return;
      const handlerCtx: NotifyTeamContext = { companyId: ctx.companyId, message: ctx.message };
      return notifyTeam(supabase, handlerCtx);
    }
    case "request_testimonial": {
      const handlerCtx: RequestTestimonialContext = { companyId: ctx.companyId };
      return requestTestimonial(supabase, handlerCtx);
    }
  }
}

// Depth-first walk from a head node, guarding against a cycle (shouldn't be
// reachable through the UI, but the runtime shouldn't infinite-loop if one
// ever exists) with a visited set.
async function executeChain(supabase: SupabaseClient, node: AutomationRow, ctx: AutomationTriggerContext, visited: Set<string>): Promise<void> {
  if (visited.has(node.id)) return;
  visited.add(node.id);

  await dispatchAction(supabase, node, ctx);

  const { data: edges } = await supabase
    .from("automation_edges")
    .select("target_automation_id")
    .eq("source_automation_id", node.id);

  if (!edges || edges.length === 0) return;

  for (const edge of edges) {
    const { data: target } = await supabase
      .from("automations")
      .select("id, company_id, trigger_type, action_type, active")
      .eq("id", edge.target_automation_id)
      .eq("active", true)
      .maybeSingle();
    if (target) await executeChain(supabase, target as AutomationRow, ctx, visited);
  }
}

export async function runTrigger(supabase: SupabaseClient, companyId: string, triggerType: TriggerType, ctx: AutomationTriggerContext): Promise<void> {
  const { data: heads } = await supabase
    .from("automations")
    .select("id, company_id, trigger_type, action_type, active")
    .eq("company_id", companyId)
    .eq("trigger_type", triggerType)
    .eq("active", true);

  if (!heads || heads.length === 0) return;

  const visited = new Set<string>();
  for (const head of heads as AutomationRow[]) {
    await executeChain(supabase, head, ctx, visited);
  }
}
