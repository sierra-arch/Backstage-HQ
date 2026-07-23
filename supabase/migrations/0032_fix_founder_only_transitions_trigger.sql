-- 0031's enforce_founder_only_transitions() combined TG_TABLE_NAME and
-- NEW.<field> in a single `if A and B and C` expression per branch. Record
-- field access (NEW.status / NEW.stage) is parsed against NEW's actual
-- runtime row type before the AND's short-circuit evaluation ever runs --
-- so updating a `clients` row (which has no `status` column) hit "record
-- \"new\" has no field \"status\"" from the proposals branch, even though
-- that branch's TG_TABLE_NAME check would have been false. Caught via a
-- rolled-back test transaction before this ever touched real data.
--
-- Fix: nest the field-referencing checks inside a separate `if
-- TG_TABLE_NAME = ...` statement per table, so NEW.status/NEW.stage is
-- only ever parsed when NEW is actually that table's row type.
create or replace function public.enforce_founder_only_transitions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_TABLE_NAME = 'proposals' then
    if NEW.status = 'sent' and OLD.status is distinct from 'sent' then
      if not is_company_founder_via_client(NEW.client_id) then
        raise exception 'Only a founder can send a proposal';
      end if;
    end if;
  elsif TG_TABLE_NAME = 'clients' then
    if NEW.stage = 'archived' and OLD.stage is distinct from 'archived' then
      if not is_company_founder(NEW.company_id) then
        raise exception 'Only a founder can archive a client';
      end if;
    end if;
  elsif TG_TABLE_NAME = 'agreements' then
    if NEW.status = 'voided' and OLD.status is distinct from 'voided' then
      if not is_company_founder_via_client(NEW.client_id) then
        raise exception 'Only a founder can void an agreement';
      end if;
    end if;
  end if;
  return NEW;
end;
$$;
