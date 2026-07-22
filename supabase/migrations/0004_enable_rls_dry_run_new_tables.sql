-- Foundation milestone (4/5): enable RLS on the six brand-new, still-empty
-- tables from 0002/0003 first. Nothing existing can break here — this is a
-- dry run proving the policy pattern works before it touches any live data
-- in 0005.
--
-- Run this file, then verify (see plan doc / migration 0005 comments)
-- before moving on to 0005.

-- Reusable helper: "is the current caller a real logged-in team member?"
-- SECURITY DEFINER so this reads `profiles` directly regardless of the
-- caller's own row-level access to `profiles` — avoids a circular RLS
-- lookup (profiles' own policy would otherwise gate this check).
create or replace function is_team_member() returns boolean
language sql security definer stable as $$
  select exists (select 1 from profiles where id = auth.uid());
$$;

alter table intake_responses enable row level security;
create policy "team_full_access" on intake_responses
  for all using (is_team_member()) with check (is_team_member());

alter table proposals enable row level security;
create policy "team_full_access" on proposals
  for all using (is_team_member()) with check (is_team_member());

alter table agreements enable row level security;
create policy "team_full_access" on agreements
  for all using (is_team_member()) with check (is_team_member());

alter table projects enable row level security;
create policy "team_full_access" on projects
  for all using (is_team_member()) with check (is_team_member());

alter table invoices enable row level security;
create policy "team_full_access" on invoices
  for all using (is_team_member()) with check (is_team_member());

-- client_users: same team-manages-it policy for now. No client-self-access
-- policy yet — that's the next milestone's job, once client login exists
-- and there's something real to test it against.
alter table client_users enable row level security;
create policy "team_manage_client_users" on client_users
  for all using (is_team_member()) with check (is_team_member());
