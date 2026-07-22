# Backstage Platform — Technical Spec v1

> Original architecture concept document. **Defer to `vocabulary-reference.md`
> and `roadmap.md` on any naming conflict** — this doc predates the resolved
> terminology (it uses "Organization"/`org_id`, "admin"/"team_member", and
> treats "client" as a role; the real terms are `companies`, `founder`/`team`,
> and `client_users` — see `vocabulary-reference.md`). Kept for the
> conceptual architecture and trigger-logic reasoning, which are still valid.

## Vision

Extend the existing internal task-assigner app into a full three-view
platform — Public, Client, Internal — sharing one backend and one data
model. Phase 1 ships as an internal tool for Backstage/Prose Florals to use
and beta-test on real clients. Phase 2 converts it into a multi-tenant SaaS
other creative-service businesses can sign up for themselves.

**Core principle:** one Client record, created once, read and written to by
every stage after that. No re-entering data between views.

---

## Architecture Overview

```
                    ┌─────────────────────────────┐
                    │       Shared Backend          │
                    │  (single data model, roles)   │
                    └───────────────┬───────────────┘
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                          │
   ┌──────▼──────┐          ┌───────▼────────┐         ┌───────▼───────┐
   │ Public View │          │  Client View   │         │ Internal View │
   │ (no login)  │          │ (client login) │         │ (team login)  │
   └─────────────┘          └────────────────┘         └───────────────┘
```

The Client View portal should be built as a **permission-scoped view into
the same app** the Internal View already runs on — not a separate app
talking over an API. Same tables, different role/login, filtered by what a
client is allowed to see.

---

## Data Model

Core entities (as tables/objects — exact schema is a developer decision,
this is the conceptual shape):

### `Client`
- id, name, business name, contact info
- track: `Freelancer` / `Founder Mini` / `Founder Full` / `CEO`
- stage: `Lead` → `Proposal Sent` → `Active` → `Delivered` → `Archived`
- source: which freebie/entry point brought them in
- created_at, updated_at

### `IntakeResponse`
- client_id (FK)
- questionnaire answers (raw)
- auto-tagged track recommendation (drives `Client.track`)

### `Proposal`
- client_id (FK)
- linked to Vision + Needs Report content
- status: `draft` / `sent` / `viewed` / `accepted` / `declined`
- generated_from: intake answers + discovery call notes (auto-populated where possible)

### `Agreement`
- client_id (FK), proposal_id (FK)
- docusign_envelope_id (external reference — DocuSign is source of truth for the signed document itself)
- status: `sent` / `signed` / `voided`
- signed_at
- **on status → `signed`: fires `Client.stage → Active` and auto-creates matching `Project` record**

### `Project` (this may already exist in the internal tool — extend, don't duplicate)
- client_id (FK)
- tasks (existing task-assigner structure)
- status, timeline, assigned team members

### `Invoice`
- client_id (FK), project_id (FK)
- stripe_invoice_id / stripe_payment_intent_id (external reference)
- amount, status: `unpaid` / `paid` / `overdue`
- **on status → `paid`: updates portal display + can trigger internal notification**

### `User` / `Role`
- role: `admin` (you), `team_member` (ops coordinator, VA), `client`
- role determines which View + which filtered data a login can see

---

## View Specifications

### 1. Public View
No login required. Lead-facing.
- Website (Showit/Martini build — stays as-is, separate from the app)
- Freebies: Digital Credibility Checklist, Systems Leak Checklist
- Workbook: Your Backstage Pass
- **Job:** convert stranger → lead who submits intake / books discovery call

### 2. Client View
Requires client login. Scoped to their own `Client` record only.
- **Intake:** questionnaire → creates `Client` + `IntakeResponse`, auto-tags track
- **Proposal:** client sees their Vision + Needs Report as a branded page; accept/decline action
- **Agreement:** embedded DocuSign signing flow (via DocuSign API/embedded signing, not a separate redirect if avoidable)
- **Portal:** read-only (or comment-only) window into their `Project` — status, timeline, completed deliverables, messages
- **Invoices:** Stripe-hosted invoice/payment page, status reflected in portal

### 3. Internal View
Already built. Team login.
- Task assignment, chat, project tracking
- Extend only as needed to support: auto-created projects (from signed agreements), and any fields the Client View portal needs to read from

---

## Integrations

### Stripe (payments)
- Create Stripe Customer + Invoice objects tied to `Client.id` / `Invoice` record
- Webhook: `invoice.paid` → update `Invoice.status` → reflect in Client View portal
- Do not store card data directly — Stripe hosts the payment page/checkout

### DocuSign (e-signature)
- Send envelope on proposal acceptance, tied to `Agreement.docusign_envelope_id`
- Webhook: envelope completed → update `Agreement.status = signed` → **trigger:** create `Project`, flip `Client.stage = Active`
- DocuSign remains the legal source of truth for the signed document; app stores reference + status only

---

## Trigger Logic (event → automated action)

| Event | Automated Action |
|---|---|
| Intake questionnaire submitted | Create `Client` + `IntakeResponse`; auto-tag track |
| Discovery call completed (manual flag) | Enable proposal generation for that client |
| Proposal marked "sent" | Client View unlocks proposal page for that client login |
| Proposal accepted | Trigger DocuSign envelope send |
| DocuSign envelope signed (webhook) | `Agreement.status = signed`; `Client.stage = Active`; auto-create `Project` in Internal View |
| Project created | Notify assigned team member(s) in Internal View |
| Stripe invoice paid (webhook) | `Invoice.status = paid`; update Client View portal display |
| Project status changed to "Delivered" | `Client.stage = Delivered`; optional: trigger testimonial request |

This table is the single most useful artifact to hand a developer alongside
the data model — it defines every automation without requiring the dev to
guess your process.

---

## Phased Roadmap

### Phase 1 — Internal Beta (Backstage + Prose as sole users)
- Build Client View as an extension of the existing custom app
- Single-tenant: no org/account switching needed yet, just your team + your clients
- Wire up Stripe + DocuSign
- Run every real Backstage and Prose client through it before touching Phase 2
- **Success criteria:** a full client lifecycle (intake → proposal → signed agreement → active project → paid invoice → delivered) runs with zero manual re-entry of data between stages

### Phase 2 — Multi-Tenant Conversion (future SaaS)
- Introduce `Organization` as a top-level entity above `Client` — every table above gets an `org_id`
- Each org gets its own branding (logo, colors) surfaced in their Client View and Public View pages
- Org-level Stripe/DocuSign credentials (each business connects their own accounts, not yours)
- Role model extends: `org_owner`, `org_team_member`, `client` — scoped per org

### Phase 3 — Self-Serve SaaS
- Public signup flow for new organizations (this becomes its own onboarding funnel — ironically, the exact kind of client-journey system this platform is built to run)
- Billing for the platform itself (Stripe again, one level up — org subscribes to use the tool)
- Templated intake questionnaires / proposal formats so new orgs aren't starting from a blank slate — likely seeded from what you build for Backstage's own track system

---

## Open Questions for the Developer

> Resolved — see `vocabulary-reference.md` and `roadmap.md`. Kept here for
> historical context on what was originally unknown.

1. What's the current internal app's stack (language/framework, database, hosting)? *Resolved: React + Vite, Supabase (Postgres + Auth), Vercel.*
2. Does the existing task-assigner already have a `Project` concept, or only flat tasks? *Resolved: flat tasks only; `projects` added as a new layer in migration 0002, with `tasks.project_id` as an optional FK.*
3. Auth: does the internal app already support multiple login roles, or is it currently single-user/team-only with no client-facing auth at all? *Resolved: was founder/team only via Google OAuth; `client_users` + magic-link added for client-facing auth, entirely separate from the internal `profiles`/`AuthGate` path.*
4. Embedded DocuSign signing vs. redirect-based — confirmed: embedded, pending the user verifying their DocuSign plan tier supports it (milestone 6, not yet built).

---

## Notes on Positioning (for later, not the dev's concern)

Once Phase 1 is proven internally, this platform *is* a Backstage Method
deliverable in its own right — potentially a future tier above the current
CEO-level offerings, or the eventual Templates Shop evolving into "the tool
itself" rather than templates for tools. Worth keeping in the back pocket
as the proof-of-concept story mirrors the Prose Florals origin story almost
exactly: built out of necessity, refined through real use, then offered to
others.
