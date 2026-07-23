# Stage System Buildout — Build Spec

*Backstage OS · Feature: Gamified Company Stage progression*
*Spec date: July 23, 2026 — hand this to VS Code / the dev agent.*
*Written after reading the live migrations (`0022`–`0026`), `SystemsPage`/
`SystemUnlockRow` in `DashboardApp.tsx`, `index.html`'s Tailwind config, and
`claude/roadmap.md`/`claude/backstage-os-philosophy.md`.*

---

## 1. What Exists Today (Read First)

- `companies.current_stage` (`'one' | 'two' | 'three'`, migration `0022`).
  Three-stage cap — no `'four'` value. Per the founder's confirmed
  direction: **keep three as the ceiling for now**; a fourth stage is a
  real future goal, but only once there's a concrete answer for what
  actually gets a business there — not specced yet, don't build toward it
  structurally beyond leaving the door open (the `check` constraint can
  simply be widened later; nothing today should hardcode "three is the
  max" anywhere except that one constraint).
- `system_unlocks` (migration `0024`): `company_id`, `system_name`,
  `template_type`, `stage`, `status` (`locked`/`available`/`in_progress`/`complete`).
  **Current unique constraint is `(company_id, template_type)`** — a
  `template_type` can only be unlocked once per company, at one stage,
  ever. This spec changes that (Section 3).
- `stage_transitions` + `check_stage_completion()` / `accept_stage_transition()`
  RPCs (migration `0024`, security-fixed in `0025`): offer-and-accept flow,
  confetti already fires on acceptance (`SystemsPage`'s `Confetti fire={celebrate}`).
- **Real gap found:** Stage One has 4 systems seeded (Vision Mapping, Sales
  Script Milestones, Branding Essentials, Policies Checklist). Stage Two
  has 2, explicitly documented as placeholders (New Hire Packet, Freebie
  Funnel). **Stage Three has zero systems seeded** — a company reaching it
  today sees an empty Systems page.
- **Real gap found, deeper:** even the "real" Stage One systems have no
  actual guided content. `SystemUnlockRow.handleCreate()` just calls
  `createTemplate()` with an empty `structure` — "Start" creates a blank
  doc, "Mark Complete" just self-flags it. Per the founder's explicit
  "breadth first" direction, **this spec does not fix that** — it's a
  real, separate follow-up (giving each system actual guided content/
  structure) once breadth is in place.
- **Bug found and reconciled:** `CLAUDE.md` claims the app was reverted to
  an original teal (`#1B7E70`/`#15685D`) after the ember/forest redesign
  was undone. The live `index.html` Tailwind config still has the
  forest-green remap (`teal-600: #1F7A52`) from that redesign — the revert
  never actually landed in code. **Founder's call: keep the current
  forest-green.** `CLAUDE.md` needs its "reverted" claim corrected (done as
  part of this spec — see Section 7); this is the true, confirmed Stage Two
  baseline color.

---

## 2. Confirmed Product Direction

- **Breadth first.** Fill in the missing systems per stage (from the
  founder's original handwritten notes, transcribed in
  `claude/roadmap.md`/the Notes Archive) and seed real Stage Three systems.
  Giving each system deeper guided content is an intentional follow-up, not
  this pass.
- **Systems reappear across stages, deepened.** The founder's notes list
  several system names at *both* the 5-figure and 6-figure stage
  (Vision Mapping, Pricing Breakdown, etc.) — confirmed intentional: a
  system a founder builds at Stage One should resurface at Stage Three "in
  further detail," not just exist once. Schema needs to support the same
  `template_type` being unlocked at more than one stage (Section 3).
- **Whole-app gamified theming.** Each stage gets a color — Stage One
  purple, Stage Two the current forest-green, Stage Three blue — and the
  *entire app chrome* (not just the Systems page) reflects whichever
  company is currently active, via a new global company switcher
  (Section 5).
- **Confetti twice over.** Keep the existing full-stage-transition confetti,
  and add a smaller celebration each time an individual system is marked
  complete (Section 6).
- **"Push the needle" ideas** extend the existing `safety_net_nudges`
  pattern (the same mechanism behind the cash-buffer/quiet-lead nudges) —
  not a new UI concept (Section 8).

---

## 3. Schema

### 3a. Let systems reappear across stages

```sql
-- New migration, e.g. 0027_stage_system_reappearance.sql

alter table public.system_unlocks drop constraint system_unlocks_company_id_template_type_key;
alter table public.system_unlocks add constraint system_unlocks_company_id_template_type_stage_key
  unique (company_id, template_type, stage);
```

A given `template_type` (e.g. `pricing_breakdown`) can now have one row at
Stage One and a separate row at Stage Three for the same company — each
with its own `status`. Add an optional `depth_note` column so the two
occurrences can carry different framing text without needing a second
table:

```sql
alter table public.system_unlocks add column depth_note text;
```

`SystemUnlockRow` should display `depth_note` under the system name when
present (e.g. Stage One's Pricing Breakdown: "Set your basic offer stack
and fulfillment costs." / Stage Three's: "Revisit with full margin and
multi-tier pricing analysis.").

### 3b. New `document_templates` types (Stage One breadth)

```sql
alter table public.document_templates drop constraint document_templates_type_check;
alter table public.document_templates add constraint document_templates_type_check
  check (type = ANY (ARRAY[
    'proposal','design_brief','contract','freebie','new_hire_packet',
    'product_sheet','pricing_breakdown','policies_sheet','links_page',
    'onboarding','vision_mapping','sales_script_milestones',
    'branding_essentials','policies_checklist',
    'client_journey_funnel','digital_hub_stack','fulfillment_checklist',
    'infrastructure_anatomy','cashflow_reports',
    'department_buildout','delegation_playbook'
  ]));
```

Five genuinely new types (`client_journey_funnel`, `digital_hub_stack`,
`fulfillment_checklist`, `infrastructure_anatomy`, `cashflow_reports`) plus
two for Stage Three (`department_buildout`, `delegation_playbook`).
`product_sheet` and `pricing_breakdown` already existed — reused, not
duplicated.

### 3c. Seed data

```sql
-- Stage One: the 4 existing systems stay as-is, plus 7 net-new ones
insert into public.system_unlocks (company_id, system_name, template_type, stage, status, unlocked_at)
select c.id, sys.name, sys.type, 'one',
  case when c.current_stage in ('two', 'three') then 'complete' else 'available' end,
  case when c.current_stage in ('two', 'three') then now() else null end
from public.companies c
cross join (values
  ('Simple Client Journey Funnel', 'client_journey_funnel'),
  ('Digital Hub Stack', 'digital_hub_stack'),
  ('Product Spec Sheets', 'product_sheet'),
  ('Pricing Breakdown', 'pricing_breakdown'),
  ('Fulfillment Checklists', 'fulfillment_checklist'),
  ('Infrastructure Anatomy', 'infrastructure_anatomy'),
  ('Cash Flow Reports', 'cashflow_reports')
) as sys(name, type)
on conflict (company_id, template_type, stage) do nothing;

-- Stage Three: seed as locked/available per existing company stage, same
-- pattern as Phase 21's Stage Two placeholder seeding. Two systems for now
-- (founder will add more later — this is a deliberate starting seed, not
-- an exhaustive list, since her notes don't give an explicit Stage Three
-- checklist the way they do for One/Two):
insert into public.system_unlocks (company_id, system_name, template_type, stage, status)
select c.id, sys.name, sys.type, 'three',
  case when c.current_stage = 'three' then 'available' else 'locked' end
from public.companies c
cross join (values
  ('Department Build-Out Plan', 'department_buildout'),
  ('Delegation & Hiring Playbook', 'delegation_playbook')
) as sys(name, type)
on conflict (company_id, template_type, stage) do nothing;

-- Stage Three also gets deepened re-passes of the Stage One systems, per
-- the founder's explicit "steps from stage one will also be there in
-- further detail" direction. Locked/available same as above.
insert into public.system_unlocks (company_id, system_name, template_type, stage, status, depth_note)
select c.id, sys.name, sys.type, 'three',
  case when c.current_stage = 'three' then 'available' else 'locked' end,
  sys.depth_note
from public.companies c
cross join (values
  ('Vision Mapping', 'vision_mapping', 'Revisit with your team''s vision, not just your own.'),
  ('Sales Script Milestones', 'sales_script_milestones', 'Adapt for a team that isn''t you selling.'),
  ('Pricing Breakdown', 'pricing_breakdown', 'Full margin and multi-tier pricing analysis.'),
  ('Cash Flow Reports', 'cashflow_reports', 'Team payroll and delegation costs factored in.')
) as sys(name, type, depth_note)
on conflict (company_id, template_type, stage) do nothing;
```

(Note: Stage Two's existing 2 systems already turn out to be exactly the
net-new systems Stage Two's notes call for once Stage One's overlap is
accounted for — no Stage Two seed changes needed here.)

### 3d. Global "active company" (drives the whole-app theme)

```sql
alter table public.profiles add column active_company_id uuid references public.companies(id) on delete set null;
```

Nullable, defaults to null (falls back to the first company in the list,
same as today's per-page local pickers). One column, no new table — this is
a per-person UI preference, not shared business data.

---

## 4. "Push the Needle" Ideas — Extend `safety_net_nudges`, Not a New System

```sql
alter table public.safety_net_nudges drop constraint safety_net_nudges_type_check;
alter table public.safety_net_nudges add constraint safety_net_nudges_type_check
  check (type in ('cash_buffer', 'quiet_lead', 'seasonal_dip', 'stage_progress'));
```

Generation logic (in the same `generateSafetyNetNudges()` function in
`api/cron/process-email-sequences.ts`, following the exact pattern already
used for `cash_buffer`/`quiet_lead`):

- For each company, find its incomplete `system_unlocks` rows at
  `current_stage` with `status = 'available'`.
- Pick one (simplest heuristic for v1: the one unlocked longest without
  being started, i.e. lowest `unlocked_at`) and generate a nudge:
  `"{system_name} is available whenever you're ready — it's one step
  closer to {next stage label}."` — orientation language, no urgency words,
  per the Dashboard Guardrail.
- Same dedup rule as existing nudges: don't regenerate a `stage_progress`
  nudge for a company until the previous one is dismissed or acted on.
- "Take a look" (existing `NudgeCard` action pattern) navigates to the
  Systems page. "Not now" dismisses, no persisted judgment — identical to
  `cash_buffer`/`quiet_lead` today.

No new UI component needed — `NudgeCard` already renders whatever's in
`safety_net_nudges`; it just needs a `stage_progress` case added to
whatever switches on `type` today (message copy + navigation target).

---

## 5. Whole-App Stage Theming

### The good news: this doesn't require touching the 241 existing `teal-*` class sites

`grep` confirms `teal-` Tailwind classes appear 241 times across 19 files
(157 in `DashboardApp.tsx` alone). Rewriting each call site to be
stage-aware would be a huge, risky refactor. It isn't necessary: Tailwind's
CDN config (`index.html`) already remaps the `teal` token to custom hex
values. Instead of hardcoded hex, define the palette in terms of CSS custom
properties — every existing `bg-teal-600`, `text-teal-700`,
`border-teal-300`, etc. keeps working completely unchanged, but now
resolves to whichever stage's colors are active.

**`index.html` — replace the hardcoded `teal` color block:**

```js
tailwind.config = {
  theme: {
    extend: {
      fontFamily: { sans: ['"Plus Jakarta Sans"', "ui-sans-serif", "system-ui"] },
      colors: {
        teal: {
          50:  "rgb(var(--teal-50) / <alpha-value>)",
          100: "rgb(var(--teal-100) / <alpha-value>)",
          200: "rgb(var(--teal-200) / <alpha-value>)",
          300: "rgb(var(--teal-300) / <alpha-value>)",
          400: "rgb(var(--teal-400) / <alpha-value>)",
          500: "rgb(var(--teal-500) / <alpha-value>)",
          600: "rgb(var(--teal-600) / <alpha-value>)",
          700: "rgb(var(--teal-700) / <alpha-value>)",
          800: "rgb(var(--teal-800) / <alpha-value>)",
          900: "rgb(var(--teal-900) / <alpha-value>)",
        },
        sage: {
          50:  "rgb(var(--sage-50) / <alpha-value>)",
          100: "rgb(var(--sage-100) / <alpha-value>)",
          200: "rgb(var(--sage-200) / <alpha-value>)",
        },
      },
      borderRadius: { "4xl": "1.75rem" },
    },
  },
};
```

**New `src/stageTheme.css` (or inline in `styles.css`) — one block per stage,
selected via a `data-stage` attribute on `<html>`:**

```css
:root, [data-stage="two"] {
  /* Stage Two — current forest-green, confirmed baseline, unchanged */
  --teal-50: 237 246 236;   --teal-100: 220 238 218;  --teal-200: 185 221 180;
  --teal-300: 143 199 135;  --teal-400: 95 174 94;    --teal-500: 59 147 80;
  --teal-600: 31 122 82;    --teal-700: 23 95 64;     --teal-800: 18 61 44;
  --teal-900: 11 42 28;
  --sage-50: 243 248 241;   --sage-100: 231 242 229;  --sage-200: 211 233 206;
}

[data-stage="one"] {
  /* Stage One — calm muted plum/purple, proposed, adjust freely */
  --teal-50: 243 240 247;   --teal-100: 230 223 239;  --teal-200: 207 192 223;
  --teal-300: 178 157 203;  --teal-400: 148 120 179;  --teal-500: 122 93 154;
  --teal-600: 99 74 126;    --teal-700: 77 57 99;     --teal-800: 54 40 73;
  --teal-900: 33 24 48;
  --sage-50: 243 240 247;   --sage-100: 230 223 239;  --sage-200: 207 192 223;
}

[data-stage="three"] {
  /* Stage Three — calm muted steel blue, proposed, adjust freely */
  --teal-50: 238 243 246;   --teal-100: 220 231 237;  --teal-200: 185 207 219;
  --teal-300: 143 178 196;  --teal-400: 98 148 172;   --teal-500: 69 123 147;
  --teal-600: 53 99 122;    --teal-700: 41 76 95;     --teal-800: 28 52 68;
  --teal-900: 16 31 41;
  --sage-50: 238 243 246;   --sage-100: 220 231 237;  --sage-200: 185 207 219;
}
```

**React side:** a top-level effect (in `DashboardApp.tsx`, near where
`profile`/`companies` are already loaded) sets
`document.documentElement.dataset.stage = activeCompany?.current_stage ?? "two"`
whenever the active company changes. That's the entire "whole app chrome"
requirement — no per-component changes anywhere else.

Both proposed palettes (purple, blue) are calm and muted, matching the
lightness/chroma pattern of the existing green scale — not saturated or
game-neon, consistent with the "calm by design" values. Treat the exact
hex/RGB values as a first draft to eyeball and adjust, not final.

---

## 6. Global Company Switcher

New persistent control in the app's top-level chrome (sidebar header or top
bar — wherever makes sense next to the existing nav), replacing the
per-page local company `<select>` pickers that currently live inside
`SystemsPage`, `LeadsPage`, etc. (those can either be removed in favor of
the global one, or kept as a page-level override — recommend removing them
for consistency once the global switcher exists, but that's a call for
whoever implements this to make based on how disruptive it'd be).

- Reads/writes `profiles.active_company_id`.
- Defaults to the first company in the list if null (matches today's
  fallback behavior).
- Selecting a company updates `active_company_id` (persisted — remembered
  next session) and immediately updates `data-stage` (Section 5), so the
  whole app re-themes.

---

## 7. Confetti — Two Tiers

- **Stage transition (existing, unchanged):** `SystemsPage`'s
  `Confetti fire={celebrate}` on `accept_stage_transition` — big moment,
  stays as-is.
- **New: individual system completion.** In `SystemUnlockRow.handleMarkComplete()`,
  fire a smaller/shorter celebration (fewer particles, ~1s instead of the
  2.5s stage-transition duration — reuse the existing `Confetti` component
  with a `variant="small"` prop or a particle-count override, whichever is
  less invasive to the existing component's API) alongside the existing
  "✓ Complete" state change. Quiet enough not to feel like a full stage
  moment, but still a real celebration for a real step.

---

## 8. `CLAUDE.md` Corrections (do alongside this build)

- Fix the Visual Design System section: it currently claims the app was
  reverted to `#1B7E70`/`#15685D` teal. That revert never actually landed
  in `index.html`. Per the founder's confirmed direction (2026-07-23): the
  **current forest-green (`#1F7A52`/`#175F40`) is the real, kept baseline**
  — update the doc to say so plainly instead of claiming a revert that
  didn't happen.
- Add this file to the Reference Docs list.

---

## 9. Acceptance Criteria

1. Stage One shows 11 systems (4 existing + 7 new); Stage Three shows a
   real, non-empty list (2 new systems + 4 deepened Stage One re-passes);
   Stage Two unchanged.
2. The same `template_type` can be unlocked at more than one stage for the
   same company without a constraint violation.
3. Switching the global company switcher changes `active_company_id`,
   persists across reload, and re-themes the entire app (sidebar, buttons,
   active states) to that company's stage color — without any changes to
   the 241 existing `teal-*` class call sites.
4. Stage Two's color is the current forest-green, unchanged in value.
5. Marking an individual system complete shows a small celebration; a full
   stage transition still shows the existing larger one.
6. A `stage_progress` nudge appears on the founder's Today view (subject to
   the existing one-nudge-at-a-time rule) when a company has an available,
   not-yet-started system at its current stage — dismissable without
   penalty, no urgency language.
7. `CLAUDE.md`'s color-scheme claim matches what's actually in `index.html`.

---

## 10. Out of Scope (this pass)

- Giving each system real guided content (Vision Mapping worksheet,
  Pricing Breakdown calculator, etc.) instead of a blank template + checkbox
  — confirmed follow-up, not this pass.
- A fourth stage — the schema stays capped at three; widening the
  `current_stage` check constraint is a small future change once there's an
  actual answer for what a Stage Four business looks like.
- A full Stage Three systems list beyond the two seeded here — founder will
  expand this over time.
- Re-theming `sage` colors beyond wiring them to the same CSS-variable
  mechanism (values above are placeholders matching `teal` for now — a fast
  follow, not blocking).
