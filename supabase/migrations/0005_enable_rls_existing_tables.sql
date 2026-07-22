-- Foundation milestone (5/5): enable RLS on every EXISTING table, using the
-- same is_team_member() policy pattern from 0004. This preserves current
-- behavior exactly (any logged-in team member already has full access via
-- app-level checks in src/useDatabase.ts) — it just makes Postgres enforce
-- what's already true in practice, closing the "no login at all" gap.
--
-- Note: `pending_approvals` is referenced by src/useDatabase.ts but does
-- NOT actually exist as a table in this database (confirmed via schema
-- introspection) — it's dead/unused code, so it's intentionally left out
-- of this migration. Don't add a policy for a table that isn't there.
--
-- DO NOT paste this whole file into the SQL editor at once. Run one
-- table's block at a time, then verify the live app still works for that
-- table (see the plan doc's verification checklist) before moving to the
-- next block. Order is deliberately lowest-risk first:
--   1. tables unused by the frontend today (dry run against real, but
--      inactive, tables)
--   2. messages / products (used, but not the core daily workflow)
--   3. companies / clients (used, low write-volume)
--   4. profiles (extra care: is_team_member() itself reads this table;
--      verify full sign-out/sign-in after)
--   5. tasks (last: highest-traffic, real daily-driver table)

-- ── 1. Unused-by-frontend tables (dry run against real, inactive tables) ──

alter table company_goals enable row level security;
create policy "team_full_access" on company_goals
  for all using (is_team_member()) with check (is_team_member());

alter table activity_log enable row level security;
create policy "team_full_access" on activity_log
  for all using (is_team_member()) with check (is_team_member());

alter table meetings enable row level security;
create policy "team_full_access" on meetings
  for all using (is_team_member()) with check (is_team_member());

alter table sop_categories enable row level security;
create policy "team_full_access" on sop_categories
  for all using (is_team_member()) with check (is_team_member());

alter table goals enable row level security;
create policy "team_full_access" on goals
  for all using (is_team_member()) with check (is_team_member());

alter table sops enable row level security;
create policy "team_full_access" on sops
  for all using (is_team_member()) with check (is_team_member());

alter table accomplishments enable row level security;
create policy "team_full_access" on accomplishments
  for all using (is_team_member()) with check (is_team_member());

alter table goal_updates enable row level security;
create policy "team_full_access" on goal_updates
  for all using (is_team_member()) with check (is_team_member());

alter table notes enable row level security;
create policy "team_full_access" on notes
  for all using (is_team_member()) with check (is_team_member());

alter table points_log enable row level security;
create policy "team_full_access" on points_log
  for all using (is_team_member()) with check (is_team_member());

-- ── 2. Used, but not the core daily workflow ──

alter table messages enable row level security;
create policy "team_full_access" on messages
  for all using (is_team_member()) with check (is_team_member());

alter table products enable row level security;
create policy "team_full_access" on products
  for all using (is_team_member()) with check (is_team_member());

-- ── 3. Core, but low write-volume ──

alter table companies enable row level security;
create policy "team_full_access" on companies
  for all using (is_team_member()) with check (is_team_member());

alter table clients enable row level security;
create policy "team_full_access" on clients
  for all using (is_team_member()) with check (is_team_member());

-- ── 4. profiles — extra care, verify sign-out/sign-in immediately after ──

alter table profiles enable row level security;
create policy "team_full_access" on profiles
  for all using (is_team_member()) with check (is_team_member());

-- ── 5. tasks — last: highest-traffic, real daily-driver table ──

alter table tasks enable row level security;
create policy "team_full_access" on tasks
  for all using (is_team_member()) with check (is_team_member());

-- ── After all of the above: check the 4 views still return data for a
-- team-member session (vw_company_goals, active_tasks, vw_brand_progress,
-- todays_focus). If any come back empty/error, it was created under a
-- role that bypasses RLS and needs:
--   alter view <view_name> set (security_invoker = on);
-- Verify each individually rather than assuming.
