# Nav & Feature Discoverability — Build Spec

*Backstage OS · Feature: making built features actually findable*
*Spec date: July 23, 2026 — hand this to VS Code / the dev agent.*
*Written after reading `Sidebar`, `CompanyModal`, `TeamManagementSection`,
`TestimonialsSection` directly in `DashboardApp.tsx`.*

---

## 1. What's Actually Going On (Read First)

Nothing here is missing functionality — it's a discoverability problem.
Confirmed by reading the live code:

- **`founderNav` already includes "Automation Web."** It's just not live on
  `backstage-dashboard.vercel.app` yet — the screenshot you shared is
  running a build from before that nav item and the automation-web feature
  files existed. This resolves itself on the next deploy, no fix needed
  here.
- **Career Path is intentionally team-only** — confirmed with you directly,
  not a bug. `founderNav` correctly omits it and `CareerPathPage`'s render
  condition correctly excludes founders. Leave as-is.
- **Proposals, Agreements, Invoices, Brand Kit, Templates, Team & Roles,
  and Testimonials are all real and built** — they just live nested inside
  `CompanyModal` (Brand Kit, Templates, Team & Roles, Testimonials) or
  `ClientModal` (Proposals, Agreements, Invoices), reached only by clicking
  "Companies" → a specific company card → scrolling. `CompanyModal` renders
  every section in one long vertical stack with small, easy-to-miss
  `<label>` headers ("Team & Roles," "All Clients & Projects") and zero way
  to jump between them. Brand Kit/Templates don't even get a label — just
  two buttons with no heading above them.
- **Settings exists but has no visible label anywhere.** It's reached by
  clicking your own name at the bottom of the sidebar (`onClick={() =>
  onSelect("Settings")}` on the `{userName}` button) — nothing on screen
  indicates that's clickable or what it does.
- **`CLAUDE.md`'s documented nav list is stale.** It currently says
  "Internal nav: Today · Meetings · Tasks · Companies · Playbook · My Team
  · Career Path · Settings" — missing Leads, Systems, Marketing, Automation
  Web, Reporting entirely, and implying Career Path is founder-visible when
  it isn't. Fixed alongside this spec (Section 5).

---

## 2. CompanyModal — Sticky Sub-Nav

Confirmed direction: **keep everything nested inside Companies** (these are
correctly per-company, not standalone datasets worth cluttering the main
sidebar with), but make what's inside visible and jumpable.

Add a sticky horizontal tab row directly under `CompanyModal`'s header
(company logo/description), above the Social Links section. Lowest-risk
approach: **anchor-scroll, not a full tab-switch rewrite** — every section
keeps rendering exactly as it does today (same components, same order,
same conditional logic like `TeamManagementSection`'s `members.length <= 1`
early return); the tab row just scrolls the modal to that section's
existing `<label>`/heading. This avoids touching any of the actual
section logic — purely a navigation aid layered on top.

```
[Overview] [Clients & Projects] [Brand Kit] [Templates] [Team & Roles*] [Testimonials]
```

`*` Team & Roles tab only renders if the current user would actually see
that section (mirrors the existing `members.length <= 1` check — don't
show a tab that jumps to nothing).

Two small content fixes while this is being touched:
- Give the Brand Kit / Templates button row an actual `<label>` heading
  (currently has none), matching the style already used for every other
  section — call it "Documents."
- Since Brand Kit and Templates currently open as separate modals-on-top-
  of-a-modal (`showBrandKitModal`/`showTemplateManager`), not inline
  sections, their sub-nav tabs should just trigger those existing modals
  directly rather than trying to scroll to them (they're not part of the
  vertical stack).

---

## 3. Settings — Make It Visible

Minimal fix: add a small label/icon next to the username at the bottom of
`Sidebar` so it reads as a real nav affordance instead of just a name.
Simplest version — a small gear icon button next to `{userName}`, both
routed to the same `onSelect("Settings")` handler that already exists.
Doesn't need its own line in `founderNav`/`teamNav` (it's deliberately
positioned separately from the main nav list, which is fine) — it just
needs to look clickable.

---

## 4. Founder-Only Actions — Proposed Default

You confirmed some nested actions should stay founder-only even once a
team member can see a company. Proposed list, grounded in what's already
partially true in the code today (adjust freely — this is a starting
point, not a final answer):

**Already founder-gated today, keep as-is:**
- Adding a client/project or product (`isFounder(role) &&` around those
  buttons in `CompanyModal`)
- Changing a team member's role (already RLS-enforced via
  `founders_manage_company_memberships`, though the UI doesn't currently
  hide the dropdown from non-founders — worth adding a matching UI-level
  `isFounder(role)` check so it doesn't show a control that silently fails)

**Proposed new founder-only gates:**
- Sending a proposal to a client (drafting one can stay open to team,
  matching the existing Preview/Explanation/Decision spirit — a team
  member can prepare it, but the founder sends it)
- Marking an agreement signed / approving a payment-related action
- Editing Brand Kit (company-level brand identity, not per-client work)
- Removing a team member or a client

**Stays open to any team member who can see the company:**
- Viewing everything nested in `CompanyModal`/`ClientModal`
- Drafting/editing a proposal before it's sent
- Marking Systems complete, using Automation Web (within department
  clearance from the existing specs)
- Testimonials, comments

This list should get revisited once the department/clearance system from
`claude/automation-web-build-spec.md` ships — right now it's a coarse
founder/not-founder split, not department-scoped.

---

## 5. `CLAUDE.md` Correction

Update the "Internal nav" line in the Terminology section to match the
real `founderNav`/`teamNav` arrays instead of the stale list:

> **Internal nav (founder):** Today · Meetings · Tasks · Leads · Systems ·
> Marketing · Automation Web · Reporting · Companies · Playbook · My Team ·
> Settings (via username, not a nav row item)
> **Internal nav (team):** Today · Tasks · Leads · Systems · Marketing ·
> Automation Web · Reporting · Companies · Playbook · Career Path ·
> Settings
> Leads/Marketing/Reporting/Systems are hidden for contractor-only
> profiles. Proposals/Agreements/Invoices/Brand Kit/Templates/Team &
> Roles/Testimonials are nested inside Companies, not top-level nav items
> — see `claude/nav-and-discoverability-spec.md`.

---

## 6. Acceptance Criteria

1. Opening any company shows a sticky tab row; clicking a tab scrolls to
   (or opens, for Brand Kit/Templates) that section.
2. Team & Roles tab doesn't appear for a viewer who wouldn't see that
   section anyway.
3. Settings has a visible icon/label, not just a clickable name.
4. The founder-only actions listed in Section 4 are gated consistently in
   both UI (control hidden/disabled) and RLS (already true for team role
   changes; needs adding for the new proposed gates).
5. `CLAUDE.md`'s nav documentation matches the real code.
