-- Phase 22 (Post-Expansion): Safety Net v1. Two nudge types generated for
-- v1 (cash_buffer, quiet_lead); seasonal_dip is a valid enum value but
-- deliberately not generated yet -- needs a full season of revenue history
-- to mean anything, per the hand-off spec's own instruction to defer it.

-- leads never had an updated_at trigger (unlike companies/notes/profiles/
-- sops/tasks, which all use the existing handle_updated_at() function) --
-- so leads.updated_at has been silently frozen at insert time ever since
-- Phase 1, making a "quiet lead" (no recent activity) check meaningless.
-- Real gap, fixed here since Safety Net's quiet-lead nudge depends on it.
create trigger set_updated_at before update on public.leads
  for each row execute function public.handle_updated_at();

create table public.safety_net_nudges (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  type text not null check (type in ('cash_buffer', 'quiet_lead', 'seasonal_dip')),
  message text not null,
  created_at timestamptz not null default now(),
  dismissed_at timestamptz,
  acted_at timestamptz
);
create index safety_net_nudges_company_id_idx on public.safety_net_nudges(company_id);
alter table public.safety_net_nudges enable row level security;
create policy "team_full_access" on public.safety_net_nudges for all using (is_company_member(company_id)) with check (is_company_member(company_id));
