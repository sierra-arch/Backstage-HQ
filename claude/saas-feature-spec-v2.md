# Backstage SaaS — Feature Spec (Templates & Systems as Native Modules)
_Pasted by Sierra on 2026-07-22. This is a more detailed companion/superset of `claude/saas-feature-spec.md` — notably it spells out the Home Dashboard's "two jobs" framing and the Template Engine (`brand_kits` / `document_templates` / `generated_documents`) architecture in full. Keep both docs; this one has more implementation detail on the modules below._

## Purpose of This Document
Translates Backstage's delivery toolkit (previously assembled in third-party tools) into native features of the Backstage platform itself. Each "template" becomes a system-generated document or configurable module; each "system" becomes a backend engine or workflow.

Terminology authority: `claude/vocabulary-reference.md` is canonical. Real schema vocabulary: `companies`, `founder`/`team`, `client_users`. New entities in this doc (`brand_kits`, `document_templates`, `generated_documents`) are net-new / to-build and reference existing tables by their real names.

Design principle: every generated artifact hands the founder back time, clarity, or peace of mind. Framing is always affirmative, never deficit-based.

How We Help pillars: Client Journey Automation (CJA) · Infrastructure Buildout (IB) · Streamlined Pipeline (SP) · Growth Strategy (GS)

## What Already Exists vs. What This Doc Adds
Already built (do NOT re-spec): tables `clients, companies, profiles, tasks, products, projects, intake_responses, proposals, agreements, invoices, client_users`; migrations 0001–0006 (schema + RLS lockdown + client-scoped RLS); `api/invite-client.ts`, "Invite to Portal" button, `client_owns()` / `is_team_member()` RLS helpers; `/portal` ClientPortalApp with read-side of projects working; internal nav: Today · Meetings · Tasks · Companies · Playbook · My Team · Career Path · Settings.

Net-new (to-build): `brand_kits`, `document_templates`, `generated_documents` — the template engine below.

Roles/auth: internal roles `founder`, `team` (on `profiles`); client identity is `client_users`, separate from `profiles`, magic-link login only — a client is never an internal role.

Scope note: `companies` = the founder's own sub-brands (Prose Florals, Backstage, Mairë). True multi-tenant SaaS (other businesses signing up) is Phase 2 and does not exist yet. Template modules scope to `company_id`, not an "org_id."

## The Front Door: "Business Health at a Glance" Home Dashboard
This is the product's reason for being — read before building any module. Every other feature is machinery; this dashboard is why a founder opens the app at all. Core emotional promise: the business runs on its own; you only work when you want to. Logging in is to glance at it running, confirm it's okay, and optionally pick up one small thing that makes it better.

Design mandate: this dashboard must earn its calm. This is what the existing Today page should become.

**Job 1 — "Is my business okay?" (~3 seconds)** A calm at-login health view, not dense analytics.
- Money flowing? (recent/pending invoice activity, not a full financial report)
- Clients moving? (count of clients per stage; is the journey flowing)
- Anything actually stuck? (only genuine blockers: stalled client, `invoices.status = overdue`, `agreements.status = sent` past threshold)
- Default state is reassurance — "all clear" is a feature, not empty space. Green/calm by default; problems surface only when real. Never manufacture urgency.

**Job 2 — "One small thing I could do"** (hand-holding / motivation layer). One small, doable, inviting action — not a backlog.
- Surface a single suggested "little win" at a time (e.g. "Your Brand Kit is missing a tagline — add one in 2 minutes")
- Sized to feel inviting, never heavy or guilt-inducing
- Affirmative framing mandatory — never "you haven't done X," always "here's a small win available to you"
- Dismissable / "not now" without penalty — no streaks, no nagging, no shame counters
- Drawn from real state: incomplete `brand_kits` fields, clients ready for next step, funnel gaps, growth opportunities

**Architecture implication:** the home dashboard is a read-and-suggest layer over every other module (`clients.stage`, `invoices.status`, `brand_kits` completeness, journey health) composing a calm summary + one suggestion. Motivation logic should be a pluggable suggestion engine — each module registers "available little wins," dashboard picks one to surface at a time.

**Anti-pattern to avoid:** turning this into an engagement-maximizing dashboard full of badges, streaks, and red notification counts.

> Reconciliation note (2026-07-22, per Sierra): Sierra has explicitly asked to keep gamification (XP/streaks/kudos/Career Path) rather than drop it — see the "RESOLVED" note already in `CLAUDE.md`. The way to honor both this spec's anti-pattern warning AND Sierra's wishes: keep the Today/home dashboard itself calm and reassurance-first per Job 1/Job 2 above, and house XP/streaks/kudos/leveling in Career Path, Settings, or a dedicated "My Growth" surface — not surfaced as red badges/urgency on the landing view.

## Core Concept: The Template Engine
Three net-new tables, data-driven document objects rendered from a shared branding source.

### `brand_kits` (foundational — build first)
- `company_id` (FK → companies)
- `logo_asset_url` (+ variants: primary, mark-only, light/dark)
- `color_primary`, `color_secondary`, `color_accent` (hex)
- `font_heading`, `font_body` (+ optional source/download links)
- `brand_description` (text)
- `tone_notes` (text)
- `policy_defaults` (JSON — feeds Policies module)
- `share_slug` (public reference view)

Every template module reads from `brand_kits` at render time. Scoped per company (Prose, Backstage, Mairë each get their own kit), not per "organization." Build and test before any document module.

Design intent — model on Bloom's brand layer, not a settings form. Primary user goal: "hand a link to my designer or team, and they have everything they need to stay on-brand."
- Shareable brand reference view: `/brand/{share_slug}` — presentable, not admin-styled
- Copy-to-clipboard on every hex code and font name
- Download action on every logo variant/asset
- Brand description + tone notes as readable reference, not form fields
- Same `brand_kits` row drives both the share view AND render-time source for all document modules

### `document_templates` (generic template object)
- `company_id` (FK → companies)
- `type`: enum (proposal | freebie | new_hire_packet | vision_map | product_sheet | pricing_breakdown | policies_sheet | links_page)
- `structure` (JSON — ordered sections with field definitions)
- `is_default` (bool — platform-seeded starter vs. company-customized)

### `generated_documents` (instance rendered for a specific client)
- `template_id` (FK → document_templates)
- `client_id` (FK → clients, nullable)
- `field_values` (JSON)
- `status`: draft | finalized | sent | viewed
- `gdrive_file_id`, `gdrive_folder_id`, `last_synced_at`

One template + brand kit + client data → rendered document, no manual rebuild per client.

## File Storage Architecture: External by Design (Google Drive)
Decision: generated documents/files live in the company's own Google Drive, not Backstage's DB. Platform references, does not own. This is a mission-level anti-lock-in decision — a founder who stops paying must still walk away with everything.

- Storage refs live on `generated_documents` (`gdrive_file_id`, `gdrive_folder_id`, `last_synced_at`)
- Google Drive OAuth per company (Phase 2: each external customer connects theirs)
- On generation/export: write file into company's Drive folder, store only the reference
- Platform surfaces link to / embed the Drive file rather than serving from Backstage storage
- Auto-created folder structure (e.g. `Backstage / Clients / {client name} / ...`)
- Honest trade-off: Backstage can reference but not fully control the files — handle broken/missing refs gracefully (re-link prompt, never crash)
- Backstage DB = system of record for structured data; Google Drive = system of record for files

## Template Modules
1. **Proposal Generator** (SP) — `proposals` + `document_templates` type `proposal`. Modular sections (scope/timeline/investment/next-steps), auto-populate from `intake_responses` + discovery-call notes, brand-styled render, client-facing web view in `/portal` + PDF export to Drive, Accept/Decline sets `proposals.status` and triggers agreement send. This is the client-facing Vision + Needs Report page.
2. **Freebie / Lead Magnet Builder** (GS) — locked brand styling, editable copy blocks only, PDF export to Drive, delivery hook (opt-in gate/direct link/landing embed), `funnel_placement` field, seed defaults: Digital Credibility Checklist, Systems Leak Checklist.
3. **New Hire Packet Generator** (IB) — welcome letter, role expectations, tools/access checklist, values page, first-week schedule; placeholders from `brand_kits`; solo-founder vs. small-team variants.
4. **Onboarding Form Engine / Intake Questionnaire** (CJA) — creates `clients` + `intake_responses`. Public native stepped wizard (not external form tools), conditional branching, on submit creates `clients` row at `stage = lead` + auto-tags `clients.track`, confirmation sets discovery-call expectation. Replaces manual client creation.
5. **Links Page Builder** (GS) — hosted brand-styled link-in-bio per client/company at `/l/{slug}`, primary CTA + 3–5 secondary links + social icons, mobile-first.
6. **Vision Map Module** (GS) — visual roadmap (timeline or milestone-map), milestones from discovery-call capture tied to `clients.track`, presented at sales stage, viewable in `/portal`.
7. **Product Sheet Generator** (SP) — per-offer sheet: included/timeline/outcome/investment; seed from Backstage's own stack (Workbook, Stress-Free Freelancer, Backstage Method).
8. **Pricing Breakdown Module** (IB) — transparent "what you're paying for and why," optional cashflow-bands teaching layer (Profit ~30–40%, Expenses 10–30%, Labor 0–30%, Taxes ~15%, Charity ~10%, customizable per company), toggle client-deliverable vs. internal-only.
9. **Brand Kit Module** (IB) — editable UI for logo/palette/typography/imagery/tone/do's & don'ts; the shareable `/brand/{share_slug}` view; single source every other template reads from; must validate before dependent modules generate.
10. **Policies Cheat Sheet Module** (IB) — payment terms, cancellation window, communication hours, revision limits; one-page quick reference (agreements/DocuSign is authoritative); affirmative framing enforced.

## System Engines
1. **Digital Hub** (IB) — central dashboard: `/portal` link, active `generated_documents` (linked to Drive), key contacts, resources; role-scoped (founder/team vs. client_users). Recommend: `/portal` is the client's Digital Hub, internal Today page is the team's.
2. **Client Journey Engine** (CJA) — state machine on `clients.stage`: lead → proposal_sent → active → delivered → archived. Each transition fires Trigger Logic table actions (e.g. `agreements.status = signed` → `clients.stage = active` + auto-create `projects` row). Human-handoff flags for manual-action stages. "Stalled" detection past threshold. Note: `clients.stage` and `tasks.status` share the word "active" but are unrelated vocabularies — do not conflate.
3. **Marketing System** (GS) — newsletter (The Green Room) subscriber list/scheduling, freebie → nurture-sequence automation, content calendar with ownership, contextual (not clustered) testimonial rotation.
4. **Sales System** (SP) — discovery-call capture form feeding Vision Map + proposal generation, proposal follow-up cadence automation, objection-handling reference per track, ties `proposals.status` into Client Journey.
5. **Infrastructure Engine** (IB) — Stripe + DocuSign + Google Drive webhooks/OAuth wired to entity state; DocuSign envelope signed → `agreements.status = signed` → `clients.stage = active` → auto-create `projects`; Stripe `invoice.paid` → `invoices.status = paid` reflected in `/portal`; manual-fallback paths if integration down; per-company credential storage; broken-Drive-reference handling.

## Build Order (Dependency-Driven)
1. Immediate next: Project Management UI (team creates a `projects` row from Internal View, client_user sees it in `/portal` immediately) — unblocks end-to-end portal testing.
2. `brand_kits` module + Google Drive OAuth — root dependencies, nothing on-brand renders without the kit, nothing stores/exports without Drive.
3. Onboarding Form Engine (intake wizard) + Client Journey Engine — the intake data + `clients.stage` state machine everything downstream depends on.
4. Proposal Generator + Vision Map — sales-stage documents (depend on intake + brand kit).
5. Policies + Pricing modules — trust/transparency layer.
6. New Hire Packet, Product Sheets, Links Page, Digital Hub — remaining document modules, parallelizable once 1–3 stable.
7. Marketing System + Sales System engines — process/cadence layers, refined once documents they orchestrate exist.
8. **The Home Dashboard (front door / Today page)** — built last in sequence but designed first in intent. A read-and-suggest layer over everything above. Every module from step 2 onward should be built already knowing it must feed this dashboard — expose queryable state and registerable suggestions from the start.

## Multi-Tenancy Note (Phase 2 — does NOT exist yet)
Everything scopes to `company_id` (the founder's own sub-brands). True multi-tenancy (other businesses signing up) is a future phase, deliberately not built now. When it comes: a tenant concept sits above `companies`, each tenant fills in their own `brand_kits` once, every document module immediately generates on-brand output for their business. Backstage's own seed defaults (offer stack, freebies, cashflow bands) become starter templates a new tenant customizes. Do not build tenant/org scaffolding now; don't hardcode anything that would block adding it later.

---

# Backstage — Templates & Systems Breakdown
_(Companion overview doc — the toolset described here maps 1:1 to the "Template Modules" and "System Engines" sections above, but framed by legacy third-party tool (HoneyBook/Canva/Showit/Notion) rather than native schema. Useful for understanding what each module replaces.)_

Mission reference: every item hands the founder back time, clarity, or peace of mind — never "here's what you're missing," always "here's what multiplying yourself looks like."

**Templates:** Proposals (HoneyBook/Canva, SP) · Freebies (Canva, GS) · New Hire Packet (TBD, IB) · Onboarding (Forms, CJA) · Links Page (Showit, GS) · Vision Map (TBD, GS) · Product Sheets (TBD/Canva, SP) · Pricing Breakdown (TBD, IB) · Brand Kit (TBD/Canva, IB) · Policies Cheat Sheet (TBD, IB) — each with its own SOP checklist for internal handoff, detailed in the source doc.

**Systems:** Digital Hub (IB) · Client Journey (CJA) · Marketing System (GS) · Sales System (SP) · Infrastructure (IB) — same five engines as above, described from the legacy-tool-stack perspective (HoneyBook, Stripe, DocuSign, custom task assigner, Showit) rather than native schema.

**Build Priority Suggestion (legacy framing, consistent with native build order above):**
1. Brand Kit (foundation for all visual templates)
2. Onboarding Forms + Client Journey system
3. Proposals + Vision Map
4. Policies Cheat Sheet + Pricing Breakdown
5. New Hire Packet, Product Sheets, Links Page, Digital Hub (parallelizable)
6. Marketing System + Sales System
