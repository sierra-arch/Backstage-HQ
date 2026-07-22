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
**Internal nav:** Today · Meetings · Tasks · Companies · Playbook · My Team ·
Career Path · Settings

## Already Built — Don't Re-spec or Rebuild

- Migrations `0001`–`0006` (schema + RLS lockdown + client-scoped RLS) in `supabase/migrations/`
- `api/invite-client.ts`, "Invite to Portal" button (in `ClientModal`, `src/DashboardApp.tsx`)
- `client_owns()` / `is_team_member()` RLS helper functions
- `projects` table + `/portal` read-side (`src/ClientPortalApp.tsx`)
- **Milestone 1: Project Management UI** — `CreateProjectModal`/`ProjectModal` in `src/DashboardApp.tsx` (nested in `ClientModal`'s new Projects section), `useProjects`/`createProject`/`updateProject`/`resolveProfileIdByName` in `src/useDatabase.ts`. Also fixed a pre-existing bug where `TaskCreateModal` never actually saved the selected assignee.
- **Milestone 2, Phase A: Brand Kit** — migration 0008, `BrandKitEditModal` (opened from `CompanyModal`), and the first fully public no-login page in this app: `/brand/{share_slug}` (`src/BrandKitShareView.tsx`). Google Drive OAuth (Phase B) is not started — blocked on the user creating credentials in their Google Cloud project; see `claude/roadmap.md` for the exact steps and the ready-to-execute build design.
- `api/chat.ts` — AI task assistant (separate feature, unrelated to the client lifecycle work)
- `mcp-server/` — separate MCP integration for Claude Code, not part of the web app

## Current Priority

**Milestone 2, Phase B: Google Drive OAuth** — blocked on the user setting
up credentials in their existing Google Cloud project (enable Drive API,
add the narrow `drive.file` scope, create a new OAuth Client ID, hand over
Client ID/Secret). Once those arrive, the schema and flow are already
designed in `claude/roadmap.md` and ready to build. If that's still
pending, **Milestone 3 (intake wizard + Client Journey state machine)** can
be started instead — it doesn't depend on Drive.

Full 13-milestone roadmap + the detailed schema plan for the Proposal
Generator milestone: `claude/roadmap.md`. Do not start a milestone out of
order without checking that doc's dependency notes first.

## Architectural Non-Negotiables

- **Files live in Google Drive, not our database.** Generated documents
  (proposals, freebies, etc.) get written to the company's own Google
  Drive; we store only a reference (`gdrive_file_id`). This is intentional
  — a founder who stops using the platform must still walk away with
  everything. Do not "simplify" this by moving file storage into our own DB.
- **⚠️ RESOLVED (2026-07-22) — supersedes the line below:** the founder
  confirmed she *does* want team gamification (XP/points, levels, streaks,
  kudos, a Career Path view) for the 2-person internal team. A separate,
  independently-evolved branch of this codebase (`legacy-gamified-internal-ui`
  on GitHub) already built this against an older, since-diverged internal
  schema/UI (separate `TodayPage`/`MeetingsPage`/`MyTeamPage`/
  `CareerPathPage`/`PlaybookPage`/`Navigation` files, `points_log` table).
  That branch predates the client-lifecycle work in this codebase and can't
  be merged as-is (both sides heavily rewrote `DashboardApp.tsx`
  independently). Next step: re-implement gamification as a scoped feature
  on top of *this* codebase (reference the legacy branch for design/logic,
  don't copy-paste wholesale), and decide deliberately where it surfaces
  (e.g. Settings/My Team page, not necessarily the main Today view) so it
  doesn't conflict with the calm-dashboard principle below for the primary
  landing view.
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
- **Multi-tenancy (other businesses signing up) is not built.** Everything
  scopes to `company_id` for now. Don't add tenant/org scaffolding, but
  don't hardcode anything that would block adding it later.
- **RLS-sensitive changes (anything touching `supabase/migrations/`) get
  written by Claude but run by the user against the live database** — never
  execute schema/security migrations autonomously. This project has no
  staging environment; the database is live and in daily use.

## Reference Docs (in `claude/` — read before big features)

- `claude/vocabulary-reference.md` — full terminology authority, current build status detail
- `claude/roadmap.md` — the 13-milestone build sequence + resolved schema decisions + the detailed Proposal Generator (milestone 5) plan
- `claude/saas-feature-spec.md` — the full template/systems/dashboard feature spec (source document the roadmap was built from)
- `claude/platform-spec.md` — original three-view architecture concept (defer to `roadmap.md` and `vocabulary-reference.md` on any naming conflict)

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
