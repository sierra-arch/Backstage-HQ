# Backstage HQ — Client Portal Expansion / Design & Feature Specification (v1)

**Status: pasted by the founder 2026-07-22. Supersedes nothing yet — reconcile
against `CLAUDE.md`'s Architectural Non-Negotiables and `claude/roadmap.md`
before building any section below.** See the "Reconciliation note" at the
bottom of this file for the one direct conflict found so far.

Purpose of this doc: a complete, build-ready spec for expanding Backstage HQ
from an internal productivity dashboard into a three-tier platform: Public,
Client, and Internal. Written to be handed directly to Perplexity for
research/scaffolding or pasted into VS Code / Claude Code as a build brief.

Core constraint: this must work for any service-based entrepreneur (not just
Prose Florals), so every feature below is written as a universal capability
with brand/content as the configurable layer, not the hardcoded one.

## 1. Vision

Backstage HQ becomes the operating system for a solo entrepreneur or small
team running client-based service work (florals, photography, coaching,
design, etc.). One codebase, three experiences:

| View | Who sees it | Core question it answers |
|---|---|---|
| Public | Prospects, general visitors | "Can I trust this business and what do they offer?" |
| Client | Active/past clients | "Where does my project stand, and what do I need to do?" |
| Internal | Founder + team | "What needs my attention today, and what can I automate?" |

The unifying thread: the internal view is the engine, the client view is the
window into it. When the team moves a task, the client portal reflects it
live — no separate status update needed.

## 2. System architecture: three views

### 2.1 Public view
- Marketing site / landing pages (brand-configurable templates)
- Freebies / lead magnets (downloadable guides, pricing sheets, quizzes)
- Service/offer pages
- Lead capture forms → feed into Internal CRM/leads table
- Booking/inquiry form → triggers proposal workflow
- Testimonials/portfolio gallery (pulled from completed Client projects, with a "feature this" toggle in Internal)
- Optional: public blog/content hub

### 2.2 Client view
- Client login (magic link or password, scoped to their org/project only)
- Proposal: view, e-sign, deposit/payment
- Onboarding: intake forms, welcome sequence, contract signature
- Project dashboard: live task/status view (read-only mirror of Internal tasks marked "client-visible")
- Delivery checklist: itemized deliverables with approve / request changes actions
- Messaging/comments: threaded per task or per deliverable
- Files: shared folder (contracts, final files, invoices)
- Offboarding: wrap-up summary, testimonial request, referral prompt
- Billing: invoice history, payment status

### 2.3 Internal view (founder + team)
- Everything currently in Backstage HQ (Today, Meetings, Tasks, Companies, Playbook, My Team, XP/leveling)
- CRM/leads: pipeline from public inquiries → proposal → won/lost
- Client roster: all active/past clients, project status at a glance
- Automation tools: triggers (e.g. "proposal signed → send onboarding form → create task list from template")
- Email marketing: sequences, broadcast, list segmentation
- Sales tools: proposal templates, pricing calculators, follow-up reminders
- Social media tools: content calendar, post drafts, scheduling
- Task organization: existing task system, extended with a `client_visible` flag per task
- Team roles/permissions: who can see/do what (founder, team member, contractor)
- Reporting: revenue, client satisfaction, team workload

## 3. Client journey map (detailed)

| Stage | Client experiences | Team does / automation fires | Data touched |
|---|---|---|---|
| 1. Discovery | Browses public site, downloads freebie, submits inquiry form | Lead lands in CRM; auto-tag by service type; team gets notified | `leads` |
| 2. Proposal | Receives proposal link, reviews scope/pricing, e-signs, pays deposit | Team builds proposal from template; on signature → auto-create client record + project | `proposals`, `clients`, `payments` |
| 3. Onboarding | Fills intake form, signs contract, sees welcome message | Auto-generate task checklist from project-type template; assign team owner | `projects`, `tasks`, `forms` |
| 4. Active project | Views live task/status board, comments, gets notifications on updates | Team works tasks in Internal; toggling `client_visible` reflects instantly in Client view | `tasks`, `comments`, `notifications` |
| 5. Delivery | Reviews deliverable checklist, approves or requests changes | Team marks deliverables ready; client action updates status; revisions loop back to tasks | `deliverables`, `approvals` |
| 6. Offboarding & referral | Sees wrap-up summary, leaves testimonial, gets referral incentive | Auto-trigger testimonial request + referral email sequence; archive project | `testimonials`, `referrals` |

This loop is also the backbone for the universal template system — each stage
should map to a configurable workflow template so a photographer's "delivery"
(gallery link) looks different from a florist's (event day checklist)
without changing the underlying data model.

## 4. Feature specs by view

### 4.1 Public view — features
- [ ] Templated landing page builder (sections: hero, services, testimonials, CTA)
- [ ] Lead capture form → writes to `leads` table, triggers notification
- [ ] Freebie delivery (email-gated downloads)
- [ ] Booking/inquiry form with service-type routing
- [ ] Testimonial wall (auto-pulled from approved Client testimonials)
- [ ] SEO basics (meta tags, sitemap, per-page config)
- [ ] Custom domain support (for white-label/multi-tenant use)

### 4.2 Client view — features
- [ ] Auth: magic link login scoped to one client record
- [ ] Proposal viewer + e-signature + deposit payment (Stripe)
- [ ] Onboarding form flow (dynamic, template-driven per service type)
- [ ] Project dashboard: task list filtered to `client_visible = true`
- [ ] Status badges synced live from Internal (no manual "send update" step)
- [ ] Deliverable checklist with approve/request-changes actions
- [ ] Comment threads per task/deliverable
- [ ] File/document repository (contracts, invoices, final assets)
- [ ] Notifications (email/SMS) on status changes
- [ ] Offboarding summary + testimonial + referral capture
- [ ] Billing/invoice history

### 4.3 Internal view — features
- [ ] Existing dashboard (Today, Focus, XP/leveling, Brand/Business Snapshot) — retained
- [ ] CRM/leads pipeline (kanban: New → Contacted → Proposal sent → Won/Lost)
- [ ] Client roster with project health indicators
- [ ] Task system extended with `client_visible` toggle per task
- [ ] Automation builder: trigger → condition → action (e.g. Zapier-style, but native)
- [ ] Proposal/contract templates with variable fields
- [ ] Email marketing: sequences, broadcasts, segmentation
- [ ] Social media planner: calendar, drafts, scheduling, post status
- [ ] Team roles: founder / team member / contractor, with per-module permissions
- [ ] Reporting dashboard: revenue, pipeline value, task completion, team workload
- [ ] Template manager (so the same "project type" template can be reused/cloned across clients)

## 5. Data model (core entities, as originally proposed)

```
organizations (tenant)
  id, name, slug, brand_config (colors/fonts/logo), plan, created_at

users
  id, org_id, role (founder|team_member|contractor), email, name

clients
  id, org_id, name, email, status (lead|active|past), source

leads
  id, org_id, name, email, service_type, status, created_at

proposals
  id, org_id, client_id, template_id, status (draft|sent|signed|declined), amount, signed_at

projects
  id, org_id, client_id, project_type, status, target_delivery_date

tasks
  id, org_id, project_id, title, status, assignee_id, client_visible (bool), due_date

deliverables
  id, project_id, title, status (pending|delivered|approved|revision_requested)

comments
  id, task_id|deliverable_id, author_id, author_type (team|client), body, created_at

payments
  id, org_id, client_id, proposal_id, amount, status, stripe_ref

automations
  id, org_id, trigger_type, condition, action, active (bool)

templates
  id, org_id, type (proposal|onboarding|task_list), content_json

testimonials
  id, org_id, client_id, body, approved (bool), featured (bool)
```

Row-level security (Supabase RLS) should scope every table by `org_id`, and
additionally by `client_id` for Client-view queries — a client must never be
able to query another client's row.

**⚠️ This is the abstract version of the model. The live database already has
a real, more evolved schema covering much of this ground under different
names — see "Reconciliation note" below before implementing any table here.**

## 6. Multi-tenancy & universal/white-label requirements

Since this becomes a product for other entrepreneurs, not just your own use:
- Tenant isolation: every table keyed by `org_id`; Supabase RLS policies enforce it at the database level, not just in app logic.
- Brand configuration layer: logo, color palette, tone-of-voice strings, tier/level names (your florals-themed "Seed → Sprout → Bloom..." naming is a default template, not hardcoded — other tenants should be able to rename tiers to fit their brand).
- Template library: proposal templates, onboarding flows, task-list templates should be duplicable/customizable per org, with a shared starter library.
- Custom domains: public + client views should support a custom domain or subdomain per org (`clientname.yourplatform.com` or their own domain via CNAME).
- Plan/tier gating: if this becomes a paid SaaS, feature flags per plan (e.g. automations and email marketing gated to higher tiers).
- Onboarding for new orgs: a "set up your business" wizard mirroring the client onboarding flow — dogfood your own UX.

## 7. Roles & permissions matrix

| Capability | Founder | Team member | Contractor | Client |
|---|---|---|---|---|
| View/edit all tasks | ✅ | ✅ (assigned + shared) | Assigned only | ❌ |
| View client-visible tasks | ✅ | ✅ | ✅ | ✅ (own project only) |
| Send proposals | ✅ | Configurable | ❌ | ❌ |
| Manage automations | ✅ | ❌ | ❌ | ❌ |
| Email marketing | ✅ | Configurable | ❌ | ❌ |
| View revenue/reporting | ✅ | Configurable | ❌ | ❌ |
| Approve deliverables | N/A | N/A | N/A | ✅ (own project) |
| Manage team roles | ✅ | ❌ | ❌ | ❌ |

## 8. Tech stack — extending what you have

Keep: React, Vite, Tailwind (recommend migrating off CDN Tailwind to a proper
build-time config as the app grows — CDN Tailwind doesn't tree-shake and will
slow down a multi-view app), Supabase, framer-motion, dnd-kit, react-confetti.

Add:
- Auth: Supabase Auth with row-level security, separate scoped sessions for client logins vs internal team logins
- Payments: Stripe (proposals/deposits/invoicing)
- E-signature: either build a lightweight signature-capture flow or integrate a service (e.g. Documenso, an open-source DocuSign alternative, if you want to self-host)
- Email: Resend or Postmark for transactional email; a separate marketing-sequence tool (or build a simple one on top of Resend) for broadcasts
- Automation engine: start simple — an `automations` table with trigger/condition/action rows evaluated by a Supabase Edge Function or a small worker service; avoid over-engineering with a full workflow engine until you have real usage patterns
- Social scheduling: either integrate a service (Buffer/Ayrshare API) or scope this as "draft + calendar" only in v1, with manual posting
- Routing: if not already, split into three route groups (`/app/*` internal, `/portal/:clientSlug/*` client, `/*` public) using React Router, each with its own auth guard

## 9. Suggested build phases (spec's own proposal)

1. Foundation: multi-tenant data model + RLS, role-based auth for internal vs client sessions
2. Client portal core: proposal viewer + e-sign + client task dashboard (read-only mirror of Internal tasks)
3. Client → Internal sync: `client_visible` toggle, live status sync, comments
4. Public view: landing pages + lead capture → CRM
5. Automations v1: signature → onboarding form → task template generation
6. Delivery & offboarding: checklist approvals, testimonial/referral loop
7. Growth tools: email marketing, social planner, sales tools
8. White-label polish: brand config UI, custom domains, plan gating

## 10. Handoff prompts

For Perplexity (research mode):
> "I'm building a multi-tenant SaaS for service-based entrepreneurs with three
> view types: public marketing site, client portal (proposals, onboarding,
> live project tracking, deliverable approval), and internal team dashboard
> (CRM, automations, email marketing, social scheduling). Stack: React + Vite
> + Tailwind + Supabase. Research best practices for: (1) Supabase RLS
> patterns for multi-tenant + client-scoped access, (2) lightweight
> e-signature implementation options, (3) automation/workflow engine patterns
> that don't require a full external service like Zapier."

For VS Code / Claude Code (build mode):
> "Using the attached spec (`backstage-hq-client-portal-spec.md`), scaffold
> the multi-tenant data model in Supabase (Section 5), then implement Phase 1
> from Section 9: RLS policies for organizations, clients, projects, tasks
> scoped by `org_id`, plus a `client_visible` boolean on tasks. Set up two
> auth flows: internal team login and client magic-link login scoped to a
> single `client_id`."

This spec is designed to evolve — treat Section 5 (data model) and Section 9
(phases) as the two things to revisit first as you build.

---

## Reconciliation note (added 2026-07-22, do not delete on next edit)

Three things any session (Perplexity or local Claude Code/VS Code) must
resolve before touching code, so the two environments don't fight each other:

1. **This spec's Section 5 data model is abstract/aspirational — the live
   database already has a real, more evolved schema.** Do not create
   `organizations`, `clients` (with `status` enum), or `payments` fresh —
   check `claude/vocabulary-reference.md` and the live schema first. As of
   this note, the real tables already cover much of this spec:
   - `companies` already plays the role of `organizations` (one row so far, `company_id` FK on nearly every table).
   - `clients` already exists with a richer `stage` enum (`lead → proposal_sent → active → delivered → archived`) — a dedicated `leads` table is still a gap for public-form capture, but `clients.stage = 'lead'` already models the CRM's first stage.
   - `client_users` already exists (magic-link identity, separate from `profiles`).
   - `proposals`, `agreements`, `projects`, `invoices`, `payment_schedules`, `payment_installments`, `intake_responses`, `document_templates`, `generated_documents`, `brand_kits` already exist and are more granular than this spec's `proposals`/`payments`/`templates` tables — a live Proposal Generator with line-item selection is already built (see `claude/roadmap.md` Milestone 5).
   - Real gaps against this spec: `leads` (dedicated table), `deliverables`, `comments` (client-facing threaded, distinct from the internal `messages` table), `automations`, `testimonials`. These are genuinely new.
2. **Direct conflict with `CLAUDE.md`'s Architectural Non-Negotiables:** the
   file previously stated "Multi-tenancy (other businesses signing up) is not
   built... don't add tenant/org scaffolding." On 2026-07-22 the founder
   decided to build full multi-tenant infrastructure from day one instead of
   deferring it — see the updated Non-Negotiables section in `CLAUDE.md`
   for the current, authoritative decision. If that section and this note
   ever disagree again, `CLAUDE.md` wins — it's the one file every session
   is required to read first.
3. **E-signature and social scheduling vendor picks are still open.** Cost
   research done 2026-07-22 (session `1fd61cf5-6dfd-45a4-b865-2b04a76f6d94`):
   Documenso free cloud tier is 5 docs/month, Individual plan $25-30/mo,
   self-hosted free under AGPL-3.0 ([Documenso pricing](https://documenso.com/pricing)).
   Ayrshare has no real free production tier, starting ~$149/mo
   ([Ayrshare pricing](https://www.ayrshare.com/pricing/)). Resend's free
   tier (3,000 emails/mo, 100/day cap) covers transactional email needs
   ([Resend pricing](https://resend.com/pricing)). Whichever session builds
   these features should re-confirm current pricing before committing to a
   vendor, since this table can go stale.
