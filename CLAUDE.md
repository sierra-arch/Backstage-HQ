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
- **Multi-tenancy (other businesses signing up) is not built.** Everything
  scopes to `company_id` for now. Don't add tenant/org scaffolding, but
  don't hardcode anything that would block adding it later.
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
Garamond serif headlines) was tried and then **reverted the same day at
the founder's request** ("return to the original color scheme"). The app
is back to its original teal accent (`#1B7E70`/`#15685D`) on a light
neutral background, Plus Jakarta Sans throughout, `rounded-xl` buttons/
cards. Do not re-apply the ember/forest palette without the founder
explicitly asking for it again.
- **Still open:** Sierra's real brand display font is "Spicy Margarita"
  (hand-script/display style) — she's uploaded the .woff file in
  conversation but it has not been wired into the app yet. Likely
  candidate: the "Backstage" wordmark / headline moments, not body text —
  confirm placement with her before wiring it in.

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
