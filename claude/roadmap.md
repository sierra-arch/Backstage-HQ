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

5. **Proposal Generator** (absorbs "Vision Map" — see detailed plan below) — the biggest, highest-value module. Depends on brand kit (2), intake data (3), discovery notes (4). Detailed schema/build plan below, grounded in Prose Florals' real proposal.

6. **DocuSign integration** — agreement send/embedded-sign/webhook, tied to proposal acceptance from milestone 5. `agreements.status = signed` → `clients.stage = active` → auto-create `projects` row (uses milestone 1's UI/data shape).

7. **Stripe integration** — invoicing + payment webhook, consuming the invoice totals computed in milestone 5's line-item mechanic.

8. **Policies + Pricing Breakdown modules** — lighter lift once Brand Kit (2) exists; mostly template + `brand_kits.cashflow_bands`/`policy_defaults` rendering.

9. **Remaining document modules** (New Hire Packet, Product Sheets, Links Page, Freebie Builder) — parallelizable once 2–3 are stable; each is a `document_templates` type with its own structure, lower risk/dependency than 5–7.

10. **Testimonials + Marketing System** — `testimonials` table, rotation logic, newsletter (ESP integration per the recommendation above, not native), content calendar.

11. **Sales System refinements** — follow-up cadence automation, objection-handling reference; thin layer once 5/6 exist.

12. **Infrastructure Engine hardening** — per-company credential storage, broken-Drive-reference detection/re-link UX, manual-fallback paths for when Stripe/DocuSign/Drive are down. Not a standalone milestone so much as a cross-cutting concern to revisit once 6/7 are live and there's real integration surface to harden.

13. **Home Dashboard (the front door)** — last to build, first in intent. A read-and-suggest layer over everything above (`clients.stage` counts, `invoices.status`, `brand_kits` completeness, one pluggable "little win" suggestion at a time). Every milestone from 2 onward should expose its state in a way this can query cleanly — worth a quick sanity check at the *end* of each milestone ("what would the dashboard want to read from this?") rather than retrofitting all of it here.

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
