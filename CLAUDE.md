# Backstage Platform — Project Instructions

Read this fully before writing any code. It exists so sessions don't have to
be re-taught the same facts.

## What This Project Is

Backstage is a custom-coded internal platform (three views: Public, Client,
Internal) that runs the founder's businesses (Prose Florals, Backstage,
Mairë). The Internal View (task assigner) already exists. It's being
extended into a full client lifecycle system, then eventually a
multi-tenant SaaS.

**Mission, in one line:** every feature should hand the founder back time,
clarity, or peace of mind — never make them feel behind. Copy and UX should
always be affirmative ("here's a small win available") never deficit-framed
("you haven't done X").

## Terminology — Use These Exact Terms

This is the single most common source of errors. Use the real schema
vocabulary below, not similar-sounding alternatives. Full detail:
`claude/vocabulary-reference.md`.

**Tables:** `clients` · `companies` · `profiles` · `tasks` · `products` ·
`projects` · `intake_responses` · `proposals` · `agreements` · `invoices` ·
`client_users`

| Say this | Not this |
|---|---|
| `companies` | "Organization" (not-yet-built Phase 2 concept) |
| `founder` / `team` (roles on `profiles`) | "admin" / "team_member" |
| `client_users` (separate identity, magic-link login) | "client" as an internal role |
| `clients` at `stage = lead` | a separate "Leads" table |

**Exact field values (snake_case in DB, Title Case only in UI display):**
- `clients.stage`: `lead` → `proposal_sent` → `active` → `delivered` → `archived`
- `clients.track`: `freelancer` / `founder_mini` / `founder_full` / `ceo`
- `tasks.status`: `focus` / `active` / `submitted` / `completed` / `archived`
- `projects.status`: `active` / `on_hold` / `completed` / `archived`
- `proposals.status`: `draft` / `sent` / `viewed` / `accepted` / `declined`
- `agreements.status`: `sent` / `signed` / `voided`
- `invoices.status`: `unpaid` / `paid` / `overdue`

⚠️ **`tasks.status` and `clients.stage` both use "active" but are unrelated.**
Never conflate them.

**Routes:** `/portal` (client app, `ClientPortalApp`, `client_users` login
only, magic-link — never routes through `AuthGate`/`ensureProfile`).
**Internal nav (founder):** Today · Meetings · Tasks · Leads · Systems ·
Marketing · Automation Web · Reporting · Companies · Playbook · My Team ·
Settings (via username at sidebar bottom, not a nav row item).
**Internal nav (team):** Today · Tasks · Leads · Systems · Marketing ·
Automation Web · Reporting · Companies · Playbook · Career Path · Settings.
Leads/Marketing/Reporting/Systems are hidden for contractor-only profiles.
Career Path is deliberately team-only, not shown to founders. Proposals /
Agreements / Invoices / Brand Kit / Templates / Team & Roles / Testimonials
are real and built but nested inside Companies (not top-level nav) — see
`claude/nav-and-discoverability-spec.md`.

## Already Built — Don't Re-spec or Rebuild

- Migrations `0001`–`0006` (schema + RLS lockdown + client-scoped RLS) in `supabase/migrations/`
- `api/invite-client.ts`, "Invite to Portal" button (in `ClientModal`, `src/DashboardApp.tsx`)
- `client_owns()` / `is_team_member()` RLS helper functions
- `projects` table + `/portal` read-side (`src/ClientPortalApp.tsx`)
- **Milestone 1: Project Management UI** — `CreateProjectModal`/`ProjectModal` in `src/DashboardApp.tsx` (nested in `ClientModal`'s new Projects section), `useProjects`/`createProject`/`updateProject`/`resolveProfileIdByName` in `src/useDatabase.ts`. Also fixed a pre-existing bug where `TaskCreateModal` never actually saved the selected assignee.
- **Milestone 2, Phase A: Brand Kit** — migration 0008, `BrandKitEditModal` (opened from `CompanyModal`), and the first fully public no-login page in this app: `/brand/{share_slug}` (`src/BrandKitShareView.tsx`). Google Drive OAuth (Phase B) is not started — blocked on the user creating credentials in their Google Cloud project; see `claude/roadmap.md` for the exact steps and the ready-to-execute build design.
- `api/chat.ts` — AI task assistant (separate feature, unrelated to the client lifecycle work)
- `mcp-server/` — separate MCP integration for Claude Code, not part of the web app
- **Client Portal Expansion, Phase 1: Multi-tenant foundation** — `company_members` join table (profile ↔ company, many-to-role membership) layered on top of `companies` as the real tenant table; `is_company_member()`/`is_company_member_via_client()`/`is_company_member_via_project()`/`is_company_member_via_generated_document()` helper functions; `team_full_access` RLS rewritten from blanket `is_team_member()` to company-scoped across every client/business-data table. New tables: `leads`, `deliverables`, `comments` (client-facing, distinct from internal `messages`), `automations`, `testimonials`. New `tasks.client_visible` column (default `false`), gating the client task-read policy. Full design rationale and the empirical isolation-test result in `claude/roadmap.md`'s "Schema decisions resolved" section. Migrations `0012`–`0014`.
- **Client Portal Expansion, Phases 2–17: everything else** — client magic-link login, proposal e-signature + Stripe deposits, post-acceptance onboarding forms, deliverables checklist, comment threads/billing/files, offboarding + testimonial/referral capture, CRM leads pipeline + client roster, the `client_visible` toggle wired end-to-end, a 2-automation engine (deliverable approved, project completed), a proposal/contract template manager, Resend email marketing, a social media planner, team roles/permissions, a plain-counts reporting dashboard, the public marketing site (built separately, see below), and white-label org signup + plan gating. One dated entry per phase in `claude/roadmap.md`'s "Schema decisions resolved" section — read there before touching any of it, especially the "untested pending your action" items (Stripe/Resend API keys, custom-domain routing, real billing) called out in this file's Current Priority section above.

## Current Priority

**✅ CLIENT PORTAL EXPANSION — ALL 17 PHASES BUILT (2026-07-22).** The full
three-tier Public/Client/Internal expansion (`claude/client-portal-
expansion-spec.md`), full multi-tenant from day one, built as one
continuous push per the founder's direction. Every phase's real scope
decisions, deliberate deferrals, and honest gaps are logged in
`claude/roadmap.md`'s "Schema decisions resolved" section (search for
"Client Portal Expansion Phase" — one dated entry per phase, in order).
**What's built but genuinely untested, pending your action:**
- Phase 3 (Stripe deposits) needs `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` in Vercel env vars + the webhook registered in the Stripe dashboard.
- Phase 12 (Resend email) needs `RESEND_API_KEY`/`RESEND_FROM_ADDRESS`/`CRON_SECRET` in Vercel env vars.
- Phase 17 (white-label) shipped org signup + plan-gating schema, but custom-domain routing is schema-only (no hostname-based tenant resolution yet) and there's no real billing to move a company off the `starter` plan.

**Operational note from this build:** Vercel's Hobby plan caps a deployment
at **12 serverless functions**. `api/*.ts` (excluding `_lib/`) is at exactly
12 right now — a hard-learned lesson mid-build (Phase 12 failed to deploy
at 14). Any new endpoint needs either a merge of two existing ones first, or
confirming the plan has been upgraded. Prefer the RPC/direct-RLS pattern
(Phases 13, 15, 17's org signup) over a new serverless function when a
feature doesn't strictly need one.

The still-open Google Drive OAuth (Milestone 2 Phase B) and the rest of the
13-milestone roadmap below are not abandoned — resume them now that the
expansion has landed.

Full 13-milestone roadmap + the detailed schema plan for the Proposal
Generator milestone: `claude/roadmap.md`. Do not start a milestone out of
order without checking that doc's dependency notes first.

## Architectural Non-Negotiables

- **Files live in Google Drive, not our database.** Generated documents
  (proposals, freebies, etc.) get written to the company's own Google
  Drive; we store only a reference (`gdrive_file_id`). This is intentional
  — a founder who stops using the platform must still walk away with
  everything. Do not "simplify" this by moving file storage into our own DB.
- **✅ IMPLEMENTED (2026-07-22) — supersedes the line below:** gamification
  (XP/points, levels, streaks, kudos, a real Career Path view) is built and
  live, scoped to the Career Path and My Team pages only — never the Today/
  home dashboard. `useDatabase.ts` exports `XP_BY_IMPACT`
  (`small:5, medium:10, large:20`) and `LEVEL_XP_THRESHOLD` (`200`), plus a
  new `awardPoints(userId, taskId, impact)` helper that inserts a
  `points_log` row and rolls `profiles.xp`/`profiles.level` forward
  (subtracting 200 and incrementing level per threshold crossed).
  `completeTask()` calls `awardPoints()` automatically on completion
  (idempotent — won't double-award if a task is already completed), and the
  founder-approval completion path (`handleSendKudos`) now routes through
  the same `completeTask()` call so points are awarded consistently
  regardless of which completion flow is used. `CareerPathPage` in
  `DashboardApp.tsx` renders a level ring, XP progress bar, a computed
  day-streak badge (`computeStreak()`, consecutive-day calc off
  `completed_at` dates), This Week/Month/All-Time/Total-Points stat cards,
  a kudos-received feed (kudos messaging already existed via `messages`
  rows with `is_kudos: true` — no new work needed there beyond surfacing
  it), and a completed-task history list. `MyTeamPage` was also fixed to
  read real `profiles.xp`/`level` per member (was previously faked from
  `(completed.length * 5) % 200`) and to source completed tasks from a
  dedicated `useTasks({ status: "completed" })` fetch, since the main
  `useTasks()` call only ever fetches `focus`/`active`/`submitted` tasks
  and always excluded completed ones (pre-existing bug, now fixed).
  Reference `legacy-gamified-internal-ui` on GitHub for the original
  design inspiration, but the current implementation is a from-scratch
  rebuild against this codebase's schema — not a merge or port.
- ~~The home dashboard must stay calm, not gamified. No streaks, badges,
  or red notification counts — ever.~~ **Superseded above** — gamification
  is wanted, just scoped thoughtfully rather than dominating the main Today
  view. Default state of the *Today* view specifically should still favor
  reassurance ("all clear") over anxiety-inducing red counters; that part
  of the principle stands. Surface at most one gentle suggested action at a
  time, dismissable without penalty.
- **Brand Kit is a shareable reference surface, not a settings form.**
  One-click copy on hex codes/font names, downloadable logo assets, a
  presentable `/brand/{slug}` view.
- **✅ REVERSED (2026-07-22):** multi-tenancy is now an active, explicit goal
  — the founder chose "full multi-tenant from day one" over the deferred
  single-tenant path. Build real `org_id`-scoped RLS, not just a
  `company_id` column with a single default row. `companies` is the real
  tenant table (the spec's proposed `organizations` table is redundant with
  it — extend `companies`, don't create a parallel table, unless a session
  finds a concrete reason `companies` can't carry the tenant-config load).
  See `claude/client-portal-expansion-spec.md` for the full spec and its
  reconciliation note against the live schema. The original caution here
  still applies in spirit even though the decision reversed: RLS is
  security-critical and untested against a real second tenant, so verify
  policies with `get_advisors(type="security")` after every migration, and
  do not consider tenant isolation "done" until a real second `companies`
  row (test data is fine) has been used to confirm rows don't leak.
- **✅ UPDATED (2026-07-22):** the founder has explicitly authorized Claude
  to write AND apply schema/RLS migrations directly against the live
  database (via the Supabase connector's `apply_migration`), rather than
  handing off `.sql` files for her to run manually. This project still has
  no staging environment and the database is still live and in daily use
  — so extra care remains warranted: verify column/table assumptions
  against the live schema with a read-only query *before* writing a
  migration, keep changes additive wherever possible, run
  `get_advisors(type="security")` after applying to confirm no new RLS
  gaps were introduced, and still save every migration to
  `supabase/migrations/` in the repo (for history/review) even though it's
  applied immediately rather than queued for manual execution.

## Visual Design System

**2026-07-22:** the "full-boldness" ember/forest/cream redesign (pill
buttons, dark forest sidebar, ember-remapped teal scale, Cormorant
Garamond serif headlines) was tried, and the pill-button/dark-sidebar/serif
parts were undone at the founder's request. **Correction (2026-07-23):**
this doc previously claimed the color scheme was also reverted to an
original teal (`#1B7E70`/`#15685D`) — that revert never actually landed in
`index.html`. The forest-green remap from that redesign (`teal-600:
#1F7A52`, `teal-700: #175F40`) is still live, and the founder has since
confirmed (2026-07-23) she wants to **keep it** — this is the real, kept
baseline color, not a leftover to fix. Light neutral background, Plus
Jakarta Sans throughout, `rounded-xl` buttons/cards. As of the Stage System
Buildout (`claude/stage-system-buildout-spec.md`), this forest-green is
specifically **Stage Two's** color — Stage One (purple) and Stage Three
(blue) get their own palettes, with the whole app chrome shifting between
them based on the active company's stage. Don't re-introduce the
pill-button/dark-sidebar ember redesign without the founder explicitly
asking for it again.
- **Still open:** Sierra's real brand display font is "Spicy Margarita"
  (hand-script/display style) — she's uploaded the .woff file in
  conversation but it has not been wired into the app yet. Likely
  candidate: the "Backstage" wordmark / headline moments, not body text —
  confirm placement with her before wiring it in.

## Reference Docs (in `claude/` — read before big features)

- `claude/client-portal-expansion-spec.md` — **current top priority**, see above. Three-tier Public/Client/Internal expansion spec, full multi-tenant from day one. Read its "Reconciliation note" section first.
- `claude/vocabulary-reference.md` — full terminology authority, current build status detail
- `claude/roadmap.md` — the 13-milestone build sequence + resolved schema decisions + the detailed Proposal Generator (milestone 5) plan
- `claude/saas-feature-spec.md` — the full template/systems/dashboard feature spec (source document the roadmap was built from)
- `claude/platform-spec.md` — original three-view architecture concept (defer to `roadmap.md` and `vocabulary-reference.md` on any naming conflict)
- `claude/backstage-os-philosophy.md` — the founder's Values Charter, Onboarding Philosophy, Dashboard Guardrail, and Build Pack Ethical Constraint. Locked rules; check every new feature against this.
- `claude/automation-web-build-spec.md` — **in progress, sent to the dev agent 2026-07-23.** Spec for the Automation Web feature: a visual, chainable canvas over the existing `automations` table. Builds a real, generic, chainable engine (not a UI skin over hardcoded automations), but execution stays bounded to a fixed set of vetted trigger/action-type handlers — never arbitrary founder-authored logic. Also specs the `company_members.departments` addition (additive column, does not touch the existing founder/team/contractor role or its RLS/nav-gating). `src/features/automation-web/` already has files in progress — check current state before assuming anything here is unbuilt.
- `claude/nav-and-discoverability-spec.md` — **not yet built (2026-07-23).** Sticky sub-nav for `CompanyModal`'s stacked sections (Brand Kit/Templates/Team & Roles/Testimonials are real but easy to miss), a visible Settings entry point, and a proposed founder-only action list for nested company/client actions. Nothing here is a missing feature — it's a "the thing exists but you can't find it" pass.
- `claude/stage-system-buildout-spec.md` — **not yet built (2026-07-23).** Gamified Company Stage buildout: fills in missing Stage One systems and seeds real Stage Three systems (currently empty) from the founder's original notes, lets a `template_type` reappear at multiple stages "in further detail" (schema change to `system_unlocks`' unique constraint), whole-app stage-colored theming (Stage One purple / Stage Two the kept forest-green / Stage Three blue) via CSS variables — no changes needed to the 241 existing `teal-*` Tailwind class sites — driven by a new global company switcher (`profiles.active_company_id`), per-system-completion confetti alongside the existing stage-transition confetti, and a new `stage_progress` type on the existing `safety_net_nudges` mechanism for "push the needle" suggestions. Read in full before starting.

## Working Agreement

- Keep each session scoped to one milestone. Don't let "build the intake
  wizard" quietly become three sessions of work in one — flag when a
  request is really multiple pieces.
- After building something, state plainly what was tested vs. what's
  untested.
- If a request conflicts with an architectural non-negotiable above, say so
  before building — don't silently work around it.
- When a milestone's design surfaces a real gap or contradiction in the
  spec docs (as has already happened a few times), resolve it, then update
  `claude/roadmap.md` to reflect the resolution — these docs should stay
  accurate, not frozen at time of writing.
