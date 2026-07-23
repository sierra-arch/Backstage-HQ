# Automation Web — Build Spec (v2, reconciled against live codebase)

*Backstage OS · Feature: Automation Backend Customization*
*v2: July 23, 2026 — supersedes the earlier draft, which was written without
knowledge of the existing `automations` table, `company_members.role`
system, or the Vercel Hobby 12-function cap. This version was written after
reading the live migrations, `useDatabase.ts`, `roadmap.md`, and
`claude/backstage-os-philosophy.md`. Hand this to VS Code / the dev agent.*

---

## 1. What We're Building

A visual, editable "web" (node-and-connector canvas) that shows a founder
and their team the automations running behind their business, and lets them
chain and rearrange them without touching code.

Out of the box, onboarding answers generate a **working default automation
web** — nothing blank, nothing to configure from scratch. Founders only
touch it if something bothers them.

**Confirmed decision (2026-07-23):** this is the real, generic, chainable
automation engine — not a visual skin over a fixed set of hardcoded
automations. The founder explicitly chose to build this right rather than
defer it. See Section 3 for how that's done safely.

This feature lives inside **Backstage OS (the Spine)** per the locked
architecture — infrastructure, not a skin. Skins may restyle its
presentation later, never its logic or approval rules.

---

## 2. What Already Exists (Read This First)

Before this feature, don't assume a blank slate. The live schema already has:

- **`automations` table** (migration `0012`, Client Portal Expansion Phase
  1): `id, company_id, trigger_type, action_type, config jsonb, active`.
  Built but **deliberately left unused** — Phase 10 and Phase 12 both chose
  to hardcode 2–3 automations directly in code (`api/_lib/projectAutomation.ts`,
  the email-sequence cron) rather than build a generic interpreter against
  this table. This spec is what finally turns that table into what it was
  always intended for ("there for Phase 11+ when a real on/off UI might use
  it," per `roadmap.md`).
- **`company_members.role`** (`founder`/`team`/`contractor`, migration
  `0012`/`0014`): real, RLS-backed, enforced via nav-hiding
  (`fetchIsContractorOnly()` hides Leads/Marketing/Reporting/Systems for
  contractor-only profiles). This is a *separate* concept from
  `profiles.role` (`founder`/`team`, an older, different field — don't
  conflate the two). No invite-new-member flow exists yet, blocked on
  Vercel Hobby's 12-serverless-function cap (`api/*.ts` is pinned at exactly
  12 — any new endpoint needs a merge first).
- **The Build Pack Ethical Constraint** (Preview → Explanation → Decision,
  locked in `claude/backstage-os-philosophy.md`) has one confirmed
  exception in production: kickoff-task automation on proposal acceptance
  fires **instantly**, no pre-click approval gate — because the founder
  confirmed, when asked directly, that automation may fire without a
  pre-approval step as long as it's never silent (shown happening live with
  a plain-language "why"). That reconciliation is the locked pattern for
  *safe, reversible* automation UI going forward. It does **not** extend to
  changing what an automation *does* — see Section 5.

---

## 3. The Execution Model — Bounded, Not Arbitrary

This is the most important design decision in this spec. "Build the real
thing" does not mean founders can wire up arbitrary logic. Per the Values
Charter ("power must be bounded to be ethical," "no unrestricted actions"),
every node in the web runs one of a **fixed, code-defined set of vetted
trigger/action types** — the same safety property the two existing
hardcoded automations already have. What's new is that founders can now
**chain and rearrange** those vetted building blocks visually; the engine
does not execute arbitrary code a founder writes.

- **Trigger types** (when a chain starts): extend the existing check
  constraint — `proposal_accepted`, `deliverable_approved`,
  `project_completed`, plus new ones as needed (e.g. `client_onboarded`,
  `payment_received`). Each is backed by a real, reviewed handler in code.
- **Action types** (what a node does): extend the existing check constraint
  — `create_project_and_tasks`, `notify_team`, `request_testimonial`, plus
  new ones. Each is backed by a real, reviewed handler in code.
- **Chaining is the new capability.** A founder can connect
  `proposal_accepted → create_project_and_tasks → notify_team`, or leave
  out a step, or reorder where reordering is semantically valid — but they
  cannot invent a new action type or make a node do something no handler
  exists for. The canvas only offers node types that have real code behind
  them.
- Adding a genuinely new trigger/action type is still a code change (new
  handler + constraint value), same as it is today — this feature does not
  remove that gate, it makes the *composition* of existing gates editable.

This is the responsible version of "build it right the first time": real,
new capability (composability) without the actual risk "generic interpreter"
usually implies (arbitrary execution).

---

## 4. Schema — Extend, Don't Parallel-Build

Consistent with this codebase's established pattern (`company_members` over
a parallel "organizations" table; `comments` folded into existing threads;
referrals into the existing `leads` table — never a second system for the
same concept), **extend the existing `automations` table** rather than
create a parallel `AutomationWeb`/`WebNode` schema.

```sql
-- New migration, e.g. 0023_automation_web.sql

alter table public.automations
  add column title text,
  add column subtitle text,
  add column icon text,
  add column status text not null default 'active'
    check (status in ('active', 'waiting', 'paused')), -- neutral, no red/yellow/green
  add column position_x double precision not null default 0,
  add column position_y double precision not null default 0,
  add column clearance_departments text[] not null default '{}'; -- see Section 6

-- Connections between automations (the "web" structure). A chain is
-- expressed as edges between existing automations rows, not a new node
-- concept layered on top.
create table public.automation_edges (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  source_automation_id uuid not null references public.automations(id) on delete cascade,
  target_automation_id uuid not null references public.automations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (source_automation_id, target_automation_id)
);
create index automation_edges_company_id_idx on public.automation_edges(company_id);
create index automation_edges_source_idx on public.automation_edges(source_automation_id);
alter table public.automation_edges enable row level security;

-- RLS: same team_full_access pattern already used everywhere else.
create policy "team_full_access" on public.automation_edges for all
  using (is_company_member(company_id)) with check (is_company_member(company_id));
```

`automations` already has `team_full_access` RLS from Phase 1 — no change
needed there. No parallel `AutomationWeb`, `WebNode`, or `PackRun`-style
table. Every automation row *is* a node; every `automation_edges` row *is*
a connector.

### Staged edits

Rearranging visual position (`position_x`/`position_y`) is low-stakes and
can save directly — it's presentation, not logic. Anything that changes
**what a chain does** (adding/removing an edge, changing `active`, changing
`config`) should still go through a lightweight preview step before
committing, consistent with the Build Pack Ethical Constraint — but per
Section 2's confirmed exception, this can be a fast inline confirm ("Connect
these two? This means X will now trigger Y.") rather than a heavier
multi-screen Preview/Explanation/Decision flow, since these changes are
reversible (edges and `active` can always be undone) and always visible in
the UI, never silent.

---

## 5. Team Roles & Permissions (Reconciled)

**Do not replace `company_members.role`.** It's real, shipped, and working.
Add a `departments` column onto the *same* row instead of introducing a
separate Role/TeamMember identity system:

```sql
alter table public.company_members
  add column departments text[] not null default '{}';
```

- **Founder/team/contractor stays exactly as-is** — same nav-gating, same
  RLS helpers (`is_company_member`, `is_company_founder`), untouched.
- **Departments are additive**, scoped to the Automation Web (and available
  to future features without a migration, since it's just a text array).
  Suggested defaults, matching the department language already used
  elsewhere in the Backstage philosophy docs: Operations, Sales, Marketing,
  Design/Branding, Customer Service, Administration, Technology,
  Production/Fulfillment, Inventory Management, Finance.
- **View filtering** (which nodes a team member sees) follows the existing
  nav-hiding precedent — an app-level filter, not an RLS-level one. A node
  outside a member's departments is simply absent from their canvas, same
  spirit as contractor nav-hiding today.
- **Edit filtering** (who can change a chain) is higher-stakes than
  visibility, so it gets a real RLS policy, not just a UI filter:

```sql
create policy "department_scoped_edit" on public.automations for update
  using (
    is_company_founder(company_id)
    or exists (
      select 1 from public.company_members cm
      where cm.company_id = automations.company_id
        and cm.profile_id = auth.uid()
        and cm.departments && automations.clearance_departments
    )
  );
```

- **Founder access can never be reduced.** `is_company_founder()` always
  passes, regardless of `departments`.
- **UI:** add a departments multi-select to the existing
  `TeamManagementSection` in `CompanyModal`, next to the current role
  dropdown. No new invite flow, no new serverless function — this is a
  direct-RLS write from the existing founder-only UI, consistent with the
  "default to direct-RLS over a new API route" principle already stated in
  `roadmap.md` (relevant given the function count is pinned at exactly 12).

---

## 6. Visual & Layout Guidelines

(Unchanged from v1 — still the right direction.)

- **Whitespace first.** Generous padding around every node and between
  rows. Closer to Coggle's calm whitespace than HighLevel's density.
- **Palette:** Backstage's calm neutral palette + Backstage green for
  active states. No red/yellow status colors.
- **Node card:** icon, title, one-line subtitle, single neutral status pill
  (`active`/`waiting`/`paused`). No metric chips — that's dashboard
  territory, not this canvas.
- **Connectors:** simple curved or right-angle lines, subtle stroke.
- **Canvas:** dot-grid background, free pan/zoom, minimal toolbar.
- **Detail panel:** right-side, opens on node select, houses the inline
  confirm step from Section 4.
- **One primary action per screen** still applies: selecting a node opens
  exactly one panel.

---

## 7. Suggested Tech Stack

Existing stack: React, Vite, Tailwind, Supabase, framer-motion, react-confetti.
`dnd-kit` is a listed dependency but **confirmed genuinely unused anywhere
in `src/`** (per `roadmap.md`'s Phase 8 note — the kanban ended up using
simple buttons instead). Don't assume it's wired up.

**Recommendation unchanged: add `@xyflow/react` (React Flow)** for the
canvas — purpose-built for draggable nodes, connector edges, pan/zoom, and
custom node components; actively maintained (v12 as of July 2026); has a
documented Workflow Editor template matching the reference screenshots.
This is a new, additive dependency; it doesn't replace or depend on
`dnd-kit`.

*(Source: [xyflow/react on npm](https://www.npmjs.com/package/@xyflow/react), [React Flow docs](https://reactflow.dev/))*

---

## 8. Runtime — How a Chain Actually Executes

- A trigger fires (e.g. `proposal_accepted`, same event that already calls
  `api/_lib/projectAutomation.ts` today).
- The runtime looks up `automations` rows for that company where
  `trigger_type` matches and `active = true`, then walks `automation_edges`
  from each matching row to execute the chain in order.
- Each node's `action_type` dispatches to its existing, reviewed handler
  function — the same handlers Phase 10/12 already wrote, now called
  through a chain-walker instead of being hardcoded in sequence.
- Every execution is visible in the UI (status pill updates, per the
  confirmed "never silent" pattern) — never a background action with no
  trace.
- This replaces the hardcoded call sites in `projectAutomation.ts` and the
  email-sequence cron *only for the trigger/action pairs a founder has
  actually built into their web* — if a company's web is empty for a given
  trigger, fall back to no-op (not to the old hardcoded behavior), so the
  web is genuinely the source of truth once it exists.

---

## 9. Acceptance Criteria

1. A new business completes onboarding and immediately has a populated,
   working automation web — no empty state.
2. The default web is a simple linear chain — no conditional branching
   generated automatically (still true; branching UI remains out of scope
   for V1, see Section 10).
3. A founder can view and edit every node; a team member only sees/edits
   nodes whose `clearance_departments` overlaps their own `departments`.
4. Reordering/repositioning nodes is immediate; changing what a chain does
   (edges, `active`, `config`) shows an inline, visible confirm — never
   silent, per Section 4.
5. Every node's `action_type` maps to a real, reviewed code handler — no
   path exists for a founder to execute logic that wasn't vetted.
6. The canvas reads as calm and uncluttered — generous whitespace, no
   metric chips, no red/yellow/green states, no urgency language.
7. `company_members.role` (founder/team/contractor) and its existing
   nav-gating are completely untouched by this feature.
8. The feature functions with AI fully disabled.

---

## 10. Out of Scope (V1)

- True free-form conditional branching authored through the UI (defaults
  stay linear; a founder can still only chain existing vetted node types,
  not build new if/else logic visually — that's a further-out phase)
- Founder-defined custom action types (still requires a code change)
- Real-time multi-user co-editing of the same web
- AI-suggested chain edits (future, under the existing AI Philosophy —
  draft/suggest only, never auto-apply)
- A new team-member invite flow (separate, pre-existing gap, blocked on the
  12-function cap — unrelated to this feature, don't bundle it in)

---

## 11. Suggested File/Component Structure

```
/src/features/automation-web/
  AutomationWebCanvas.tsx       # React Flow canvas wrapper, pan/zoom, dot-grid background
  nodes/
    AutomationNode.tsx          # custom node component (icon, title, subtitle, status pill)
    nodeTypes.ts                # registers custom node types with React Flow
  edges/
    AutomationEdge.tsx          # custom edge/connector styling
  panel/
    NodeDetailPanel.tsx         # right-side panel, opens on node select
    ConfirmChainChange.tsx      # inline confirm for edge/active/config changes (Section 4)
  hooks/
    useAutomationWeb.ts         # fetch automations + automation_edges from Supabase, scoped by company
    useDepartmentFilter.ts      # filters visible nodes by current user's departments
  types.ts                      # Automation (extended), AutomationEdge

/api/_lib/
  automationRuntime.ts          # chain-walker: trigger -> matching automations -> walk edges -> dispatch action handlers
  automationHandlers/            # one file per action_type, the "vetted handler" registry from Section 3
    createProjectAndTasks.ts
    notifyTeam.ts
    requestTestimonial.ts
    ...
```
