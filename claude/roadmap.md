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
