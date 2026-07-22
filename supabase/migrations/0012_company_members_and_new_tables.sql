-- Phase 1 (Client Portal Expansion): multi-tenant foundation, part 1
-- company_members: profile <-> company membership (many-to-many), since Sierra's
-- own team works across her 3 existing companies from one login. This is the
-- tenant-membership layer on top of `companies` as the real tenant table --
-- NOT a parallel "organizations" table.

create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'team' check (role in ('founder', 'team', 'contractor')),
  created_at timestamptz not null default now(),
  unique (company_id, profile_id)
);

create index company_members_profile_id_idx on public.company_members(profile_id);
create index company_members_company_id_idx on public.company_members(company_id);

alter table public.company_members enable row level security;

-- Backfill: every existing profile is a member of every existing company,
-- preserving today's cross-company access exactly as-is.
insert into public.company_members (company_id, profile_id, role)
select c.id, p.id, p.role
from public.companies c
cross join public.profiles p;

-- Backfill the handful of legacy rows with null company_id so the upcoming
-- company-scoped RLS policies don't silently hide them.
update public.tasks set company_id = 'af3a68ab-1a45-419c-83be-19d1d8678510' where company_id is null; -- Etsy keyword tasks -> Prose Florals
update public.meetings set company_id = 'bf72821a-f6ec-4bee-8563-fc8a96c41f79' where company_id is null; -- Backstage
update public.company_goals set company_id = 'bf72821a-f6ec-4bee-8563-fc8a96c41f79' where company_id is null; -- Backstage

-- Genuinely new tables (reconciliation note gaps): leads, deliverables,
-- client-facing comments, automations, testimonials.

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  service_type text,
  message text,
  source text,
  status text not null default 'new' check (status in ('new', 'contacted', 'proposal_sent', 'won', 'lost')),
  converted_client_id uuid references public.clients(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_company_id_idx on public.leads(company_id);
alter table public.leads enable row level security;

create table public.deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'pending' check (status in ('pending', 'delivered', 'approved', 'revision_requested')),
  client_visible boolean not null default true,
  gdrive_file_id text,
  delivered_at timestamptz,
  approved_at timestamptz,
  revision_note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index deliverables_project_id_idx on public.deliverables(project_id);
alter table public.deliverables enable row level security;

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  deliverable_id uuid references public.deliverables(id) on delete cascade,
  author_type text not null check (author_type in ('team', 'client')),
  author_profile_id uuid references public.profiles(id) on delete set null,
  author_client_user_id uuid references public.client_users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint comments_one_parent check (
    (task_id is not null and deliverable_id is null) or
    (task_id is null and deliverable_id is not null)
  )
);
create index comments_client_id_idx on public.comments(client_id);
create index comments_task_id_idx on public.comments(task_id);
create index comments_deliverable_id_idx on public.comments(deliverable_id);
alter table public.comments enable row level security;

create table public.automations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  trigger_type text not null check (trigger_type in ('proposal_accepted', 'deliverable_approved', 'project_completed')),
  action_type text not null check (action_type in ('create_project_and_tasks', 'notify_team', 'request_testimonial')),
  config jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index automations_company_id_idx on public.automations(company_id);
alter table public.automations enable row level security;

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  quote text not null,
  author_name text not null,
  author_photo_url text,
  is_approved boolean not null default false,
  is_featured boolean not null default false,
  created_at timestamptz not null default now()
);
create index testimonials_company_id_idx on public.testimonials(company_id);
alter table public.testimonials enable row level security;

-- client_visible task flag (schema + RLS gate land now since this migration
-- already rewrites tasks' client-read policy; internal toggle UI is a later phase).
alter table public.tasks add column client_visible boolean not null default false;
