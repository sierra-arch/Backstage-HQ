-- Phase 1 (Client Portal Expansion): multi-tenant foundation, part 2
-- Company-scoped RLS. Tables holding client/business data get scoped by
-- company_members membership instead of the old blanket is_team_member()
-- (which had zero tenant scoping). Person-level/internal-social tables
-- (profiles, messages, points_log, activity_log, goal_updates,
-- accomplishments, sop_categories) are deliberately left on is_team_member()
-- for this phase -- they carry no client/business data, so they're out of
-- scope for tenant isolation; revisit if/when real second-tenant usage
-- exercises them.

create or replace function public.is_company_member(check_company_id uuid)
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from public.company_members
    where profile_id = auth.uid() and company_id = check_company_id
  );
$$;

create or replace function public.is_company_member_via_client(check_client_id uuid)
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from public.clients c
    join public.company_members cm on cm.company_id = c.company_id
    where c.id = check_client_id and cm.profile_id = auth.uid()
  );
$$;

create or replace function public.is_company_member_via_project(check_project_id uuid)
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from public.projects p
    join public.company_members cm on cm.company_id = p.company_id
    where p.id = check_project_id and cm.profile_id = auth.uid()
  );
$$;

create or replace function public.is_company_member_via_generated_document(check_client_id uuid, check_template_id uuid)
returns boolean
language sql stable security definer
as $$
  select case
    when check_client_id is not null then public.is_company_member_via_client(check_client_id)
    else exists (
      select 1 from public.document_templates dt
      join public.company_members cm on cm.company_id = dt.company_id
      where dt.id = check_template_id and cm.profile_id = auth.uid()
    )
  end;
$$;

-- Direct company_id tables
alter policy "team_full_access" on public.companies using (is_company_member(id)) with check (is_company_member(id));
alter policy "team_full_access" on public.tasks using (is_company_member(company_id)) with check (is_company_member(company_id));
alter policy "team_full_access" on public.notes using (is_company_member(company_id)) with check (is_company_member(company_id));
alter policy "team_full_access" on public.meetings using (is_company_member(company_id)) with check (is_company_member(company_id));
alter policy "team_full_access" on public.products using (is_company_member(company_id)) with check (is_company_member(company_id));
alter policy "team_full_access" on public.goals using (is_company_member(company_id)) with check (is_company_member(company_id));
alter policy "team_full_access" on public.sops using (is_company_member(company_id)) with check (is_company_member(company_id));
alter policy "team_full_access" on public.company_goals using (is_company_member(company_id)) with check (is_company_member(company_id));
alter policy "team_full_access" on public.projects using (is_company_member(company_id)) with check (is_company_member(company_id));
alter policy "team_full_access" on public.document_templates using (is_company_member(company_id)) with check (is_company_member(company_id));
alter policy "team_full_access" on public.brand_kits using (is_company_member(company_id)) with check (is_company_member(company_id));
alter policy "team_full_access" on public.clients using (is_company_member(company_id)) with check (is_company_member(company_id));

-- Tables reached via client_id -> clients.company_id
alter policy "team_full_access" on public.proposals using (is_company_member_via_client(client_id)) with check (is_company_member_via_client(client_id));
alter policy "team_full_access" on public.agreements using (is_company_member_via_client(client_id)) with check (is_company_member_via_client(client_id));
alter policy "team_full_access" on public.invoices using (is_company_member_via_client(client_id)) with check (is_company_member_via_client(client_id));
alter policy "team_full_access" on public.payment_schedules using (is_company_member_via_client(client_id)) with check (is_company_member_via_client(client_id));
alter policy "team_full_access" on public.intake_responses using (is_company_member_via_client(client_id)) with check (is_company_member_via_client(client_id));
alter policy "team_manage_client_users" on public.client_users using (is_company_member_via_client(client_id)) with check (is_company_member_via_client(client_id));
alter policy "team_full_access" on public.generated_documents using (is_company_member_via_generated_document(client_id, template_id)) with check (is_company_member_via_generated_document(client_id, template_id));

-- payment_installments: reached via payment_schedule_id -> payment_schedules.client_id
alter policy "team_full_access" on public.payment_installments using (
  exists (select 1 from public.payment_schedules ps where ps.id = payment_installments.payment_schedule_id and is_company_member_via_client(ps.client_id))
) with check (
  exists (select 1 from public.payment_schedules ps where ps.id = payment_installments.payment_schedule_id and is_company_member_via_client(ps.client_id))
);

-- New tables: team access
create policy "team_full_access" on public.leads for all using (is_company_member(company_id)) with check (is_company_member(company_id));
create policy "team_full_access" on public.deliverables for all using (is_company_member_via_project(project_id)) with check (is_company_member_via_project(project_id));
create policy "team_full_access" on public.comments for all using (is_company_member_via_client(client_id)) with check (is_company_member_via_client(client_id));
create policy "team_full_access" on public.automations for all using (is_company_member(company_id)) with check (is_company_member(company_id));
create policy "team_full_access" on public.testimonials for all using (is_company_member(company_id)) with check (is_company_member(company_id));

-- New tables: client-facing access
create policy "client_reads_own" on public.deliverables for select using (
  client_visible = true and exists (select 1 from public.projects p where p.id = deliverables.project_id and client_owns(p.client_id))
);
create policy "client_reads_own" on public.comments for select using (client_owns(client_id));
create policy "client_inserts_own" on public.comments for insert with check (
  client_owns(client_id) and author_type = 'client' and author_client_user_id = auth.uid()
);
create policy "public_reads_approved" on public.testimonials for select using (is_approved = true);

-- tasks: gate the existing client-read policy behind client_visible
alter policy "client_reads_own_project_tasks" on public.tasks using (
  client_visible = true and project_id is not null and exists (
    select 1 from public.projects where projects.id = tasks.project_id and client_owns(projects.client_id)
  )
);
