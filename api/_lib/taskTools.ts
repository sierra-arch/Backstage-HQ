import type { SupabaseClient, User } from "@supabase/supabase-js";
import type Anthropic from "@anthropic-ai/sdk";

// Kept in sync with src/useDatabase.ts's `Task` type and mcp-server/src/index.ts.
export const TASK_STATUSES = ["focus", "active", "submitted", "completed", "archived"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export const TASK_IMPACTS = ["small", "medium", "large"] as const;

const TASK_SELECT = `
  id, title, description, status, priority, impact, due_date, estimate_minutes,
  company:companies(name),
  assignee:profiles!assigned_to(display_name)
`;

export async function resolveProfileId(supabase: SupabaseClient, displayName: string): Promise<string> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .ilike("display_name", displayName)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`No team member found with name "${displayName}"`);
  return data.id;
}

export async function resolveCompanyId(supabase: SupabaseClient, name: string): Promise<string> {
  const { data, error } = await supabase
    .from("companies")
    .select("id")
    .ilike("name", name)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`No company found named "${name}"`);
  return data.id;
}

export const ANTHROPIC_TOOLS: Anthropic.Tool[] = [
  {
    name: "list_tasks",
    description: "List tasks from the Backstage dashboard, optionally filtered by status, assignee, or company",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: TASK_STATUSES as unknown as string[], description: "Filter by status" },
        assignee: { type: "string", description: "Filter by assignee's display name" },
        company: { type: "string", description: "Filter by company name" },
      },
    },
  },
  {
    name: "create_task",
    description: "Create a new task in the Backstage dashboard",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        assignee: { type: "string", description: "Display name of the person to assign this to" },
        company: { type: "string", description: "Company this task belongs to" },
        due_date: { type: "string", description: "YYYY-MM-DD" },
        status: { type: "string", enum: TASK_STATUSES as unknown as string[] },
        priority: { type: "string", enum: TASK_PRIORITIES as unknown as string[] },
        impact: { type: "string", enum: TASK_IMPACTS as unknown as string[] },
        estimate_minutes: { type: "number" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_task_status",
    description: "Update the status of an existing task",
    input_schema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        status: { type: "string", enum: TASK_STATUSES as unknown as string[] },
      },
      required: ["task_id", "status"],
    },
  },
  {
    name: "assign_task",
    description: "Reassign a task to someone else",
    input_schema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        assignee: { type: "string", description: "Display name of the new assignee" },
      },
      required: ["task_id", "assignee"],
    },
  },
];

export async function executeTool(
  name: string,
  input: any,
  supabase: SupabaseClient,
  user: User
): Promise<unknown> {
  switch (name) {
    case "list_tasks": {
      let query = supabase.from("tasks").select(TASK_SELECT);
      if (input.status) query = query.eq("status", input.status);
      if (input.assignee) query = query.eq("assigned_to", await resolveProfileId(supabase, input.assignee));
      if (input.company) query = query.eq("company_id", await resolveCompanyId(supabase, input.company));
      const { data, error } = await query.order("due_date", { ascending: true });
      if (error) throw error;
      return data;
    }

    case "create_task": {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title: input.title,
          description: input.description ?? null,
          assigned_to: input.assignee ? await resolveProfileId(supabase, input.assignee) : null,
          company_id: input.company ? await resolveCompanyId(supabase, input.company) : null,
          due_date: input.due_date ?? null,
          status: input.status ?? "focus",
          priority: input.priority ?? "medium",
          impact: input.impact ?? "medium",
          estimate_minutes: input.estimate_minutes ?? 30,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    case "update_task_status": {
      const { data, error } = await supabase
        .from("tasks")
        .update({ status: input.status })
        .eq("id", input.task_id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    case "assign_task": {
      const { data, error } = await supabase
        .from("tasks")
        .update({ assigned_to: await resolveProfileId(supabase, input.assignee) })
        .eq("id", input.task_id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
