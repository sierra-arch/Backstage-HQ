-- Automation Web: turns the Phase-1 `automations` table (built in 0012,
-- deliberately left unused per roadmap.md's Phase 10 note -- Phase 10/12
-- hardcoded automations directly in code instead of building an
-- interpreter) into the real source of truth for chainable,
-- founder-editable automations. automation_edges expresses chains between
-- rows (a simple linear default web, per the locked "no auto-generated
-- branching" rule). Also adds department-scoped clearance as an additive
-- column on company_members -- NOT a replacement for the existing
-- founder/team/contractor role, which stays completely untouched.

alter table public.automations
  add column title text,
  add column subtitle text,
  add column icon text,
  add column status text not null default 'active'
    check (status in ('active', 'waiting', 'paused')), -- neutral states only, no red/yellow/green
  add column position_x double precision not null default 0,
  add column position_y double precision not null default 0,
  add column clearance_departments text[] not null default '{}';

create table public.automation_edges (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  source_automation_id uuid not null references public.automations(id) on delete cascade,
  target_automation_id uuid not null references public.automations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (source_automation_id, target_automation_id)
);
create index automation_edges_company_id_idx on public.automation_edges(company_id);
create index automation_edges_source_idx on public.automation_edges(source_automation_id);
alter table public.automation_edges enable row level security;
create policy "team_full_access" on public.automation_edges for all
  using (is_company_member(company_id)) with check (is_company_member(company_id));

-- Departments are a flat string tag on the existing membership row, not a
-- new identity/role system -- multi-department membership is just multiple
-- array elements. No separate company_departments table for V1: the
-- department list is a fixed frontend constant (see
-- src/features/automation-web/types.ts), matching the "sensible V1
-- defaults, not a hard-coded enum you need a migration to extend" posture
-- used elsewhere in this schema (e.g. clearance_departments below is text[],
-- not a foreign key, for the same reason).
alter table public.company_members
  add column departments text[] not null default '{}';

-- Viewing automations is unchanged (team_full_access via is_company_member,
-- already granted in 0013). Editing is higher-stakes than visibility, so it
-- gets a real RLS policy: a founder can always edit (is_company_founder()
-- never gated by departments, per the locked "founder access can never be
-- reduced" rule), a team/contractor member can edit only if their
-- departments overlap the node's clearance_departments. An empty
-- clearance_departments array (the default -- e.g. every seeded row below)
-- means no non-founder department-overlap is possible, so today only
-- founders can edit until a founder tags a node with a department.
create policy "department_scoped_edit" on public.automations for update
  using (
    is_company_founder(company_id)
    or exists (
      select 1 from public.company_members cm
      where cm.company_id = automations.company_id
        and cm.profile_id = auth.uid()
        and cm.departments && automations.clearance_departments
    )
  );

-- Seed a default linear web for every existing company, so nothing starts
-- blank (acceptance criterion: no empty state). These three rows describe
-- exactly the three automations Phase 10/12 already hardcoded -- this
-- migration is what finally makes them real, editable data instead of
-- code-only behavior.
insert into public.automations (company_id, trigger_type, action_type, title, subtitle, icon, status)
select id, 'proposal_accepted', 'create_project_and_tasks', 'New client accepted', 'Creates project + kickoff tasks', 'sparkles', 'active' from public.companies
union all
select id, 'deliverable_approved', 'notify_team', 'Deliverable approved', 'Notifies the founder', 'check', 'active' from public.companies
union all
select id, 'project_completed', 'notify_team', 'Project completed', 'Advances client stage + notifies founder', 'flag', 'active' from public.companies;

-- Chain proposal_accepted's create_project_and_tasks -> the
-- deliverable_approved notify step, per company, as the default "web"
-- shape (a simple linear chain -- no branching is ever auto-generated).
insert into public.automation_edges (company_id, source_automation_id, target_automation_id)
select a1.company_id, a1.id, a2.id
from public.automations a1
join public.automations a2
  on a2.company_id = a1.company_id and a2.trigger_type = 'deliverable_approved'
where a1.trigger_type = 'proposal_accepted';

-- Give future self-serve orgs (signup_new_org, 0021) the same non-blank
-- default web a founder gets today -- a brand-new org has no prior
-- deliverable/project history to chain against yet, so this seeds the same
-- three rows without the cross-trigger edge.
create or replace function public.signup_new_org(p_org_name text, p_org_slug text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.profiles (id, display_name, role)
  values (auth.uid(), p_display_name, 'founder')
  on conflict (id) do nothing;

  insert into public.companies (name, slug, plan)
  values (p_org_name, p_org_slug, 'starter')
  returning id into v_company_id;

  insert into public.company_members (company_id, profile_id, role)
  values (v_company_id, auth.uid(), 'founder');

  insert into public.automations (company_id, trigger_type, action_type, title, subtitle, icon, status)
  values
    (v_company_id, 'proposal_accepted', 'create_project_and_tasks', 'New client accepted', 'Creates project + kickoff tasks', 'sparkles', 'active'),
    (v_company_id, 'deliverable_approved', 'notify_team', 'Deliverable approved', 'Notifies the founder', 'check', 'active'),
    (v_company_id, 'project_completed', 'notify_team', 'Project completed', 'Advances client stage + notifies founder', 'flag', 'active');

  return v_company_id;
end;
$$;

revoke all on function public.signup_new_org(text, text, text) from public;
grant execute on function public.signup_new_org(text, text, text) to authenticated;
