-- Milestone 5: Proposal Generator engine.
--
-- Grounded in Prose Florals' real, currently-in-use Honeybook proposal:
-- personalized intro -> Design Brief (style, palette, materials,
-- inspiration, philosophy, testimonials) -> categorized, quantity-
-- adjustable, partly-optional line items with running subtotals ->
-- auto-generated invoice -> multi-installment payment schedule (each
-- installment on its own timing rule, not just one deposit) -> contract
-- with merge fields -> confirmation. Modeled generically (categories/line
-- items/brief fields) so it works for any future company/industry, with
-- Prose Florals' real proposal seeded as the first template instance
-- (seed data ships separately from this schema migration).
--
-- See claude/roadmap.md's "Milestone 5 — Detailed Plan" section for full
-- context on every decision below.

-- ============================================================
-- document_templates: generic, per-company template definitions
-- ============================================================
create table document_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  type text not null
    check (type in (
      'proposal', 'design_brief', 'contract', 'freebie', 'new_hire_packet',
      'product_sheet', 'pricing_breakdown', 'policies_sheet', 'links_page'
    )),
  name text not null,
  -- Ordered list of sections. The section type that matters most for this
  -- milestone is the line-item section: a list of categories, each with
  -- line items shaped { name, description, unit_price, default_quantity,
  -- is_optional, is_included }. Other section types (text blocks, image
  -- galleries, merge-field contract text) also live here as the template
  -- authoring format matures.
  structure jsonb not null default '[]'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table document_templates enable row level security;

create policy "team_full_access" on document_templates
  for all using (is_team_member()) with check (is_team_member());

-- ============================================================
-- generated_documents: a rendered instance of a template for one client
-- ============================================================
create table generated_documents (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references document_templates(id) on delete restrict,
  client_id uuid references clients(id) on delete restrict,
  -- Kept as two distinct top-level keys, never merged in storage:
  --   authored   = what the team set up (categories, prices, what's optional)
  --   selections = what the client picked (quantities, which optionals are on)
  -- A client never gets direct UPDATE access to this row (see RLS below) —
  -- their selections are only ever written server-side via
  -- api/submit-proposal-selections.ts, which validates against `authored`
  -- and never trusts client-sent prices.
  field_values jsonb not null default '{"authored": {}, "selections": {}}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'finalized', 'sent', 'viewed')),
  gdrive_file_id text,
  gdrive_folder_id text,
  last_synced_at timestamptz,
  edit_locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table generated_documents enable row level security;

create policy "team_full_access" on generated_documents
  for all using (is_team_member()) with check (is_team_member());

-- Client can only ever SELECT their own generated documents, never
-- INSERT/UPDATE/DELETE — matches the "no direct client write access"
-- decision above.
create policy "client_reads_own" on generated_documents
  for select using (client_owns(client_id));

-- ============================================================
-- payment_schedules + payment_installments: configurable N-payment plans
-- ============================================================
create table payment_schedules (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid references proposals(id) on delete restrict,
  client_id uuid not null references clients(id) on delete restrict,
  total_amount numeric(10, 2) not null,
  created_at timestamptz not null default now()
);

alter table payment_schedules enable row level security;

create policy "team_full_access" on payment_schedules
  for all using (is_team_member()) with check (is_team_member());

create policy "client_reads_own" on payment_schedules
  for select using (client_owns(client_id));

create table payment_installments (
  id uuid primary key default gen_random_uuid(),
  payment_schedule_id uuid not null references payment_schedules(id) on delete cascade,
  sequence_number int not null,
  amount numeric(10, 2) not null,
  due_rule_type text not null
    check (due_rule_type in ('on_signing', 'days_after_signing', 'days_before_event')),
  due_rule_offset_days int,
  due_date date,
  -- Populated only when it's actually time to bill this installment
  -- (milestone 7 / Stripe) — not all installments pre-created as invoices
  -- on day one.
  invoice_id uuid references invoices(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'invoiced', 'paid', 'overdue')),
  created_at timestamptz not null default now()
);

alter table payment_installments enable row level security;

create policy "team_full_access" on payment_installments
  for all using (is_team_member()) with check (is_team_member());

-- A client needs to see their own payment schedule/installments in
-- /portal, scoped through the parent payment_schedules row (client_id
-- doesn't live directly on payment_installments).
create policy "client_reads_own" on payment_installments
  for select using (
    exists (
      select 1 from payment_schedules
      where payment_schedules.id = payment_installments.payment_schedule_id
        and client_owns(payment_schedules.client_id)
    )
  );

-- ============================================================
-- Modify existing tables
-- ============================================================

-- proposals: the actual rendered content now lives in generated_documents
-- (type 'proposal'); `content` is superseded and unused (Proposal
-- Generator was never built until now, nothing to migrate).
alter table proposals
  add column generated_document_id uuid references generated_documents(id) on delete set null;

alter table proposals
  add column event_date date;
  -- New field, resolves a sequencing gap: the edit-cutoff and payment
  -- rules (e.g. "30 days before event") need an event date, but a
  -- `projects` row doesn't exist yet at proposal time (only auto-created
  -- after the agreement is signed, milestone 6). proposals.event_date is
  -- the source of truth during the proposal/agreement phase; when
  -- projects gets auto-created on signing, target_delivery_date is
  -- populated FROM proposals.event_date. Keeps "the date lives on
  -- projects" true long-term while resolving the chicken-and-egg order.

alter table proposals
  drop column content;

-- agreements: holds the merge-filled contract text (type 'contract')
-- before/alongside DocuSign envelope creation in milestone 6.
alter table agreements
  add column generated_document_id uuid references generated_documents(id) on delete set null;
