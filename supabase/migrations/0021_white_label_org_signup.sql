-- Phase 17 (Client Portal Expansion): white-label. Plan gating + custom
-- domain are schema-only for now (see reconciliation notes in roadmap.md).
-- The real new piece is self-serve org signup -- once a company exists,
-- the EXISTING OnboardingWizard.tsx already auto-fires for any company
-- with onboarding_completed_at null (DashboardApp.tsx's needsOnboarding
-- check), so that ritual doesn't need to be rebuilt, just triggered.

alter table public.companies add column plan text not null default 'starter' check (plan in ('starter', 'growth', 'pro'));
alter table public.companies add column custom_domain text unique;

-- Preserve today's behavior for Sierra's existing companies -- nothing
-- should newly gate behind a plan she never chose.
update public.companies set plan = 'pro';

-- Atomic self-serve org creation: auth.signUp() happens client-side first
-- (standard anon-key public signup, no admin API needed), then this runs
-- under that fresh session to create the profile + company + founder
-- membership together, so a failure partway through can't leave an
-- orphaned profile with no company or vice versa.
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

  return v_company_id;
end;
$$;

revoke all on function public.signup_new_org(text, text, text) from public;
grant execute on function public.signup_new_org(text, text, text) to authenticated;
