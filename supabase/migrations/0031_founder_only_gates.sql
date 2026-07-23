-- Nav & Feature Discoverability: founder-only gates for a set of actions
-- confirmed to stay founder-only even once a team member can see a
-- company. Brand Kit is a real read/write split (team can view, only a
-- founder can edit) so it gets separate RLS policies. Proposal-send,
-- client-archive, and agreement-void are each "any company member can do
-- anything to this row EXCEPT flip this one specific enum value, which
-- needs a founder" -- not cleanly expressible as a single RLS WITH CHECK
-- (which only sees the new row, not old-vs-new), so those three use a
-- BEFORE UPDATE trigger instead, same category of fix as 0026's missing
-- leads.updated_at trigger. This leaves the existing broad
-- team_full_access policies on proposals/clients/agreements completely
-- untouched for every other field/action.

drop policy "team_full_access" on public.brand_kits;
create policy "team_reads_brand_kit" on public.brand_kits for select using (is_company_member(company_id));
create policy "founder_manages_brand_kit" on public.brand_kits for insert
  with check (is_company_founder(company_id));
create policy "founder_updates_brand_kit" on public.brand_kits for update
  using (is_company_founder(company_id)) with check (is_company_founder(company_id));
create policy "founder_deletes_brand_kit" on public.brand_kits for delete
  using (is_company_founder(company_id));

-- proposals/agreements are scoped via client_id, not company_id directly --
-- mirrors is_company_member_via_client exactly, just checking role = 'founder'.
create or replace function public.is_company_founder_via_client(check_client_id uuid)
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from public.clients c
    join public.company_members cm on cm.company_id = c.company_id
    where c.id = check_client_id and cm.profile_id = auth.uid() and cm.role = 'founder'
  );
$$;

create or replace function public.enforce_founder_only_transitions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_TABLE_NAME = 'proposals' and NEW.status = 'sent' and OLD.status is distinct from 'sent' then
    if not is_company_founder_via_client(NEW.client_id) then
      raise exception 'Only a founder can send a proposal';
    end if;
  elsif TG_TABLE_NAME = 'clients' and NEW.stage = 'archived' and OLD.stage is distinct from 'archived' then
    if not is_company_founder(NEW.company_id) then
      raise exception 'Only a founder can archive a client';
    end if;
  elsif TG_TABLE_NAME = 'agreements' and NEW.status = 'voided' and OLD.status is distinct from 'voided' then
    if not is_company_founder_via_client(NEW.client_id) then
      raise exception 'Only a founder can void an agreement';
    end if;
  end if;
  return NEW;
end;
$$;

create trigger enforce_founder_only_send before update on public.proposals
  for each row execute function public.enforce_founder_only_transitions();
create trigger enforce_founder_only_archive before update on public.clients
  for each row execute function public.enforce_founder_only_transitions();
create trigger enforce_founder_only_void before update on public.agreements
  for each row execute function public.enforce_founder_only_transitions();

-- Team member removal needs no RLS change -- founders_manage_company_memberships
-- (0027) is already FOR ALL on company_members, so DELETE is already founder-only.
