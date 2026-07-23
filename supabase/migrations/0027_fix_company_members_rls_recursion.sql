-- founders_manage_company_memberships (0014) directly subquerying company_members
-- from within a policy ON company_members causes Postgres to re-evaluate RLS on
-- the inner query, which re-triggers the same policy, infinitely -- error 42P17
-- "infinite recursion detected in policy for relation company_members". Every
-- query against company_members (including the plain SELECT policy, since this
-- is a FOR ALL policy) hit this and 500'd, which surfaced as blank pages
-- wherever a component depended on that data (e.g. Leads).
--
-- Fix: route the founder check through a SECURITY DEFINER helper, same pattern
-- as is_company_member() -- it runs with the function owner's privileges, so
-- its internal query bypasses RLS on company_members entirely instead of
-- re-entering the policy that's calling it.
create function public.is_company_founder(check_company_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from public.company_members
    where profile_id = auth.uid() and company_id = check_company_id and role = 'founder'
  );
$$;

drop policy "founders_manage_company_memberships" on public.company_members;
create policy "founders_manage_company_memberships" on public.company_members for all using (
  public.is_company_founder(company_id)
) with check (
  public.is_company_founder(company_id)
);
