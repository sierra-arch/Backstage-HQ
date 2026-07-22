# Backstage Vocabulary Reference

Canonical terms, allowed field values, and current build status. **This
file is the authority when anything conflicts** with `platform-spec.md` or
`saas-feature-spec.md` — those describe intent and architecture; this
describes what's actually real in the schema and code.

## Tables

**Existing before this build effort:** `clients`, `companies`, `profiles`,
`tasks`, `products`

**Added by migrations 0001–0006:** `intake_responses`, `proposals`,
`agreements`, `projects`, `invoices`, `client_users`

**Other tables that exist in the database but aren't used by any current
frontend code:** `company_goals`, `activity_log`, `meetings`,
`sop_categories`, `goals`, `sops`, `accomplishments`, `goal_updates`,
`messages`, `notes`, `points_log`, plus views `vw_company_goals`,
`active_tasks`, `vw_brand_progress`, `todays_focus`. `messages` (team
chat/DMs) and `sop_categories`/`sops` (Playbook) *are* used, the rest
currently aren't wired to any UI.

**Confirmed NOT to exist despite being referenced in old code:**
`pending_approvals` — `src/useDatabase.ts` has dead code assuming this
table exists; it doesn't. Don't build against it without creating it first.

## Companies vs. Clients vs. Organizations

- `companies` = the founder's own sub-brands: **Prose Florals**, **Backstage**, **Mairë**. Exactly 3 rows, rarely changes.
- `clients` = a customer of one of those sub-brands (e.g. a wedding client of Prose Florals). This is the entity the whole client-lifecycle system (`stage`, `track`, proposals, agreements, invoices) is built around.
- "Organization" / `org_id` = a **Phase 2, not-yet-built** concept for true multi-tenant SaaS (other businesses signing up as customers of the platform itself). Do not use this term for `companies` — they are not the same axis.

## Roles and auth

- `profiles.role`: `founder` | `team` — internal team members only, Google OAuth sign-in via `App.tsx`'s `AuthGate`/`ensureProfile`.
- `client_users`: maps a Supabase Auth user (created via magic-link invite) to exactly one `clients.id`. Entirely separate identity path — a client is **never** a value of `profiles.role`, and a client login must **never** create a `profiles` row (that would grant full internal-tool access once combined with the `is_team_member()` RLS policy).
- Do not use "admin"/"team_member" (an earlier planning doc's terms) — the real values are `founder`/`team`.

## Field values (exact, snake_case in the database)

| Column | Allowed values |
|---|---|
| `clients.stage` | `lead` → `proposal_sent` → `active` → `delivered` → `archived` |
| `clients.track` | `freelancer` / `founder_mini` / `founder_full` / `ceo` |
| `tasks.status` | `focus` / `active` / `submitted` / `completed` / `archived` |
| `tasks.priority` | `low` / `medium` / `high` |
| `tasks.impact` | `small` / `medium` / `large` |
| `projects.status` | `active` / `on_hold` / `completed` / `archived` |
| `proposals.status` | `draft` / `sent` / `viewed` / `accepted` / `declined` |
| `agreements.status` | `sent` / `signed` / `voided` |
| `invoices.status` | `unpaid` / `paid` / `overdue` |

⚠️ **`tasks.status` and `clients.stage` both use the word "active" but are
completely unrelated vocabularies covering different entities.** A task
being "active" says nothing about the client's lifecycle stage.

Title Case (e.g. "Founder Mini", "In Progress") is a **display-only**
convention — never store it that way.

## RLS helper functions (Postgres)

- `is_team_member()` — `security definer`, checks `exists (select 1 from profiles where id = auth.uid())`. Used by the `team_full_access` policy on every table.
- `client_owns(check_client_id uuid)` — `security definer`, checks the caller's `client_users` row matches the given `client_id`. Used by `client_reads_own*` policies (read-only, additive alongside `team_full_access` — never replaces it).

## Routes

- `/` — the internal app (`App.tsx` → `AuthGate` → `DashboardApp`)
- `/portal` — the client app (`ClientPortalApp.tsx`), routed via a plain `window.location.pathname` check in `src/index.tsx` (no router library in this project — introduce one only when a second distinct path is actually needed, e.g. `/proposal/:id`)

## Internal nav (Sidebar, `src/DashboardApp.tsx`)

Today · Meetings · Tasks · Companies · Playbook · My Team · Career Path ·
Settings

## Known schema-drift landmines (already found and fixed once — watch for the pattern recurring)

Several past sessions independently built overlapping/duplicate concepts
against schemas that were never actually created, or that drifted from what
the live database has. Examples already caught and fixed: a `Product` type
with `sku`/`etsy_listing_id`/`is_active` fields that don't exist on the real
`products` table; a `Client` type with `client_status` that doesn't exist; a
`CreateClientModal` inserting a `company_name` column that doesn't exist;
company/client filtering that matched on a `company_name` string field
instead of the real `company_id` UUID. **Before writing a query against any
table, check its real columns** (Supabase SQL editor, or ask the user to run
a quick `select * from <table> limit 1` if unsure) rather than trusting a
TypeScript interface's field list, since those have drifted before.
