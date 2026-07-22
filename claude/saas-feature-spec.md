# Backstage SaaS — Feature Spec (Templates & Systems as Native Modules)

> Source document for `roadmap.md` — that file resolves the open questions
> raised here and reflects current build status. **Defer to `roadmap.md`
> and `vocabulary-reference.md` on any naming conflict** (this doc predates
> some terminology/architecture decisions made during review).

## Purpose of This Document

This translates Backstage's delivery toolkit — previously assembled in
third-party tools — into **native features of the Backstage platform
itself**. Each "template" becomes a system-generated document or
configurable module; each "system" becomes a backend engine or workflow.
Written for a developer or Claude Code to build against.

**Companion docs:**
- `vocabulary-reference.md` — canonical terms, allowed field values, and current build status. **The authority when anything conflicts.**
- `platform-spec.md` — original three-view architecture and trigger logic. Useful for concept, but defer to the vocabulary reference for any naming.

**Design principle carried from mission:** every generated artifact hands
the founder back time, clarity, or peace of mind. Framing is always
affirmative ("here's what multiplying yourself looks like"), never
deficit-based.

**How We Help pillars** (each module maps to one): Client Journey
Automation (CJA) · Infrastructure Buildout (IB) · Streamlined Pipeline (SP)
· Growth Strategy (GS)

---

## What Already Exists vs. What This Doc Adds

**Already built (reference as existing — do NOT re-spec):**
- Tables: `clients`, `companies`, `profiles`, `tasks`, `products`, `projects`, `intake_responses`, `proposals`, `agreements`, `invoices`, `client_users`
- Migrations `0001`–`0006` (schema + RLS lockdown + client-scoped RLS)
- `api/invite-client.ts`, "Invite to Portal" button, `client_owns()` / `is_team_member()` RLS helpers
- `/portal` client app (`ClientPortalApp`) with the **read** side of projects working
- Internal nav: Today · Meetings · Tasks · Companies · Playbook · My Team · Career Path · Settings

**Net-new entities this doc proposes (all to-build):**
- `brand_kits`, `document_templates`, `generated_documents` — the template engine below

**Roles/auth (use these, not the old planning terms):**
- Internal roles: `founder`, `team` (on `profiles`)
- Client identity: `client_users`, separate from `profiles`, **magic-link login only** — a client is never an internal role

**Scope note on "company" vs. multi-tenant:** `companies` = the founder's
own sub-brands (Prose Florals, Backstage, Mairë). True multi-tenant SaaS
(other businesses signing up) is **Phase 2 and does not exist yet** — see
the note at the end. Everywhere below, template modules scope to a
`company_id`, not an "org_id."

---

## The Front Door: The "Business Health at a Glance" Home Dashboard

**This is the product's reason for being — read this before building any
module.**

Every other feature in this spec is machinery: the client journey, the
templates, the automation. This dashboard is the *reason a founder opens
the app at all.* The core emotional promise: **the business runs on its
own; you only work when you want to.** Logging in is not to operate the
machine — it's to glance at it running, confirm it's okay, and (optionally)
pick up one small thing that makes it better.

**Design mandate:** this dashboard must *earn its calm.* A glance is only
"enough" if the automation underneath is trustworthy. The whole platform
exists to make that glance honest.

This is the founder-facing **Today** page's reason for being (Today already
exists in the internal nav — this dashboard is what Today should become).

### Two distinct jobs (do not merge them)

**Job 1 — "Is my business okay?" (answerable in ~3 seconds)**
A calm at-login health view. NOT dense analytics. A few honest signals:
- [ ] Money flowing? (recent/pending `invoices` activity, at a glance — not a full financial report)
- [ ] Clients moving? (count of `clients` in each `stage`; is the journey flowing)
- [ ] Anything actually stuck? (surfaces ONLY genuine blockers — a stalled client, an `invoices.status = overdue`, an `agreements.status = sent` past threshold)
- [ ] Default state is reassurance: if all is well, the dashboard should *say so* plainly and let the founder close the tab in peace. "All clear" is a feature, not empty space.
- Design principle: green/calm by default. Problems surface only when real. Never manufacture urgency to drive engagement — that violates the entire premise.

**Job 2 — "One small thing I could do" (the hand-holding / motivation layer)**
When the founder *does* feel like working, offer ONE small, doable,
inviting action — not a backlog.
- [ ] Surface a single suggested "little win" at a time (e.g. "Your Brand Kit is missing a tagline — add one in 2 minutes" or "3 past clients could get a testimonial request")
- [ ] Sized to feel inviting, never heavy or guilt-inducing
- [ ] **Affirmative framing is mandatory** (core brand rule): never "you haven't done X," always "here's a small win available to you"
- [ ] Dismissable / "not now" without penalty — no streaks, no nagging, no counters that shame
- [ ] Suggestions drawn from real state: incomplete `brand_kits` fields, `clients` ready for a next step, funnel gaps, growth opportunities

### What this means architecturally
- The home dashboard is a **read-and-suggest layer on top of every other module** — it queries `clients.stage`, `invoices.status`, `brand_kits` completeness, journey health, and composes a calm summary + one suggestion.
- It is the **front door every other module feeds into.** Build the modules so their state is queryable *by* this dashboard from day one (health signals + "what small thing is available here").
- Motivation logic should be a pluggable suggestion engine: each module can register "available little wins" it can offer, and the dashboard picks one to surface at a time.

**The anti-pattern to avoid:** turning this into an engagement-maximizing
dashboard full of badges, streaks, and red notification counts. That is the
*opposite* of the promise. This tool succeeds when a founder logs in, sees
everything is fine, and logs off feeling calm — and only works when
genuinely inspired to.

---

## Core Concept: The Template Engine

Rather than static files, templates become **data-driven document objects**
rendered from a shared branding source. Three net-new tables:

### `brand_kits` (foundational entity — build first)
Every generated document pulls from one `brand_kit` per `company`. Nothing
is hardcoded.
```
brand_kits
- company_id (FK → companies)
- logo_asset_url (+ variants: primary, mark-only, light/dark)
- color_primary, color_secondary, color_accent (hex)
- font_heading, font_body (+ optional source/download links)
- brand_description (text — the "who this brand is" summary)
- tone_notes (text — voice/imagery guidelines)
- policy_defaults (JSON — feeds Policies module)
- share_slug (for the public reference view)
```
- Every template module reads from `brand_kits` at render time — change the
  kit once, every document reflows.
- **This is the dependency root.** Build and test this before any document
  module.
- Scoped per `company` (Prose, Backstage, Mairë each get their own kit) —
  NOT per "organization."

**Design intent — model this on Bloom's brand layer, not a settings form.**
The brand kit is a *portable, shareable brand reference surface*, not just
stored config. The primary user goal is: "hand a link to my designer or
team, and they have everything they need to stay on-brand." Build:
- [ ] A shareable brand reference view (route like `/brand/{share_slug}`) — presentable, not admin-styled
- [ ] Copy-to-clipboard on every hex code and font name (one tap, no manual selection)
- [ ] Download action on every logo variant and asset
- [ ] Brand description + tone notes displayed as readable reference, not form fields
- [ ] The same `brand_kits` row drives both this human-facing share view AND the render-time source for all document modules — one entity, two surfaces

### `document_templates` (generic template object)
```
document_templates
- company_id (FK → companies)
- type: enum (proposal | freebie | new_hire_packet | vision_map | product_sheet | pricing_breakdown | policies_sheet | links_page)
- structure (JSON — ordered sections with field definitions)
- is_default (bool — platform-seeded starter vs. company-customized)
```

### `generated_documents` (an instance rendered for a specific client)
```
generated_documents
- template_id (FK → document_templates)
- client_id (FK → clients, nullable — some docs aren't client-specific)
- field_values (JSON — the filled-in content)
- status: draft | finalized | sent | viewed
- gdrive_file_id (external reference — file lives in the company's Drive; see File Storage)
- gdrive_folder_id
- last_synced_at
```

This means: one template definition + brand kit + client data → rendered
document, no manual rebuild per client. That *is* the "multiply yourself"
thesis expressed in code.

> **Note (see `roadmap.md`):** the `vision_map` type above was superseded
> during review — Prose Florals' real proposal doesn't use a separate
> milestone/timeline page, so that concept was dropped in favor of a
> `design_brief` type, and the line-item/invoice/payment-schedule mechanics
> got a full detailed schema in the Milestone 5 plan. This section is kept
> as-written for historical context; `roadmap.md` is authoritative.

---

## File Storage Architecture: External by Design (Google Drive)

**Decision:** Generated documents and stored files live in **the company's
own Google Drive**, not in Backstage's database. The platform references
them; it does not own them.

**Why this is intentional (do not "fix" this later):** This is a
mission-level decision, not a technical convenience. Backstage's entire
brand is the safety net — peace of mind, no lock-in, "you're never
trapped." A founder who stops paying for Backstage must still walk away
with everything they need to run their business. Storing their files in
*their* Drive guarantees that. This is a deliberate anti-lock-in stance and
a differentiator, not an oversight.

**How it works:**
- Storage references live on `generated_documents` (`gdrive_file_id`, `gdrive_folder_id`, `last_synced_at` — shown above)
- [ ] Google Drive OAuth per `company` — each sub-brand connects its own Google account (Phase 2: each external customer connects theirs)
- [ ] On document generation/export: write the file into the company's designated Drive folder, store only the `gdrive_file_id` reference
- [ ] Platform surfaces (`/portal`, dashboard) link to / embed the Drive file rather than serving it from Backstage storage
- [ ] Folder structure auto-created in their Drive (e.g. `Backstage / Clients / {client name} / ...`) so it's navigable even outside the platform

**The honest trade-off (dev must understand this):** Because files live in
the company's Drive, Backstage can *reference and link* them but cannot
fully control them — someone could reorganize, rename, or delete files,
change sharing permissions, or revoke Drive access, and the platform's
links would break. This is the accepted cost of portability. Handle it
gracefully:
- [ ] Detect broken/missing Drive references and surface a clear re-link prompt (not a crash)
- [ ] Never assume a referenced file still exists or is unchanged — check before relying on it
- [ ] Treat Backstage as the *system of record for structured data* (`clients`, `proposals.status`, etc.) and Google Drive as the *system of record for files/documents* — two clear ownership domains

**What stays in Backstage's own database:** structured relational data
(`clients` records, stages, `proposals`/`agreements`/`invoices` status,
`brand_kits` values, automation state). What lives in the company's Drive:
the rendered files/documents themselves. This split is the architecture.

---

# TEMPLATE MODULES

## 1. Proposal Generator
**Pillar:** SP | **Entity:** `proposals` (existing) + `document_templates` type `proposal`

Build:
- [ ] Modular section builder: scope, timeline, investment, next-steps — each an editable block
- [ ] Auto-populate from `intake_responses` + discovery-call notes (merge-field logic — pull `clients.name`, `clients.track`, selected scope items, computed price)
- [ ] Brand-styled render pulling from `brand_kits`
- [ ] Client-facing web view (in `/portal`) + PDF export to Drive
- [ ] "Accept / Decline" action on the client view sets `proposals.status = accepted` / `declined`; on accept, triggers agreement send (DocuSign)
- [ ] Target: fully customized proposal generated in a single form pass, no document rebuild
- Note: this is the client-facing **Vision + Needs Report** page. See `roadmap.md` Milestone 5 for the full, revised design grounded in Prose Florals' real proposal (categorized line items, configurable payment installments, per-company contract templates).

## 2. Freebie / Lead Magnet Builder
**Pillar:** GS | **Entity:** `document_templates` type `freebie`

Build:
- [ ] Template with locked brand styling, editable copy blocks only (prevents off-brand output)
- [ ] PDF export (print + web-optimized) to the company's Drive
- [ ] Delivery hook: email-opt-in gate OR direct download link OR landing-page embed
- [ ] `funnel_placement` field per freebie (top-of-funnel vs. exit-intent/deeper)
- [ ] Reusable: spin up a new lead magnet from the base structure without starting blank
- [ ] Seed defaults: Digital Credibility Checklist, Systems Leak Checklist

## 3. New Hire Packet Generator
**Pillar:** IB | **Entity:** `document_templates` type `new_hire_packet`

Build:
- [ ] Section set: welcome letter, role expectations, tools/access checklist, values page, first-week schedule
- [ ] Placeholder fields: `companies` branding + role title injected at render (via that company's `brand_kits`)
- [ ] Two structure variants: solo-founder-first-hire vs. small-team-adding-role (conditional on an input flag)
- [ ] Intake: which fields must be supplied before generation (validation gate)

## 4. Onboarding Form Engine (Intake Questionnaire)
**Pillar:** CJA | **Entity:** creates `clients` + `intake_responses` (existing tables)

Build:
- [ ] Public-facing native stepped wizard (do NOT depend on external form tools — this is core pipeline data)
- [ ] Conditional branching: follow-up questions vary on prior answers (e.g. track-indicating responses)
- [ ] On submit → create a `clients` row (at `stage = lead`) + an `intake_responses` row, auto-tag `clients.track` (`freelancer` / `founder_mini` / `founder_full` / `ceo`)
- [ ] Confirmation screen sets discovery-call expectation
- [ ] Zero manual re-entry: form data IS the `clients` record, not a copy of it
- This replaces the current manual client-creation-via-internal-app step.

## 5. Links Page Builder
**Pillar:** GS | **Entity:** `document_templates` type `links_page`

Build:
- [ ] Hosted, brand-styled link-in-bio page per client/company (own route, e.g. `/l/{slug}`)
- [ ] Structure: primary CTA, 3–5 secondary links, social icons
- [ ] Mobile-first render (primary access is from social apps)
- [ ] Editable link list with priority ordering

## 6. Vision Map Module — superseded, see `roadmap.md`
**Pillar:** GS | **Entity:** was `document_templates` type `vision_map`

> Kept here for historical context only. During Milestone 5 review, the
> user confirmed the real proposal doesn't use a separate milestone/
> timeline page — the Design Brief section serves this purpose instead.
> Do not build this as a distinct module; see `roadmap.md`.

## 7. Product Sheet Generator
**Pillar:** SP | **Entity:** `document_templates` type `product_sheet`; may reference existing `products` table

Build:
- [ ] Per-offer sheet: what's included, timeline, outcome, investment
- [ ] Standardized structure so a new offer sheet generates without a blank start
- [ ] Seed defaults from Backstage's own stack (Workbook, Stress-Free Freelancer, Backstage Method)

## 8. Pricing Breakdown Module
**Pillar:** IB | **Entity:** `document_templates` type `pricing_breakdown`

Build:
- [ ] Client-facing render: transparent "what you're paying for and why"
- [ ] Optional teaching layer: cashflow bands (Profit ~30–40%, Expenses 10–30%, Labor 0–30%, Taxes ~15%, Charity ~10%) — **customizable per company, not hardcoded fixed values** (see `brand_kits.cashflow_bands` in `roadmap.md`)
- [ ] Toggle: use as client deliverable vs. internal-only pricing reference

## 9. Brand Kit Module
**Pillar:** IB | **Entity:** `brand_kits` (the foundational entity above)

Build:
- [ ] Editable UI for logo, palette (hex), typography, imagery/tone, do's & don'ts
- [ ] The shareable `/brand/{share_slug}` view (copy-to-clipboard, downloads — see Template Engine section)
- [ ] Serves as the single source every other template render reads from
- [ ] Must exist/validate before dependent document modules can generate on-brand output

## 10. Policies Cheat Sheet Module
**Pillar:** IB | **Entity:** `document_templates` type `policies_sheet`; reads `brand_kits.policy_defaults`

Build:
- [ ] Categories: payment terms, cancellation window, communication hours, revision limits, etc.
- [ ] One-page quick-reference render (NOT the binding legal doc — the signed `agreements` / DocuSign artifact is authoritative; this summarizes it)
- [ ] Affirmative framing enforced in copy guidance — no "here's what could go wrong" language

---

# SYSTEM ENGINES

## 1. Digital Hub
**Pillar:** IB
The central dashboard surface — the company's/client's home base.

Build:
- [ ] Dashboard aggregating: `/portal` link, active `generated_documents` (linked to their Drive location), key contacts, resources
- [ ] Role-scoped visibility: `founder` / `team` (internal, via `profiles`) vs. `client_users` (portal)
- [ ] Documents surfaced here link out to / embed the company's Google Drive files, reinforcing that the client always has direct access to their own materials
- [ ] Decision: is this the same surface as `/portal`, or a lighter companion? (Recommend: `/portal` **is** the client's Digital Hub; the internal Today page is the team's.)

## 2. Client Journey Engine
**Pillar:** CJA
The lifecycle automation — the heart of the platform.

Build:
- [ ] State machine on `clients.stage`: `lead` → `proposal_sent` → `active` → `delivered` → `archived`
- [ ] Each transition fires the actions in the platform spec's Trigger Logic table (e.g. `agreements.status = signed` → `clients.stage = active` + auto-create a `projects` row)
- [ ] Human-handoff flags: stages requiring manual action (discovery call, proposal review) vs. fully automated transitions
- [ ] "Stalled" detection: a client sitting in a stage past a threshold surfaces to the team
- [ ] Enforces the proof requirement: track a real inquiry/booking within 1–2 weeks per track
- ⚠️ Do not conflate `clients.stage` with `tasks.status` (`focus`/`active`/`submitted`/`completed`/`archived`) — they share the word "active" but are unrelated vocabularies.

## 3. Marketing System
**Pillar:** GS
Top-of-funnel engine.

Build:
- [ ] Newsletter management (The Green Room) — subscriber list, send scheduling. **See `roadmap.md`: recommendation is an ESP integration (Mailchimp/ConvertKit/Beehiiv), not native send infrastructure — awaiting sign-off.**
- [ ] Freebie → list → nurture-sequence automation (opt-in triggers sequence enrollment)
- [ ] Content calendar with ownership assignment (`founder` vs. `team`)
- [ ] Testimonial rotation logic — surface contextually (not clustered), per brand rule (see new `testimonials` table in `roadmap.md`)

## 4. Sales System
**Pillar:** SP
Discovery-call-to-signature engine.

Build:
- [ ] Discovery-call capture form (structured notes → feed Proposal generation; see new `discovery_calls` table in `roadmap.md`)
- [ ] Proposal follow-up cadence automation (N touchpoints, timed, before flagging a lead cold)
- [ ] Objection-handling reference surface per track (internal team aid)
- [ ] Ties `proposals.status` transitions into the Client Journey state machine

## 5. Infrastructure Engine
**Pillar:** IB
The technical backbone.

Build:
- [ ] Integration layer: Stripe (payments) + DocuSign (e-sign) + Google Drive (file storage) webhooks/OAuth wired to entity state
- [ ] DocuSign webhook: envelope signed → `agreements.status = signed` → `clients.stage = active` → auto-create `projects` row
- [ ] Stripe webhook: `invoice.paid` → `invoices.status = paid` → reflect in `/portal`
- [ ] Manual-fallback paths: what a `team` member does if an integration is down at the proposal/agreement/invoice stage
- [ ] Per-company credential storage for Stripe/DocuSign/Google
- [ ] Broken-Drive-reference handling (per File Storage section) — graceful re-link, never crash

---

## Build Order (Dependency-Driven)

> Superseded by the numbered milestone sequence in `roadmap.md` — kept here
> for the original reasoning, but treat `roadmap.md` as authoritative on
> ordering.

**Immediate next step (per current build status): Project Management UI.**
Not a new module in this doc, but the smallest self-contained piece that
unblocks end-to-end portal testing — a `team` member creates a `projects`
row from the Internal View and links `tasks` to it, and the `client_user`
immediately sees it in `/portal`. The `projects` table and portal read-side
already exist; only the internal create/edit UI is missing. Do this before
the larger efforts below.

Then, for the template/systems layer in this doc:

1. **`brand_kits` module + Google Drive OAuth** — nothing on-brand renders without the kit; nothing gets stored/exported without Drive connected. Both are root dependencies.
2. **Onboarding Form Engine (intake wizard) + Client Journey Engine** — the intake data + `clients.stage` state machine everything downstream depends on.
3. **Proposal Generator** — sales-stage documents (depend on intake data + brand kit).
4. **Policies + Pricing modules** — trust/transparency layer
5. **New Hire Packet, Product Sheets, Links Page, Digital Hub** — remaining document modules, parallelizable once 1–3 are stable
6. **Marketing System + Sales System engines** — process/cadence layers, refined once the documents they orchestrate exist
7. **The Home Dashboard (front door / Today page)** — built *last in sequence but designed first in intent.* It's a read-and-suggest layer over everything above, so it needs the other modules to expose health signals + "available little wins." Every module from step 1 onward should be built already knowing it must feed this dashboard — expose queryable state and registerable suggestions from the start, so the front door assembles cleanly rather than requiring retrofits.

## Multi-Tenancy Note (Phase 2 — does NOT exist yet)

Everything above scopes to `company_id` (the founder's own sub-brands). True
multi-tenancy — other businesses signing up as customers of the SaaS — is a
**future phase** and is deliberately not built. When it comes: a new tenant
concept sits above `companies`, each tenant fills in their `brand_kits`
once, and every document module immediately generates on-brand output for
their business. The Backstage-specific seed defaults (offer stack,
freebies, cashflow bands) become the starter templates a new tenant
customizes — turning the founder's own delivery toolkit into the product
other founders subscribe to. **Do not build tenant/org scaffolding now; just
don't hardcode anything that would block adding it later.**
