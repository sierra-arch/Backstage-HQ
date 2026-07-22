-- Client portal milestone: read-only, client-scoped RLS policies, additive
-- alongside the existing team_full_access policies (nothing dropped) —
-- team members keep full access; a client login gets a narrow, read-only
-- window into their own data only.

create or replace function client_owns(check_client_id uuid) returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from client_users
    where id = auth.uid() and client_id = check_client_id
  );
$$;

-- Load-bearing: without this, a client can't even look up their own
-- client_id (they're not a team member, and the existing policy on this
-- table is team-only).
create policy "client_reads_own_mapping" on client_users
  for select using (id = auth.uid());

create policy "client_reads_own" on clients
  for select using (client_owns(id));

create policy "client_reads_own" on proposals
  for select using (client_owns(client_id));

create policy "client_reads_own" on agreements
  for select using (client_owns(client_id));

create policy "client_reads_own" on projects
  for select using (client_owns(client_id));

create policy "client_reads_own" on invoices
  for select using (client_owns(client_id));

-- Tasks are only visible to a client through their linked project — never
-- the flat tasks table generally (most tasks have no project_id at all).
create policy "client_reads_own_project_tasks" on tasks
  for select using (
    project_id is not null and exists (
      select 1 from projects
      where projects.id = tasks.project_id
        and client_owns(projects.client_id)
    )
  );
