-- Phase 12 (Client Portal Expansion): email marketing via Resend. Broadcasts
-- (one-off, segmented) send immediately. Sequences are multi-step drips with
-- manual enrollment, processed daily by a Vercel cron endpoint -- not a
-- generic automation builder, matching this build's "hardcode what matters"
-- approach applied to marketing.

create table public.email_broadcasts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  subject text not null,
  body text not null,
  recipient_filter text not null check (recipient_filter in ('all_clients', 'active_clients', 'leads')),
  status text not null default 'draft' check (status in ('draft', 'sent')),
  sent_count integer not null default 0,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index email_broadcasts_company_id_idx on public.email_broadcasts(company_id);
alter table public.email_broadcasts enable row level security;
create policy "team_full_access" on public.email_broadcasts for all using (is_company_member(company_id)) with check (is_company_member(company_id));

create table public.email_sequences (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index email_sequences_company_id_idx on public.email_sequences(company_id);
alter table public.email_sequences enable row level security;
create policy "team_full_access" on public.email_sequences for all using (is_company_member(company_id)) with check (is_company_member(company_id));

create table public.email_sequence_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.email_sequences(id) on delete cascade,
  step_order integer not null,
  delay_days integer not null default 0,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now(),
  unique (sequence_id, step_order)
);
alter table public.email_sequence_steps enable row level security;
create policy "team_full_access" on public.email_sequence_steps for all using (
  exists (select 1 from public.email_sequences s where s.id = email_sequence_steps.sequence_id and is_company_member(s.company_id))
) with check (
  exists (select 1 from public.email_sequences s where s.id = email_sequence_steps.sequence_id and is_company_member(s.company_id))
);

create table public.email_sequence_enrollments (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.email_sequences(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  email text not null,
  enrolled_at timestamptz not null default now(),
  next_step_order integer not null default 1,
  next_send_at date not null default current_date,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  constraint email_sequence_enrollments_one_target check (
    (lead_id is not null and client_id is null) or (lead_id is null and client_id is not null)
  )
);
create index email_sequence_enrollments_due_idx on public.email_sequence_enrollments(status, next_send_at);
alter table public.email_sequence_enrollments enable row level security;
create policy "team_full_access" on public.email_sequence_enrollments for all using (
  exists (select 1 from public.email_sequences s where s.id = email_sequence_enrollments.sequence_id and is_company_member(s.company_id))
) with check (
  exists (select 1 from public.email_sequences s where s.id = email_sequence_enrollments.sequence_id and is_company_member(s.company_id))
);
