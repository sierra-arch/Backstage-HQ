-- company_members had RLS enabled but no policies (silently denies all access).
-- Team members need to read their own company memberships (used everywhere for
-- scoping) and founders need to manage membership (invite/remove team members
-- from a company) -- gated on the acting user already being a member of that
-- same company, so a team member of Company A can't add themselves to Company B.
create policy "reads_own_memberships" on public.company_members for select using (profile_id = auth.uid());
create policy "founders_manage_company_memberships" on public.company_members for all using (
  exists (
    select 1 from public.company_members cm
    where cm.company_id = company_members.company_id and cm.profile_id = auth.uid() and cm.role = 'founder'
  )
) with check (
  exists (
    select 1 from public.company_members cm
    where cm.company_id = company_members.company_id and cm.profile_id = auth.uid() and cm.role = 'founder'
  )
);
