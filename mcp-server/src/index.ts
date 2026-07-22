import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load .env from the mcp-server directory regardless of the process's cwd,
// since MCP hosts launch this as a subprocess and may set cwd elsewhere.
loadEnv({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env") });

// --- Supabase setup ---------------------------------------------------
// Uses the service role key so the server has full read/write access.
// Never expose this key client-side — it only lives in this server's env.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env and fill in your values."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- Schema constants ----------------------------------------------------
// Matches the `tasks` table used by the dashboard (see src/useDatabase.ts).

const TASK_STATUSES = ["focus", "active", "submitted", "completed", "archived"] as const;
const TASK_PRIORITIES = ["low", "medium", "high"] as const;
const TASK_IMPACTS = ["small", "medium", "large"] as const;

const TASK_SELECT = `
  id, title, description, status, priority, impact, due_date, estimate_minutes,
  company:companies(name),
  assignee:profiles!assigned_to(display_name)
`;

// --- Name -> id lookups ---------------------------------------------------
// The dashboard stores assignee/company as foreign keys, not plain text,
// so tools that take a human-readable name resolve it to an id first.

async function resolveProfileId(displayName: string): Promise<string> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .ilike("display_name", displayName)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`No team member found with name "${displayName}"`);
  return data.id;
}

async function resolveCompanyId(name: string): Promise<string> {
  const { data, error } = await supabase
    .from("companies")
    .select("id")
    .ilike("name", name)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`No company found named "${name}"`);
  return data.id;
}

// --- Tool schemas ---------------------------------------------------------

const ListTasksInput = z.object({
  status: z.enum(TASK_STATUSES).optional().describe("Filter by status"),
  assignee: z.string().optional().describe("Filter by assignee's display name"),
  company: z.string().optional().describe("Filter by company name"),
});

const CreateTaskInput = z.object({
  title: z.string().describe("Task title"),
  description: z.string().optional().describe("Longer description of the task"),
  assignee: z.string().optional().describe("Display name of the person to assign this to"),
  company: z.string().optional().describe("Company this task belongs to"),
  due_date: z.string().optional().describe("Due date, YYYY-MM-DD"),
  status: z.enum(TASK_STATUSES).default("focus").describe("Initial status"),
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  impact: z.enum(TASK_IMPACTS).default("medium"),
  estimate_minutes: z.number().optional().describe("Estimated time to complete, in minutes"),
});

const UpdateTaskStatusInput = z.object({
  task_id: z.string().describe("The id of the task to update"),
  status: z.enum(TASK_STATUSES).describe("New status"),
});

const AssignTaskInput = z.object({
  task_id: z.string().describe("The id of the task to reassign"),
  assignee: z.string().describe("Display name of the new assignee"),
});

// --- Server ---------------------------------------------------------------

const server = new Server(
  { name: "backstage-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_tasks",
      description: "List tasks from the Backstage dashboard, optionally filtered by status, assignee, or company",
      inputSchema: { type: "object", properties: {
        status: { type: "string", enum: TASK_STATUSES, description: "Filter by status" },
        assignee: { type: "string", description: "Filter by assignee's display name" },
        company: { type: "string", description: "Filter by company name" },
      } },
    },
    {
      name: "create_task",
      description: "Create a new task in the Backstage dashboard",
      inputSchema: { type: "object", properties: {
        title: { type: "string" },
        description: { type: "string" },
        assignee: { type: "string", description: "Display name of the person to assign this to" },
        company: { type: "string", description: "Company this task belongs to" },
        due_date: { type: "string", description: "YYYY-MM-DD" },
        status: { type: "string", enum: TASK_STATUSES },
        priority: { type: "string", enum: TASK_PRIORITIES },
        impact: { type: "string", enum: TASK_IMPACTS },
        estimate_minutes: { type: "number" },
      }, required: ["title"] },
    },
    {
      name: "update_task_status",
      description: "Update the status of an existing task",
      inputSchema: { type: "object", properties: {
        task_id: { type: "string" },
        status: { type: "string", enum: TASK_STATUSES },
      }, required: ["task_id", "status"] },
    },
    {
      name: "assign_task",
      description: "Reassign a task to someone else",
      inputSchema: { type: "object", properties: {
        task_id: { type: "string" },
        assignee: { type: "string", description: "Display name of the new assignee" },
      }, required: ["task_id", "assignee"] },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_tasks": {
        const input = ListTasksInput.parse(args ?? {});
        let query = supabase.from("tasks").select(TASK_SELECT);
        if (input.status) query = query.eq("status", input.status);
        if (input.assignee) {
          query = query.eq("assigned_to", await resolveProfileId(input.assignee));
        }
        if (input.company) {
          query = query.eq("company_id", await resolveCompanyId(input.company));
        }
        const { data, error } = await query.order("due_date", { ascending: true });
        if (error) throw error;
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "create_task": {
        const input = CreateTaskInput.parse(args);
        const { data, error } = await supabase
          .from("tasks")
          .insert({
            title: input.title,
            description: input.description ?? null,
            assigned_to: input.assignee ? await resolveProfileId(input.assignee) : null,
            company_id: input.company ? await resolveCompanyId(input.company) : null,
            due_date: input.due_date ?? null,
            status: input.status,
            priority: input.priority,
            impact: input.impact,
            estimate_minutes: input.estimate_minutes ?? 30,
          })
          .select()
          .single();
        if (error) throw error;
        return { content: [{ type: "text", text: `Created task: ${JSON.stringify(data)}` }] };
      }

      case "update_task_status": {
        const input = UpdateTaskStatusInput.parse(args);
        const { data, error } = await supabase
          .from("tasks")
          .update({ status: input.status })
          .eq("id", input.task_id)
          .select()
          .single();
        if (error) throw error;
        return { content: [{ type: "text", text: `Updated task: ${JSON.stringify(data)}` }] };
      }

      case "assign_task": {
        const input = AssignTaskInput.parse(args);
        const { data, error } = await supabase
          .from("tasks")
          .update({ assigned_to: await resolveProfileId(input.assignee) })
          .eq("id", input.task_id)
          .select()
          .single();
        if (error) throw error;
        return { content: [{ type: "text", text: `Reassigned task: ${JSON.stringify(data)}` }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err: any) {
    return {
      content: [{ type: "text", text: `Error: ${err.message ?? String(err)}` }],
      isError: true,
    };
  }
});

// --- Start ------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("backstage-mcp server running on stdio");
