-- Foundation milestone (2/5): new tables for the client lifecycle
-- (intake -> proposal -> agreement -> project -> invoice), plus a new
-- project_id column on the existing `tasks` table. Additive only —
-- existing tasks are left ungrouped (project_id null), nothing is
-- force-migrated.

create table intake_responses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  raw_answers jsonb not null default '{}'::jsonb,
  recommended_track text
    check (recommended_track in ('freelancer', 'founder_mini', 'founder_full', 'ceo')),
  created_at timestamptz not null default now()
);

create table proposals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'viewed', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- client_id/proposal_id use ON DELETE RESTRICT deliberately: a raw
-- `delete from clients` should never be able to silently cascade away a
-- signed agreement. The intended way to retire a client is
-- `clients.stage = 'archived'`, not row deletion.
create table agreements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete restrict,
  proposal_id uuid references proposals(id) on delete restrict,
  docusign_envelope_id text,
  status text not null default 'sent'
    check (status in ('sent', 'signed', 'voided')),
  signed_at timestamptz,
  created_at timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete restrict,
  company_id uuid references companies(id) on delete restrict,
  name text not null,
  status text not null default 'active'
    check (status in ('active', 'on_hold', 'completed', 'archived')),
  start_date date,
  target_delivery_date date,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- New layer above tasks. ON DELETE SET NULL so a project deletion can never
-- delete real task history, and existing tasks stay ungrouped by default.
alter table tasks
  add column project_id uuid references projects(id) on delete set null;

create table invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete restrict,
  project_id uuid references projects(id) on delete set null,
  stripe_invoice_id text,
  stripe_payment_intent_id text,
  amount numeric(10, 2) not null,
  status text not null default 'unpaid'
    check (status in ('unpaid', 'paid', 'overdue')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
