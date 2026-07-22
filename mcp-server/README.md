# backstage-mcp

A small MCP (Model Context Protocol) server that lets Claude read and write to
the `tasks` table behind the Backstage dashboard (Supabase-backed). It's
wired to the actual schema used by the dashboard app (see
`../src/useDatabase.ts`), including the `profiles`/`companies` foreign keys.

## Tools it exposes

- `list_tasks` — list tasks, optionally filtered by status, assignee (display
  name), or company
- `create_task` — create a new task
- `update_task_status` — change a task's status (`focus`, `active`,
  `submitted`, `completed`, `archived`)
- `assign_task` — reassign a task to someone by display name

Assignee and company are looked up by name and resolved to the underlying
`profiles.id` / `companies.id` foreign keys, matching how the dashboard
stores them.

## 1. Install dependencies

```bash
cd mcp-server
npm install
```

## 2. Set up your environment

```bash
cp .env.example .env
```

Fill in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — both are in your
Supabase project under **Settings > API**. Use the **service role** key (not
the anon/public key from the dashboard's own `.env`), since this server needs
full read/write access, bypassing row-level security. Never commit `.env` or
share this key — it's already in `.gitignore`.

## 3. Build

```bash
npm run build
```

## 4. Test locally with Claude Code

Claude Code can talk to a local MCP server directly over stdio — this is the
fastest way to test before deploying anything.

From your project root, add the server:

```bash
claude mcp add backstage-tasks -- node /absolute/path/to/mcp-server/dist/index.js
```

(Use the full absolute path to `dist/index.js` — relative paths won't
resolve reliably.)

Then in a Claude Code session, try:

- "List my open tasks"
- "Create a task for Taylor due Friday called 'Send workbook proof'"
- "Mark that task as completed"

If Claude can see and modify your Supabase data through these prompts, the
whole mechanism works — that's the milestone.

## 5. Troubleshooting

- **"Missing SUPABASE_URL..." on startup** — `.env` isn't being read, or
  wasn't filled in.
- **"No team member found with name..."** — the assignee name has to match
  a `profiles.display_name` value (case-insensitive). Check
  `list_tasks`/your dashboard for the exact name in use.
- **Claude Code doesn't see the server** — double check the path in the
  `claude mcp add` command is absolute, and that you ran `npm run build`
  first (it runs the compiled `dist/index.js`, not the TypeScript source).

## What's next

Once this is working and stable:

1. Add `clients` table tools (`list_clients`, `create_client`,
   `update_client_stage`) using the same name-resolution pattern.
2. Only then think about deploying this remotely (e.g. to Vercel) so it's
   available outside Claude Code, and about who should be able to see/edit
   what.
