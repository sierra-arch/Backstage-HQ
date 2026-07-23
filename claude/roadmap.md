# Backstage SaaS — Master Roadmap (Template Engine + System Engines + Home Dashboard)

## Context

`saas-feature-spec.md` describes a template/document engine (Brand Kits,
Proposals, Freebies, New Hire Packets, etc.) plus five system engines
(Digital Hub, Client Journey, Marketing, Sales, Infrastructure) plus a "Home
Dashboard" front door — all sitting on top of the Foundation + Client Portal
work already built (migrations 0001–0006, `/portal`, `api/invite-client.ts`).
This is not a single build — it's a multi-month roadmap. This doc sequences
it into milestones (each sized like the Foundation/Client Portal milestones
already shipped — its own planning-and-build pass), resolves the schema
questions raised during review, and fills gaps found in the spec.

## Schema decisions resolved

**Multi-tenant foundation (2026-07-22, Client Portal Expansion Phase 1).**
`companies` is the real tenant table, per `CLAUDE.md`. Resolved gap: Sierra's
team currently works across all 3 of her companies (Prose Florals, Backstage,
Mairë) from one login with no company scoping at all (`is_team_member()` had
zero tenant awareness). Rather than making each company a hard isolation
boundary (which would've broken that unified cross-company workflow), added
`company_members` (profile ↔ company, many-to-many, with role) as the
membership layer on top of `companies` — not a parallel `organizations`
table. All 4 existing profiles were backfilled into all 3 existing companies,
preserving current behavior exactly. A new tenant/founder signing up in the
future gets membership in just their own company, giving genuine isolation
between different founders' accounts while Sierra keeps her unified view.
New helper functions: `is_company_member(company_id)`,
`is_company_member_via_client(client_id)`, `is_company_member_via_project
(project_id)`, `is_company_member_via_generated_document(client_id,
template_id)`. `team_full_access` policies were rewritten from
`is_team_member()` to these across every table holding client/business data
(companies, tasks, notes, meetings, products, goals, sops, company_goals,
projects, document_templates, brand_kits, clients, proposals, agreements,
invoices, payment_schedules, payment_installments, intake_responses,
client_users, generated_documents). Deliberately left out of company scoping
for this phase: `profiles`, `messages`, `points_log`, `activity_log`,
`goal_updates`, `accomplishments`, `sop_categories` — none carry client/
business data, so they're person-level or shared-taxonomy tables, not tenant
isolation risk surface. Revisit if real second-tenant usage ever exercises
them. Isolation verified empirically (per `CLAUDE.md`'s non-negotiable) with
a temporary second `companies` row inside a rolled-back transaction —
confirmed a real profile's membership functions correctly grant access to
its own 3 companies and deny the test company. New tables added (reconciled
gaps from `client-portal-expansion-spec.md`): `leads`, `deliverables`,
`comments` (client-facing threaded, distinct from internal `messages`),
`automations`, `testimonials`. Also added `tasks.client_visible` (default
`false`) and gated the existing (previously unrestricted) client task-read
policy behind it, since that policy was already being touched in this pass —
the internal toggle UI for it is still open (Client Portal Expansion Phase
9). Migrations: `0012_company_members_and_new_tables`,
`0013_company_scoped_rls`, `0014_company_members_rls`.

**E-signature + Stripe deposit (2026-07-22, Client Portal Expansion Phase 3).**
Migration `0015_agreement_signature_capture` adds `agreements.signed_name`/
`signed_ip` (lightweight capture, not a paid e-sign vendor — typed full name
+ server timestamp via existing `signed_at` + IP from `x-forwarded-for`).
`submit-proposal-selections.ts`'s accept path now also creates an
`agreements` row (status `sent`) — the accepted proposal itself is the terms
being signed; no separate contract-document generation yet (that's the
template-manager phase). New endpoints: `api/sign-agreement.ts` (client
signs, same trust-boundary shape as the rest of this file — client never
gets direct table write access), `api/create-checkout-session.ts` (Stripe
Checkout, not Elements — creates/reuses an `invoices` row per installment,
never trusts a client-sent amount), `api/stripe-webhook.ts`
(`checkout.session.completed` → marks invoice + installment paid, raw-body
signature verification via `export const config = { api: { bodyParser:
false } }`). Both the client portal's `ProposalCard` and the internal
`ProposalDetailModal` now show live agreement/payment status instead of the
old disabled placeholders. **Untested — needs your Stripe API keys**:
`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` must be set in Vercel's
environment variables, and the webhook endpoint (`/api/stripe-webhook`)
registered in the Stripe dashboard, before a real checkout/webhook round
trip can be verified end-to-end.

**Post-acceptance onboarding form (2026-07-22, Client Portal Expansion
Phase 4).** Extends the existing `document_templates` mechanism (same table
the proposal engine uses) rather than building a parallel form system, and
deliberately does not touch the pre-sale `IntakeWizard.tsx`/
`api/submit-intake.ts` (`/intake/{slug}`) — that's a different moment in the
journey (anonymous lead qualification) from this (an authenticated client
with an active project). New template type `onboarding` (migration
`0016_onboarding_templates`), structure shape `{ questions: [{ key, label,
kind }], task_templates: [{ title, description }] }`. `projects` gets
`onboarding_completed_at`/`onboarding_responses`. Client portal shows an
`OnboardingForm` card on any project missing `onboarding_completed_at`;
`api/submit-onboarding.ts` sanitizes answers down to only the template's own
question keys (never trusts arbitrary client-sent keys), saves them, and
auto-creates the template's `task_templates` as real tasks on the project —
additive to (not a replacement for) the existing proposal-acceptance kickoff
tasks (`api/_lib/projectAutomation.ts`), tagged with a distinct
`metadata.trigger: 'onboarding_submitted'`. One default template seeded for
Prose Florals by hand (event address, delivery window, day-of contact,
allergy notes). **Deliberately out of scope**: a template *editor* UI for
onboarding templates — teams create them the same way the first proposal
template was seeded (direct insert), matching Milestone 5's precedent; a
real editor is Client Portal Expansion Phase 11's job (template manager),
not this one.

**Comment threads, billing history, files (2026-07-22, Client Portal
Expansion Phase 6).** Comments use direct client-write RLS (unlike
proposals/deliverables) — both team and client post through the browser
client under their own session, no service-role endpoint needed. Real gap
found while wiring this: `src/TaskModals.tsx` (a `TaskModal`/
`TaskCreateModal` pair) and its local `type DBTask` are **dead code** — not
imported anywhere. `src/DashboardApp.tsx` has its own separate local
`TaskModal` (line ~590) and local `type DBTask` (line ~90) that are what's
actually rendered; that's where the client-comment-thread UI actually needed
to go. `src/types.ts` has a third `DBTask` export that's also live (used
elsewhere) but was drifting out of sync with DashboardApp's local copy. All
three now carry `client_id`/`client_visible` so this doesn't bite Phase 9.
Didn't delete `TaskModals.tsx` this pass (out of scope for this phase — flag
for whoever next touches task UI to confirm it's safe to remove). Billing:
client portal reads `invoices` directly (already RLS-scoped via
`client_reads_own`). Files: Google Drive OAuth (Milestone 2 Phase B) is
still not built, so this is a read-only links list — any `deliverables` or
`generated_documents` row with a `gdrive_file_id` renders as a link to
`https://drive.google.com/file/d/{id}/view`, no upload/embed UI yet.

**Offboarding: testimonial + referral capture (2026-07-22, Client Portal
Expansion Phase 7).** `OffboardingCard` in the client portal appears once a
client has any project with `status = 'completed'`. Testimonials:
`api/submit-testimonial.ts` always inserts `is_approved: false` — the team
reviews/approves in a new `TestimonialsSection` inside `CompanyModal`
(approve + feature checkboxes), which is what flips a testimonial into
`PublicSite.tsx`'s `TestimonialWall` (public, `is_approved = true` only).
Added migration `0017_testimonials_client_read_own` (client read RLS was
missing — a client couldn't see their own pending submission before
approval, so the portal had no way to show "thanks, awaiting review" instead
of re-prompting for a second one). Referrals: `api/submit-referral.ts`
writes into the same `leads` table the public inquiry form and Phase 8's CRM
pipeline use (`source: 'referral'`), not a separate referrals system — one
CRM entry point. **Deliberately deferred to Phase 10** (automation engine):
auto-triggering the testimonial/referral request itself when a project
flips to `completed`, and any email send around it — this phase only builds
the capture surfaces and storage, since email delivery isn't wired until
Phase 12 (Resend).

**CRM pipeline + client roster (2026-07-22, Client Portal Expansion
Phase 8).** New internal nav item "Leads" (both founder and team — sales
nurturing isn't founder-only) rendering a `LeadsPage` local component (same
"defined locally in DashboardApp.tsx, not the separate-file version"
pattern flagged in Phase 6 — confirmed `src/CompaniesPage.tsx` is *also*
dead code, same as `TaskModals.tsx`; DashboardApp.tsx has its own local
`CompaniesPage`). No drag-and-drop — `dnd-kit` is a listed dependency but
genuinely unused anywhere in `src/`, so rather than being the first thing to
wire it up mid-build, the kanban uses simple "Move to X →" buttons per
column transition, consistent with this codebase's existing `<select>`
-based status-change pattern (e.g. `ProjectModal`). Converting a lead to a
client (`convertLeadToClient`) creates a real `clients` row at `stage:
'lead'` and links `leads.converted_client_id` — one record flow, not two
disconnected ones. Client roster shows active/delivered clients with a
gentle two-state health badge (`projectHealth()`: "On hold" or "Delivery
approaching" in amber, "On track" in green — deliberately no red, per the
mission's affirmative-not-alarming principle) computed from `projects.status`
+ `target_delivery_date` proximity only (no per-task overdue query, to keep
this cheap).

**client_visible toggle, end-to-end (2026-07-22, Client Portal Expansion
Phase 9).** Real gap closed: `TaskCreateModal` (the actual live one, in
`DashboardApp.tsx`) built tasks with `project_id` but never derived
`client_id` from the selected project, even though the client-visibility RLS
policy (`client_reads_own_project_tasks`, from Phase 1) keys off
`project_id → projects.client_id`, not `tasks.client_id` directly — so the
toggle would have worked but the Phase 6 comment threads (gated on
`task.client_id`) silently wouldn't have, for any task created through the
normal UI. Fixed: `client_id` is now resolved from the selected project at
creation time. Both `TaskCreateModal` (checkbox, only shown once a project
is picked) and `TaskModal` (checkbox on any project-linked task, calls
`updateTask` + the parent's task-list `refetch`) can set it. Default stays
`false` (opt-in disclosure, per the Phase 1 design) — kickoff/onboarding
auto-created tasks (`projectAutomation.ts`, `submit-onboarding.ts`) are
intentionally left at that default; the team decides per task, nothing was
made client-visible automatically.

**Automation engine (2026-07-22, Client Portal Expansion Phase 10).** Two
new hardcoded automations, per the explicit instruction not to build a
generic trigger/condition/action interpreter — the `automations` table
(Phase 1) stays unused by these for now, a deliberate scope decision, not an
oversight; it's there for Phase 11+ when a real on/off UI might use it.
1. **Deliverable approved → notify**: `api/respond-deliverable.ts`'s
   approve path now messages every founder of the deliverable's company.
2. **Project completed → advance client stage + notify**: `ProjectModal`'s
   status handler, on transition to `completed`, advances the linked
   client's `stage` from `active` → `delivered` (the next Client Journey
   stage — nothing previously did this; `active` was the last automated
   stage transition, set on proposal acceptance) and notifies founders.

Both share `notifyFounders()` (`useDatabase.ts`) — messages the existing
messaging system's **unread badge** actually tracks
(`getUnreadMessageCount()` only counts `to_user_id = auth.uid()`, never
broadcast/`to_user_id: null` messages), so `from_user_id` is set to the same
founder being notified rather than a broadcast that would silently never
badge. **"Proposal signed → project + tasks" was already live** (built pre-
Phase-10, in `submit-proposal-selections.ts`/`projectAutomation.ts`) — no
changes needed there. **"Project completed → testimonial/referral"
already fires reactively**, no explicit trigger code needed: Phase 7's
`OffboardingCard` checks `project.status === 'completed'` on every portal
load, so once this phase's stage-advance lands, the capture surfaces just
appear next time the client visits — the founder-notify above is what's
actually new here. Real email delivery (an actual "we'd love your
testimonial" email) still waits on Phase 12 (Resend).

**Template manager (2026-07-22, Client Portal Expansion Phase 11).** A
structured, form-based editor for `document_templates.structure` — not the
drag-and-drop visual builder Milestone 5 explicitly deferred as a separate
undertaking, but a real working CRUD UI (`TemplateManagerModal` /
`TemplateEditorModal`, opened via a new "Templates" button next to Brand Kit
in `CompanyModal`). Covers all four section types the proposal engine
understands (`design_brief` — the "variable fields" a proposal collects per
client; `line_items`; `payment_rules`; `contract`), matching
`proposalEngine.ts`'s `TemplateSection` union exactly so anything built here
renders correctly in both the internal `ProposalDetailModal` and the client
portal's `ProposalCard`. Teams no longer need a direct-DB-insert session to
create or edit a template — that precedent (how Prose Florals' first
proposal template was seeded) is no longer the only path.

**Email marketing (2026-07-22, Client Portal Expansion Phase 12).** New
"Marketing" nav item. Broadcasts: compose → save draft → "Send Now"
(`api/send-broadcast.ts`, one email per recipient via Resend, never a
single multi-recipient send) to a segment (`all_clients` / `active_clients`
/ `leads`) — that segment picker doubles as the "segmentation" requirement.
Sequences: multi-step drips with **manual enrollment by email** (migration
`0019` relaxed the original lead/client-linked-only constraint — the
sending logic only ever reads the `email` column, so requiring a
pre-existing record was pure friction), processed daily by a new Vercel
cron job (`api/cron/process-email-sequences.ts`, registered in
`vercel.json`'s `crons`, protected by `CRON_SECRET` which Vercel auto-sends
as a bearer token on scheduled invocations). No auto-enrollment trigger
(e.g. "new lead → auto-join welcome sequence") — matches this build's
"hardcode 2-3 automations, not a generic builder" posture applied to
marketing too; that's a real gap to revisit if it turns out to matter.
**Untested — needs your Resend API key**: `RESEND_API_KEY` (and ideally
`RESEND_FROM_ADDRESS` once a sending domain is verified — defaults to
Resend's own `onboarding@resend.dev` otherwise) must be set in Vercel env
vars, and `CRON_SECRET` should be set for the cron endpoint to be
authenticated, before a real send or a real scheduled sequence step can be
verified end-to-end.

**Hotfix: Vercel Hobby's 12-function cap (2026-07-22, between Phase 12 and
13).** Phase 12's push failed to deploy — `npx vercel inspect --logs`
showed the Vite build completing fine, then a bare `Error` right at
"Deploying outputs," which is where Vercel provisions serverless functions.
`api/*.ts` (excluding `_lib/`) had grown to 14 files; Hobby plan caps a
deployment at 12. Fixed by merging two pairs of same-shaped client-portal
endpoints: `submit-testimonial.ts` + `submit-referral.ts` →
`submit-offboarding.ts` (`type: 'testimonial'|'referral'` in the body), and
`sign-agreement.ts` + `respond-deliverable.ts` → `respond.ts` (`type:
'agreement'|'deliverable'`). Back to exactly 12 — no headroom left, so the
next new endpoint (Phase 13 onward) needs either another merge or confirming
the plan has been upgraded before assuming a new file is free.

**Social media planner (2026-07-22, Client Portal Expansion Phase 13).**
Calendar + drafts only, no third-party posting API, per instruction. New
`social_posts` table, team-RLS-only (`is_company_member`) — this needed
**no new serverless function** at all, since the team writes directly via
their own session, same as tasks/notes/goals/etc. Given the function count
is pinned at exactly 12 (see the hotfix note above), that matters: any
future internal-only feature should default to this same direct-RLS
pattern rather than an API route, to avoid immediately re-hitting the cap.
UI lives as a third panel in the "Marketing" page (`SocialPlannerPanel`) —
a real month-grid calendar (prev/next navigation, click a day to add a
post, click a post to mark it posted or delete it) plus an "Unscheduled
Drafts" list for posts with no date yet.

**Team roles/permissions (2026-07-22, Client Portal Expansion Phase 14).**
The three-tier role model (`founder`/`team`/`contractor`) already existed
at the schema level (`company_members.role`, from Phase 1) but had no UI and
no enforcement anywhere. Added: a `TeamManagementSection` in `CompanyModal`
(founders only — `company_members` RLS only returns every row to founders
of that company, so a `members.length <= 1` result is the normal signal for
"you're not a founder here," not a bug) letting a founder change any
existing member's role via dropdown. Enforcement: `fetchIsContractorOnly()`
hides the Leads and Marketing nav items for a profile whose company_members
rows are *all* `contractor` (no founder/team role anywhere), matching the
roles matrix's "❌ for Contractor" on email marketing / automations / CRM.
**Real gap, deliberately deferred**: there is no "invite a brand-new team
member" flow (would need a new endpoint like `api/invite-client.ts`'s
`auth.admin.inviteUserByEmail`, but the function count is pinned at exactly
12 — see the Hobby-plan hotfix note above — so adding one means merging two
existing endpoints first). Today, growing a team still means the founder
manually creating the `profiles` row (existing signup flow) and then a
`company_members` row by hand; role *changing* for existing members is the
part this phase actually built. Also worth flagging: this permission model
checks "does this profile have elevated access to ANY company," not
per-company — a genuine structural limitation, since the internal dashboard
shows cross-company aggregated views everywhere rather than being scoped to
one company context at a time. A contractor who's also a team member
somewhere else would see the full nav. Revisit if/when a real second
tenant's contractor usage exposes this as an actual problem.

**Reporting dashboard (2026-07-22, Client Portal Expansion Phase 15).** New
"Reporting" nav page (hidden for contractor-only profiles, same mechanism
as Phase 14's Leads/Marketing gating). Plain counts only, no scores or
comparisons — reuses `BusinessSnapshot`'s existing stat-tile pattern (icon +
raw value + label, no percentages, no red) for revenue (paid this month,
paid all-time, unpaid, overdue — summed straight from `invoices`), a
Pipeline card (lead counts per stage, same five columns as the Leads kanban
but as static counts), and a Workload card (active-task count per team
member). No new serverless function — reads `invoices`/`leads`/`tasks`
directly under existing team RLS, consistent with Phase 13's lesson about
the function-count cap.

**White-label — final Client Portal Expansion phase (2026-07-22,
Phase 17).** Four sub-requirements, each landed at a different level of
completeness:
1. **Org onboarding wizard — done, via reuse not rebuild.** New public
   route `/get-started` (`OrgSignupWizard.tsx`): standard anon-key
   `auth.signUp()`, then a new `signup_new_org()` Postgres RPC (SECURITY
   DEFINER, same anon-executable-but-internally-guarded pattern as
   `is_company_member` etc.) atomically creates the `profiles` +
   `companies` + founder `company_members` rows so a failure partway
   through can't orphan one without the others. Needed **no new serverless
   function** (the RPC runs through PostgREST directly) — worth remembering
   for future phases now that the function count is pinned at 12. Real
   insight that shrank this task a lot: `DashboardApp.tsx` already
   auto-fires `OnboardingWizard.tsx` (the "purpose/who/how/boundaries/
   vision + brand + first client + witness statement" ritual) for any
   company with `onboarding_completed_at` null — since a freshly-signed-up
   company starts with that column at its default (null), the existing
   ritual just fires on first login. Nothing about that ritual needed
   rebuilding or mirroring; it was already generic per-company, not
   hardcoded to Sierra's businesses.
2. **Brand config UI — already existed, not rebuilt.** `brand_kits` +
   `BrandKitEditModal` (Milestone 2 Phase A) already cover this. The
   spec's "rename Seed → Sprout → Bloom tier names" idea doesn't map to
   anything actually built (gamification here is numeric XP/levels, not
   named tiers) — not chased as a phantom feature.
3. **Plan gating — real but shallow.** `companies.plan` (`starter` |
   `growth` | `pro`, default `starter`; Sierra's 3 existing companies
   backfilled to `pro` so nothing newly gates for her). Email marketing
   (broadcasts + sequences) is gated behind `plan !== 'starter'` with an
   upgrade message; the social planner stays available on every plan.
   **No billing exists** — `plan` is just a column a founder could
   currently only change via direct DB access; there's no Stripe
   subscription flow to actually let a `starter` org pay to become
   `growth`. That's a materially bigger feature (recurring billing, not a
   one-off Checkout session like Phase 3's deposits) and is explicitly
   out of scope here.
4. **Custom domain support — schema-only, not wired.** `companies
   .custom_domain` (nullable, unique) exists so a value can be stored, but
   nothing resolves incoming requests by hostname to the right tenant —
   every public/portal route today resolves tenancy by slug in the URL
   path (`/site`, `/intake/{slug}`, `/brand/{slug}`), not by domain. Real
   hostname-based routing needs a Vercel Edge Middleware layer and, more
   fundamentally, an actual domain the user owns pointed at Vercel to ever
   test against — same "can't verify without your infrastructure" shape as
   Phase 3's Stripe keys and Phase 12's Resend key, except here the gap is
   the routing code itself, not just missing credentials.

**Company Stage system — Phases 19–21 (2026-07-22, Post-Expansion build).**
A hand-off spec ("Phase 18+") arrived proposing a company-level "Stage
One/Two/Three" progression system. Two of its premises didn't survive
verification against the live codebase: (1) there is no floral-tier XP
system to migrate away from — grepped `src/`/`claude/`/`CLAUDE.md`; the
tier names only ever appeared as a "someday" idea in two spec docs, already
flagged unbuilt in Phase 17's own roadmap note; (2) XP/Level
(`profiles.xp`/`level`) is per-*person* (task-completion reward, scoped to
Career Path/My Team), not per-company — `companies` never had an XP column
to backfill from. Confirmed with the founder before building: Stage is a
**real, new, per-company concept** (not a rename), and Level/Stage stay
**deliberately separate** — different subjects (a person vs. a company),
shown on different pages, never merged into one badge.

- **Phase 19**: `companies.current_stage` (`one`/`two`/`three`, default
  `one`). No `stage_level` column — the original spec's rationale for one
  ("replaces old floral-tier XP level") was moot once (1) above was
  confirmed; progress within a stage is computed from `system_unlocks`
  completion instead (see Phase 21), not tracked as a redundant integer.
  Seeded per the founder's explicit, non-uniform answer — **not** "start
  everyone fresh" or "everyone's already unlocked": Mairë = Stage One,
  Prose Florals = Stage Two, Backstage = Stage One (her stated goal for
  Backstage is Stage Three, but she wants it to earn that for real rather
  than start there).
- **Phase 20**: extended `document_templates.type` with 4 new Stage One
  values — `vision_mapping`, `sales_script_milestones`,
  `branding_essentials`, `policies_checklist` — same pattern as Phase 4's
  `onboarding` type, no new table. Naming disambiguation (a judgment call,
  not asked about): `branding_essentials` instead of a literal
  `branding_kit` type, since that would collide with the already-built
  `brand_kits` *table*; `policies_checklist` instead of overloading the
  existing `policies_sheet` type, which is a different thing (a reference
  doc, not a checklist).
- **Phase 21**: `system_unlocks` (company × template_type × stage × status)
  and `stage_transitions` (offer/accept ritual) tables. Two RPCs, no new
  serverless function: `check_stage_completion(company_id)` — inserts a
  `stage_transitions` offer once every current-stage `system_unlocks` row
  is `complete`; `accept_stage_transition(id)` — advances
  `companies.current_stage` and flips the new stage's `locked` rows to
  `available`. **Security fix applied same-session**: both RPCs were
  initially written with zero caller-authorization check (unlike
  `signup_new_org`, which does check) — any anon or unrelated authenticated
  caller could have advanced any company's stage. Both now call
  `is_company_member()` before doing anything; verified the fix rejects an
  unrelated caller inside a rolled-back transaction. Seeded Stage One
  `system_unlocks` per company (`complete` for Prose Florals, which already
  passed Stage One; `available` for Mairë/Backstage) plus **Stage Two
  placeholder systems** (New Hire Packet, Freebie Funnel — reusing the
  already-existing `new_hire_packet`/`freebie` template types, no new type
  needed) per the founder's explicit "build placeholders now" answer, so
  the Stage Two invitation reveals something real rather than an empty
  page. UI: new "Systems" nav page (hidden for contractor-only profiles,
  same mechanism as Leads/Marketing/Reporting) shows the current stage's
  systems with Start/Mark-Complete actions (creating/completing the
  underlying `document_templates` row), the pending-offer invitation card
  (accept → RPC + confetti; decline → local-only dismiss, no persisted
  "declined" state, matches "declining is a no-op, nothing forced"), and a
  single one-line "next up" teaser for the following stage — deliberately
  not the full roadmap, per the philosophy doc's progressive-disclosure
  principle. Existing operational nav (Tasks/Leads/Marketing/etc.) is
  **not** stage-gated — only this new Systems page is; gating the whole app
  behind stage completion would have broken Prose Florals' actual day-to-
  day Marketing usage.
- **Verified live, not just built**: used the Supabase service-role key to
  generate a real magic-link session for the founder (legitimate use of
  admin credentials CLAUDE.md already authorizes, not a bypass) and drove
  the actual deployed app with Playwright. Confirmed the static rendering
  was correct for all 3 companies, then ran the full interactive loop on
  Mairë (Start → Mark Complete ×4 → offer appears → Accept → confetti) and
  found two real bugs the build/typecheck couldn't catch: (1)
  `SystemsPage` never refetched the parent's `companies` list after
  accepting a transition, so the stage badge stayed stuck on the old stage
  even though the database had correctly updated — fixed by passing
  `refetchCompanies` down and calling it in `handleAccept`; (2)
  `markSystemComplete` updated `system_unlocks.status` but never actually
  set the `document_templates.completed_at` column added in this same
  phase, leaving it permanently unused — fixed to update both. All test
  data (4 real template rows, a real stage_transitions row, Mairë's
  `current_stage`/`system_unlocks`) was restored to its exact pre-test
  seeded state via direct SQL afterward — verified with a final read.
- **New reference doc surfaced this session**: `claude/backstage-os-
  philosophy.md` (dropped 2026-07-22, read in full while investigating this
  spec's premises) has the real, locked Values Charter — human-agency/
  consent rules for automation — plus the Dashboard Guardrail and Build
  Pack Ethical Constraint. Worth checking against for every future feature,
  not just this one.

**Safety Net v1 — Phase 22 (2026-07-22, Post-Expansion build).**
`safety_net_nudges` (company × type × message, dismiss/act timestamps).
Only `cash_buffer` and `quiet_lead` generate in v1 — `seasonal_dip` is a
valid type but not generated yet, per the hand-off spec's own instruction
(needs a full season of revenue history to mean anything).

- **Real gap found and fixed first**: `leads` never had an `updated_at`
  trigger — every other timestamped table (`companies`/`notes`/`profiles`/
  `sops`/`tasks`) already uses the existing `handle_updated_at()` function,
  but `leads` was missed back in Phase 1. That made `updated_at` frozen at
  insert time forever, which would have made "quiet lead" (no recent
  activity) meaningless. Added the same trigger before building the nudge
  logic that depends on it.
- **Endpoint budget, resolved as the spec itself suggested**: nudge
  generation piggybacks on the existing daily email-sequences cron
  (`api/cron/process-email-sequences.ts`) rather than getting its own
  function — the file now runs two independent jobs
  (`processEmailSequences` + `generateSafetyNetNudges`), both unconditional
  (the original sequences code had an early return on "nothing due today"
  that would have skipped nudges too — restructured so neither job can
  starve the other). Function count stays at 12.
- **Dedup**: a nudge type only regenerates for a company once its previous
  one has been dismissed or acted on — not on a fixed time window.
- **UI**: `NudgeCard` on the founder's Today view only (not team) — at most
  one nudge shown at a time, the single most recent active one across every
  company the profile can see, matching the Dashboard Guardrail's "one
  gentle suggested action, dismissable without penalty." "Take a look"
  marks it acted and navigates to Leads (quiet_lead) or Reporting
  (cash_buffer); "Not now" just dismisses, no persisted judgment either way.
- **Cash buffer logic**: this week's paid revenue vs. the trailing 4-week
  average, scoped per company via `invoices → clients.company_id` (invoices
  has no `company_id` column directly). Fires when this week is under half
  the trailing average.

**Proposals content — single source of truth.** `proposals` (existing)
becomes the *lifecycle tracker* (status, client_id) only. A nullable
`generated_document_id` FK on `proposals` points to a `generated_documents`
row (type `proposal`) that holds the actual rendered content/sections.
`proposals.content` gets dropped (unused — Proposal Generator isn't built
yet, nothing to migrate).

**The floral-selection → auto-invoice mechanic** (from Prose Florals' real
proposal: bride selects desired pieces, system builds the invoice
automatically, then auto-creates the agreement and walks her into deposit +
signing) needs a "selectable priced line items" section type in
`document_templates.structure`. `generated_documents.field_values` holds
both what the team authored (sections, prices, options offered) and what
the client selected (their picks) as two distinct JSON keys, never
conflated — full detail in the Milestone 5 section below.

**Gaps filled** (spec said "feel free to change to what you think is best"):
- `testimonials` (new table): `client_id` (nullable), `company_id`, `quote`, `author_name`, `author_photo_url`, `is_featured`, `created_at`. Feeds Marketing System's rotation logic.
- `discovery_calls` (new table): `client_id`, `notes` (structured jsonb), `call_date`, `recorded_by` (→ profiles), `created_at`. Feeds Proposal Generator auto-population — this table didn't exist anywhere in the spec despite being referenced.
- **Newsletter ("The Green Room") — recommend integrating an existing ESP (Mailchimp/ConvertKit/Beehiiv) rather than building native list-sending.** Deliverability, unsubscribe compliance, and send infrastructure are a large, separate problem from what this platform is for. Backstage would just track a lightweight `newsletter_subscribers` reference (count/health), not become an email service provider. This is a recommendation awaiting sign-off — see "still open" below.
- Cashflow/pricing bands: new `cashflow_bands jsonb` column on `brand_kits`, alongside the existing `policy_defaults` — same pattern, per-company customizable.

**Google Drive OAuth**: confirmed per-company (Prose Florals/Backstage/Mairë
each connect their own Google account). **Start Google's OAuth verification
process early** — it's a one-time app-level review (not per-client, not
recurring) but can take weeks, and blocks the whole File Storage pillar
until approved.

## Milestone sequence

Each numbered item below is sized like the Foundation or Client Portal
milestones already shipped — i.e., its own planning-and-build pass, not a
single sitting. Ordered by dependency, not by pillar.

1. **Project Management UI** — ✅ **done.** `CreateProjectModal`/`ProjectModal` added to `src/DashboardApp.tsx` (accessed from `ClientModal`'s new Projects section), `useProjects`/`createProject`/`updateProject`/`resolveProfileIdByName` added to `src/useDatabase.ts`. Tasks can be created pre-linked to a project, or linked after the fact via the project's "Link an Existing Task" picker. Also fixed a pre-existing bug: `TaskCreateModal` collected an assignee but never saved it — every task created through the UI was silently unassigned. No new migration needed (RLS on `projects` was already correct from 0004/0006).

2. **Brand Kit module + Google Drive OAuth** — split into two phases (see full detail at the bottom of this doc):
   - **Phase A: Brand Kit — ✅ done.** New `brand_kits` table (migration 0008), `BrandKitEditModal` in `src/DashboardApp.tsx` (opened via a "Brand Kit" button in `CompanyModal`), and the first fully public, no-login page in this app: `/brand/{share_slug}` (`src/BrandKitShareView.tsx`), with copy-to-clipboard on colors/fonts and download links on logo variants.
   - **Phase B: Google Drive OAuth — not started, blocked on the user creating credentials** in their existing Google Cloud project (enable Drive API, add `drive.file` scope, create a new OAuth Client ID, hand over the Client ID/Secret). Full schema + flow design already written up, ready to execute the moment those arrive — see bottom of this doc.

3. **Onboarding Form Engine (public intake wizard) + Client Journey Engine (`clients.stage` state machine)** — **intake half is ✅ done**: `/intake/{slug}` (`src/IntakeWizard.tsx`) + `api/submit-intake.ts` already creates a real `clients` row at `stage='lead'` with a computed `track` (revenue/team-size/stage scoring), and logs the raw answers to `intake_responses`. **Still open:** the rest of the state machine — nothing yet automates `lead → proposal_sent → active → delivered` transitions; those trigger events don't exist until Milestones 5/6 (proposal sent/accepted, agreement signed) are built. Revisit once those land.

4. **Discovery call capture** (new, small — `discovery_calls` table + a simple internal form) — needed before Proposal Generator can auto-populate from it. Small enough to fold into the start of milestone 5 rather than standing alone.

5. **Proposal Generator** (absorbs "Vision Map" — see detailed plan below) — ✅ **done.** Migration `0007_proposal_engine.sql` (document_templates/generated_documents/proposals additions/payment_schedules/payment_installments) plus `0009_document_templates_client_read.sql` (client read policy for linked templates) applied live. Prose Florals' real Honeybook proposal seeded as the first template (10 sections, verified field-for-field and clause-for-clause against the source PDF; default grand total from the seeded line items is **$3,660**, not $4,615 as an earlier note claimed — recomputed directly from the live `structure` and double-checked against `proposalEngine.computeDocumentTotals`'s own logic). Shared calc engine in `api/_lib/proposalEngine.ts`; server-validated submission endpoint `api/submit-proposal-selections.ts` (never trusts client-sent `authored` values or above-default quantities). Internal "Create Proposal"/`ProposalDetailModal` flow added to `ClientModal` in `src/DashboardApp.tsx`; client-facing `ProposalCard` (design brief, line-item toggles/quantities, live totals, payment schedule, save/accept/decline) added to `src/ClientPortalApp.tsx`. Verified end-to-end live: created a real test proposal, simulated a client declining one line item and reducing another's quantity, confirmed the recomputed total ($3,540) and the resulting 25%/75% payment installments ($885 + $2,655) sum exactly to the grand total, then cleaned up the test rows. Confirmed via policy/function review that `client_owns()` structurally prevents cross-client reads (a client's `client_users.id` maps to exactly one fixed `client_id`, so no request can pass a different one and match). Pushed to `main` at commit `214187d`.

6. **DocuSign integration** — agreement send/embedded-sign/webhook, tied to proposal acceptance from milestone 5. `agreements.status = signed` → `clients.stage = active` → auto-create `projects` row (uses milestone 1's UI/data shape). **UI placeholder added** (2026-07-22, at user's request to fine-tune layout/structure before wiring the real integration): once a proposal is sent/viewed/accepted, `ProposalDetailModal` (internal, `src/DashboardApp.tsx`) shows an "Agreement" card ("Signature status: Not sent" + disabled "Send for Signature" button), and once accepted, the client portal's `ProposalCard` (`src/ClientPortalApp.tsx`) shows a matching "Your Agreement" card with a disabled "Review & Sign" button. No DocuSign API/webhook/schema work has been done — purely visual scaffolding to react against. **Interim change (2026-07-22, see Milestone 14 below): the project/kickoff-task half of this milestone's automation now fires on proposal acceptance itself** (`clients.stage → active` + `projects` row + seeded kickoff tasks, one pre-completed), rather than waiting on DocuSign — since real signing isn't built yet and the founder wanted a real, live "first automation" now. Once DocuSign lands, re-evaluate whether project creation should instead gate on `agreements.status = signed`, or stay on proposal acceptance with signing layered on top.

7. **Stripe integration** — invoicing + payment webhook, consuming the invoice totals computed in milestone 5's line-item mechanic. **UI placeholder added** (same pass as above): each payment installment row in both `ProposalDetailModal` (internal, disabled "Send Invoice" button) and the client portal's `ProposalCard` (disabled "Pay Now" button) now renders next to its existing amount/due-date/status, with a "Stripe integration — coming soon" note. No Stripe API/webhook/schema work has been done.

8. **Policies + Pricing Breakdown modules** — lighter lift once Brand Kit (2) exists; mostly template + `brand_kits.cashflow_bands`/`policy_defaults` rendering.

9. **Remaining document modules** (New Hire Packet, Product Sheets, Links Page, Freebie Builder) — parallelizable once 2–3 are stable; each is a `document_templates` type with its own structure, lower risk/dependency than 5–7.

10. **Testimonials + Marketing System** — `testimonials` table, rotation logic, newsletter (ESP integration per the recommendation above, not native), content calendar.

11. **Sales System refinements** — follow-up cadence automation, objection-handling reference; thin layer once 5/6 exist.

12. **Infrastructure Engine hardening** — per-company credential storage, broken-Drive-reference detection/re-link UX, manual-fallback paths for when Stripe/DocuSign/Drive are down. Not a standalone milestone so much as a cross-cutting concern to revisit once 6/7 are live and there's real integration surface to harden.

13. **Home Dashboard (the front door)** — last to build, first in intent. A read-and-suggest layer over everything above (`clients.stage` counts, `invoices.status`, `brand_kits` completeness, one pluggable "little win" suggestion at a time). Every milestone from 2 onward should expose its state in a way this can query cleanly — worth a quick sanity check at the *end* of each milestone ("what would the dashboard want to read from this?") rather than retrofitting all of it here. **Partial progress (2026-07-22, see Milestone 14):** the old hardcoded "Company Goals" fake-percentage card on the founder/team Today views was replaced with a real `BusinessSnapshot` component (live counts only, no scores) — first real step toward this milestone, not the full front-door redesign.

## What's still open

- **Milestone 10** needs a yes/no on the ESP-vs-native newsletter recommendation.
- Everything else can be planned in detail (schema/file lists, verification steps) the same way Foundation and Client Portal were, when we get to each one.

---

# Milestone 5 — Detailed Plan: Proposal Generator

## Context

Prose Florals' real, currently-in-use Honeybook proposal (a florist booking
a wedding) directly informs this schema: a personalized intro → a **Design
Brief** (style words, color palette, freeform direction, materials/
ingredients list, inspiration images, company philosophy, testimonials) →
the **core mechanic**: categorized, quantity-adjustable, partly-optional
line items with running subtotals (e.g. "Personal Florals: Bridal Bouquet
qty 1 $300, Bridesmaids qty 4 $600..." plus separate opt-in "Additional
Services"/"Add-Ons" sections) → an **auto-generated invoice** pulling
directly from those selections, with a **multi-installment payment
schedule** (not just one deposit — the real example has 4 payments tied to
signing/time-before-event rules) → the **contract** (long legal text with
merge fields, ending in signatures) → confirmation.

The original spec's separate "Vision Map" (a milestone/timeline roadmap
page) doesn't reflect how the business actually works — the Design Brief
section above **is** the "Vision + Needs Report," so Vision Map as a
distinct concept is dropped. Everything here is modeled generically
(categories/line items/brief fields), with Prose Florals' real proposal as
the first template instance, not baked into the schema as floral-specific
— this system needs to work for any industry eventually, per the platform's
Phase 2/3 ambitions.

Confirmed decisions: (1) payment installments are **configurable** (N
payments, each with its own timing rule), not a fixed deposit+balance; (2)
the contract is a **per-company editable template** with merge fields, not
one shared platform contract; (3) the event/delivery date that governs the
"edit until 30 days before" cutoff ultimately lives on
`projects.target_delivery_date` — see the sequencing note below, since a
project doesn't exist yet at proposal time.

## Schema (new migration `0007_proposal_engine.sql`)

**`document_templates`** — generic template definition, scoped per company:
```
id, company_id (FK companies), type text check in
  ('proposal','design_brief','contract','freebie','new_hire_packet',
   'product_sheet','pricing_breakdown','policies_sheet','links_page'),
name, structure jsonb, is_default bool default false,
created_at, updated_at
```
`structure` holds an ordered list of sections; the one that matters most
for this milestone is the **line-item section type**: a list of categories,
each containing line items with `{ name, description, unit_price,
default_quantity, is_optional, is_included }`.

**`generated_documents`** — a rendered instance for a specific client:
```
id, template_id (FK), client_id (FK clients, nullable),
field_values jsonb default '{}',  -- { authored: {...}, selections: {...} } — kept as two distinct keys, never merged in storage
status text check in ('draft','finalized','sent','viewed') default 'draft',
gdrive_file_id, gdrive_folder_id, last_synced_at,
edit_locked_at timestamptz nullable,  -- set once past the edit cutoff
created_at, updated_at
```
`authored` = what the team set up (categories, prices, what's optional).
`selections` = what the client picked (quantities, which optional items are
on). Keeping these as separate keys — never merging client input into the
team's authored data — is what makes it safe to let a client edit their own
selections without any risk of them altering prices or descriptions.

**`payment_schedules`** + **`payment_installments`** — configurable
installments, resolving the "4 payments tied to different rules" example:
```
payment_schedules: id, proposal_id (FK proposals, nullable), client_id (FK), total_amount, created_at

payment_installments: id, payment_schedule_id (FK), sequence_number,
  amount, due_rule_type text check in ('on_signing','days_after_signing','days_before_event'),
  due_rule_offset_days int nullable, due_date date nullable,
  invoice_id (FK invoices, nullable — populated when it's actually time to bill this installment, milestone 7),
  status text check in ('pending','invoiced','paid','overdue') default 'pending',
  created_at
```
Each installment becomes a real `invoices` row only when it's actually time
to charge it (ties into Stripe in milestone 7) — not all 4 pre-created as
invoices on day one.

**Modify `proposals`** (existing table):
- add `generated_document_id` (FK → generated_documents, nullable) — the actual proposal content lives here now.
- add `event_date` date (nullable) — **new field, resolves a sequencing gap**: the edit-cutoff and payment rules (like "30 days before event") need an event date, but a `projects` row doesn't exist yet at proposal time (it's only auto-created after the agreement is signed). So `proposals.event_date` is the source of truth during the proposal/agreement phase; when `projects` gets auto-created on signing, `target_delivery_date` is populated *from* `proposals.event_date`. This keeps the "date lives on projects" principle intact long-term while resolving the chicken-and-egg ordering problem.
- drop `content` (superseded by `generated_document_id`, unused today).

**Modify `agreements`** (existing table):
- add `generated_document_id` (FK → generated_documents, nullable) — holds the merge-filled contract text (type `contract`) before/alongside DocuSign envelope creation in milestone 6.

**RLS**: `document_templates`, `generated_documents`, `payment_schedules`,
`payment_installments` all get the standard `team_full_access` policy
(mirroring migration 0004). `generated_documents` and `payment_installments`
also need a **client read-only** policy scoped the same way
`0006_client_scoped_rls.sql` scoped tasks-via-project (`client_owns()`
through the client_id chain) — a client needs to *see* their proposal and
payment schedule in `/portal`.

**Important architectural point on client edits**: RLS can restrict which
*rows* a client can touch, but not which *keys within a JSON column* — so
Postgres alone can't stop a client from writing into `field_values.authored`
if they had direct UPDATE access to the row. Resolution: **a client never
gets direct UPDATE access to `generated_documents`.** Client selections go
through a server-side endpoint (`api/submit-proposal-selections.ts`, same
pattern as `api/invite-client.ts` — verifies the caller via `client_users`,
validates the submitted selections against the template's `authored`
options/allowed quantities, and writes only the `selections` key) — never a
direct Supabase client-side update.

## Scope call for this milestone

Building a full visual template-*builder* UI (drag-and-drop section editor)
is a large, separate undertaking from proving the mechanic works.
Recommendation: **seed one real `document_templates` row via migration/seed
data, modeled directly on Prose Florals' actual proposal** (categories,
line items, the Design Brief fields, the contract text with merge fields),
rather than building a generic template-authoring UI in this same pass. The
internal team can edit that seeded template's `structure`/text via a
straightforward form for now; a true drag-and-drop builder is a reasonable
later enhancement once there's more than one real template in use.

## Files (once this gets built)
- `supabase/migrations/0007_proposal_engine.sql` — schema above (user-run, same as prior migrations)
- `api/submit-proposal-selections.ts` — client selection submission (server-validated)
- `api/_lib/proposalEngine.ts` — shared total-calculation logic (authored + selections → line totals → category subtotals → grand total → feeds `payment_schedules` creation)
- Internal UI: a "Create Proposal" flow off an existing `ClientModal`-style entry point, instantiating a `generated_documents` row from the seeded template
- `/portal` additions in `ClientPortalApp.tsx`: render Design Brief + line items (with toggles/quantity for optional items) + computed total + payment schedule + accept/decline action

## Verification
- Migration 0007 applied directly (per the founder's 2026-07-22 authorization documented in CLAUDE.md) after verifying live-schema assumptions with a read-only query and confirming `get_advisors` showed no new security gaps on the new tables.
- Seed Prose Florals' real proposal as the first template; generate one real `generated_documents` instance for a test client end-to-end: authored content in, client selections in via the portal, confirm the computed total matches a manual calculation, confirm `payment_installments` get created correctly from the configured rules once accepted.
- Security check consistent with prior milestones: confirm a client's session cannot read or write another client's `generated_documents`/`payment_installments` via direct API calls, and confirm `field_values.authored` cannot be altered via `api/submit-proposal-selections.ts` no matter what's sent in the request body (server must recompute from the template, never trust client-sent prices).

## Verification approach for every milestone (carried forward from Foundation/Client Portal)
Additive schema changes get built and build-checked directly; anything
touching RLS or production data gets user-run SQL with a checklist; new
integrations (Drive, DocuSign, Stripe) get smoke-tested against their real
sandbox/test modes before touching production credentials.

---

# Milestone 2, Phase A — Done: Brand Kit

Shipped: `brand_kits` table (migration 0008 — one row per company, RLS is
`team_full_access` for edits **plus a deliberate public SELECT policy**,
since this table is meant to be handed out as a share link and holds no
client/task data). `BrandKitEditModal` in `src/DashboardApp.tsx` (opened
from a "Brand Kit" button in `CompanyModal`) edits logo variant URLs, 3
colors, 2 fonts, brand description/tone notes, policy defaults, and
cashflow bands. `src/BrandKitShareView.tsx` is the first fully public,
no-login page in this app, at `/brand/{share_slug}` — click-to-copy on
colors/fonts, download links on logos. `src/index.tsx`'s routing extended
to a third branch (`/`, `/portal`, `/brand/:slug`).

# Milestone 2, Phase B — Not Started: Google Drive OAuth

Blocked on the user creating credentials in their existing Google Cloud
project (they confirmed they already have one, from the app's Google
sign-in — this extends it, doesn't start fresh). Steps they need to do
first:
1. Enable the **Google Drive API** for the project.
2. Add the narrower **`drive.file`** scope to the OAuth consent screen (not full `drive`) — only grants access to files this app creates, and tends to face lighter verification than broad Drive access.
3. Create a **new OAuth 2.0 Client ID** (Web application), separate from whatever handles the Supabase login — different authorization purpose (a company connecting its Drive vs. a person logging in). Authorized redirect URI: `https://backstage-dashboard.vercel.app/api/google-drive/callback`.
4. Hand over the Client ID + Client Secret → new env vars `GOOGLE_DRIVE_CLIENT_ID` / `GOOGLE_DRIVE_CLIENT_SECRET`, server-side only.

Once those arrive, the build is already designed and ready to execute:

**New migration `0009_company_integrations.sql`**:
```sql
create table company_integrations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  provider text not null check (provider in ('google_drive')),
    -- kept generic on purpose: reusable for Stripe/DocuSign credentials
    -- too (milestones 6/7), not Drive-specific.
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  connected_by uuid references profiles(id),
  connected_at timestamptz not null default now(),
  unique (company_id, provider)
);
-- RLS: team_full_access only — no client-scoped or public policy; these
-- are secrets, never exposed to /portal or /brand.
```
Treat tokens in this table as sensitive as the service-role key — real,
usable credentials to each company's Drive.

**Flow**: a "Connect Google Drive" button (in `BrandKitEditModal` or
`CompanyModal`) hits new `api/google-drive/connect.ts` (verifies team
membership, redirects to Google's consent URL with `company_id` in
`state`); `api/google-drive/callback.ts` exchanges the auth code for
tokens server-side and upserts into `company_integrations`. Later document-
generation milestones read from this table to know which Drive to write
into — not this milestone's concern, just the connection itself.

**Verification once built**: connect a real company's Drive, confirm a
`company_integrations` row appears with real tokens; confirm re-connecting
updates rather than duplicates (the `unique (company_id, provider)`
constraint); confirm the connect/callback endpoints reject non-team-member
callers (same auth pattern as `api/invite-client.ts`).

---

# Milestone 14 — Done: Real Client Journey Automation + Backstage OS Philosophy + Getting Started Wizard + Founder Dashboard Cleanup

**Context.** The founder shared a full personal business-philosophy/spec
document ("Backstage OS") to hard-bake into the product, then asked for two
things on top of it: (1) the Client Journey's "proposal accepted" step
should actually *do* something automatically instead of just changing a
status, and (2) a step-by-step Getting Started wizard (styled after Bloom's
onboarding) that ends in a real quick win, on a HoneyBook-simple founder
dashboard (not HighLevel-overwhelming). On reviewing the philosophy doc's
Values Charter ("no unrestricted actions," "no silent automation") against
the "first thing forever checked off your to-do list" request, the founder
was asked directly which one wins when they're in tension — she confirmed
automation may fire instantly (no pre-click approval gate) as long as it is
never silent: it's always shown happening live, with a plain-language
"why." That reconciliation is now the locked pattern for all future
automation UI in this app, not just this feature.

**1. Governing spec.** `claude/backstage-os-philosophy.md` — the founder's
document verbatim, plus an appended reconciliation-notes section. Captures
the Values Charter, Onboarding Philosophy (founder-heart questions,
Progressive Reveal order, Witness Statement template, confetti ending),
Dashboard Guardrail (no urgency/scoring language — orientation, not
evaluation), and the Build Pack "Preview → Explain → Decide" constraint (as
reconciled above for internal/reversible actions). Read this before any
future feature decision that touches automation or onboarding.

**2. Schema.** Migration `0010_onboarding_and_project_automation.sql` —
`companies.onboarding_completed_at`, `tasks.metadata jsonb` (used to tag
automation-created tasks). Migration `0011_business_identity.sql` —
`companies.purpose`, `who_they_serve`, `how_they_serve`, `boundaries`,
`vision`, `witness_statement` (all nullable text; populated by the wizard's
founder-heart questions and Witness Statement step). Both applied live.
Existing companies (Backstage, Mairë, Prose Florals) were backfilled with
`onboarding_completed_at = now()` in 0010 so the wizard doesn't retroactively
force itself on real, already-running companies — it only auto-triggers for
a company that has never completed it (i.e., a new company created going
forward).

**3. Real automation.** `api/_lib/projectAutomation.ts` is the single
source of truth for what happens the moment a proposal is accepted:
`buildKickoffTasks(clientName)` returns three starter tasks, one of which
(payment schedule setup) is created **already completed** — this is the
literal "first thing forever checked off your to-do list" moment.
`kickoffProjectName` / `KICKOFF_TASK_METADATA` are shared helpers.
`api/submit-proposal-selections.ts` calls this on real proposal acceptance:
creates a `projects` row, inserts the kickoff tasks (tagged
`metadata: { auto_created: true, trigger: "proposal_accepted" }`), and
flips `clients.stage` to `active`. Nothing here is staged or simulated —
it's the same code path a real client triggers by accepting a real
proposal. A new "⚡ Automated" badge on `TaskRow` (`src/DashboardApp.tsx`)
reads that same `metadata.auto_created` flag, so any automatically-created
task is visibly marked as such wherever it shows up in the app, not just
inside the wizard.

**4. Getting Started Wizard.** New `src/OnboardingWizard.tsx`, steps:
`welcome → purpose → who → how → boundaries → vision → brand → client →
automation → witness → done`. Founder-heart questions save straight to the
new `companies` columns. The "automation" step creates a **real** client
row, then calls the exact same `buildKickoffTasks`/`kickoffProjectName`
logic used by the live proposal-accept flow — tasks appear on screen, then
the auto-completed one visually checks itself off with an inline "⚡
Automated — {why}" explanation, so the wizard's demo is honestly the same
automation a real client triggers, not a fake animation. The wizard ends
with a read-only Witness Statement (template: "This system was shaped
around serving {who}, in a way that honors {boundaries}, with capacity for
{vision}.") and a confetti "Your space is ready" screen. It auto-triggers
for any company with `onboarding_completed_at IS NULL`, and can otherwise
be re-run any time from Settings → "Getting Started Wizard" (company
picker + an explicit warning that replaying it creates a new real client
and project, since it isn't a sandbox demo).

**5. Founder dashboard cleanup.** Removed the old hardcoded "Company
Goals" card (`Q1 MRR 62% / Ops SLAs 78% / VA playbook 40%` — numbers that
never moved because nothing fed them). Replaced with a new `BusinessSnapshot`
component built for both the founder and team-member Today views, showing
only real, live counts pulled straight from the database (companies count,
active clients, tasks in motion, tasks completed in the last 7 days for the
founder view; personal task/company/completed counts for team members) —
per the Dashboard Guardrail: plain numbers, no percentages, no colored
progress bars, no scoring, no "you should" language. No gamification was
added here — gamification stays scoped to Career Path/Settings, never
Today/home, per the founder's standing constraint.

**Verification.** `npx tsc --noEmit` and `npm run build` both run clean
after every change in this milestone — the pre-existing ~37 type errors in
`ApprovalQueue.tsx`/`CompanyManagement_Components.tsx`/`supabase.ts` (all
unrelated legacy issues, confirmed identical before and after this
milestone's changes via a `git stash` diff) are untouched; nothing new was
introduced by `OnboardingWizard.tsx`, the `useDatabase.ts` type additions,
or the `DashboardApp.tsx` wiring.

**Files.** `claude/backstage-os-philosophy.md` (new),
`supabase/migrations/0010_onboarding_and_project_automation.sql` (new,
applied), `supabase/migrations/0011_business_identity.sql` (new, applied),
`api/_lib/projectAutomation.ts` (new), `api/submit-proposal-selections.ts`
(modified — kickoff automation wired into acceptance flow),
`src/OnboardingWizard.tsx` (new), `src/DashboardApp.tsx` (modified —
`DBTask.metadata` + Automated badge, wizard state/auto-trigger/render,
`SettingsPage` replay entry point, `BusinessSnapshot` component replacing
Company Goals in both Today views), `src/useDatabase.ts` (modified —
`Company` interface business-identity fields, `useCompanies().refetch`).
