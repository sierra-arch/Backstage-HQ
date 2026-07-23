-- Phase 21 (Post-Expansion): stage-gating mechanism.
alter table public.document_templates add column completed_at timestamptz;

create table public.system_unlocks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  system_name text not null,
  template_type text not null,
  stage text not null check (stage in ('one', 'two', 'three')),
  status text not null default 'locked' check (status in ('locked', 'available', 'in_progress', 'complete')),
  unlocked_at timestamptz,
  unique (company_id, template_type)
);
create index system_unlocks_company_id_idx on public.system_unlocks(company_id);
alter table public.system_unlocks enable row level security;
create policy "team_full_access" on public.system_unlocks for all using (is_company_member(company_id)) with check (is_company_member(company_id));

create table public.stage_transitions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  from_stage text not null,
  to_stage text not null,
  offered_at timestamptz not null default now(),
  accepted_at timestamptz
);
create index stage_transitions_company_id_idx on public.stage_transitions(company_id);
alter table public.stage_transitions enable row level security;
create policy "team_full_access" on public.stage_transitions for all using (is_company_member(company_id)) with check (is_company_member(company_id));

-- Seed system_unlocks per company reflecting where each of the founder's
-- 3 real businesses actually stands (not a uniform reset -- see
-- migration 0022's seeding of companies.current_stage).
insert into public.system_unlocks (company_id, system_name, template_type, stage, status, unlocked_at)
select c.id, sys.name, sys.type, 'one', case when c.current_stage in ('two', 'three') then 'complete' else 'available' end,
  case when c.current_stage in ('two', 'three') then now() else null end
from public.companies c
cross join (values
  ('Vision Mapping', 'vision_mapping'),
  ('Sales Script Milestones', 'sales_script_milestones'),
  ('Branding Kit Essentials', 'branding_essentials'),
  ('Policies Checklist', 'policies_checklist')
) as sys(name, type);

-- Stage Two placeholder systems (per the founder's explicit request) --
-- 'available' for companies already at stage two+, 'locked' otherwise.
insert into public.system_unlocks (company_id, system_name, template_type, stage, status)
select c.id, sys.name, sys.type, 'two', case when c.current_stage in ('two', 'three') then 'available' else 'locked' end
from public.companies c
cross join (values
  ('New Hire Packet', 'new_hire_packet'),
  ('Freebie Funnel', 'freebie')
) as sys(name, type);

-- Atomic stage-completion check + offer. Not a new serverless function --
-- RPC only, per this codebase's established pattern.
create or replace function public.check_stage_completion(p_company_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_stage text;
  v_next_stage text;
  v_incomplete_count int;
  v_pending_offer_count int;
begin
  if not is_company_member(p_company_id) then
    raise exception 'Not authorized for this company';
  end if;

  select current_stage into v_current_stage from public.companies where id = p_company_id;
  if v_current_stage = 'three' then
    return false;
  end if;
  v_next_stage := case v_current_stage when 'one' then 'two' when 'two' then 'three' end;

  select count(*) into v_incomplete_count
  from public.system_unlocks
  where company_id = p_company_id and stage = v_current_stage and status != 'complete';

  if v_incomplete_count > 0 then
    return false;
  end if;

  select count(*) into v_pending_offer_count
  from public.stage_transitions
  where company_id = p_company_id and to_stage = v_next_stage and accepted_at is null;

  if v_pending_offer_count > 0 then
    return false;
  end if;

  insert into public.stage_transitions (company_id, from_stage, to_stage)
  values (p_company_id, v_current_stage, v_next_stage);

  return true;
end;
$$;

revoke all on function public.check_stage_completion(uuid) from public;
grant execute on function public.check_stage_completion(uuid) to authenticated;

-- Accepting a stage transition: advance the company, unlock the new
-- stage's systems (locked -> available), mark the offer accepted.
create or replace function public.accept_stage_transition(p_transition_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_to_stage text;
begin
  select company_id, to_stage into v_company_id, v_to_stage
  from public.stage_transitions where id = p_transition_id and accepted_at is null;

  if v_company_id is null then
    raise exception 'Transition not found or already accepted';
  end if;

  if not is_company_member(v_company_id) then
    raise exception 'Not authorized for this company';
  end if;

  update public.stage_transitions set accepted_at = now() where id = p_transition_id;
  update public.companies set current_stage = v_to_stage where id = v_company_id;
  update public.system_unlocks set status = 'available'
    where company_id = v_company_id and stage = v_to_stage and status = 'locked';
end;
$$;

revoke all on function public.accept_stage_transition(uuid) from public;
grant execute on function public.accept_stage_transition(uuid) to authenticated;
