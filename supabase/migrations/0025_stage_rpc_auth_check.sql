-- Fix: check_stage_completion/accept_stage_transition were SECURITY DEFINER
-- with no caller-authorization check at all -- an anon or unrelated
-- authenticated caller could advance any company's stage. Both now require
-- the caller to actually be a member of the target company.
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
