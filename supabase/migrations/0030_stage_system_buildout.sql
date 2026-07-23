-- Stage System Buildout: fills in the two real gaps in the Company Stage
-- system (migrations 0022-0026) -- Stage One was missing 7 of the systems
-- the founder's notes call for, and Stage Three had zero systems seeded at
-- all (a company reaching it saw an empty Systems page). Also lets a
-- template_type reappear at a later stage "in further detail" (the
-- founder's notes list several systems at both Stage One and Stage Three),
-- adds a stage_progress nudge type reusing the existing safety_net_nudges
-- mechanism, and a profiles.active_company_id column driving a new global
-- company switcher + whole-app stage theming. Giving each system real
-- guided content (instead of a blank template + checkbox) is a confirmed,
-- separate follow-up -- not this pass.

-- A template_type could previously only ever be unlocked once per company,
-- ever. Widen to (company_id, template_type, stage) so the same system can
-- have one row at Stage One and a separate row at Stage Three, each with
-- its own status.
alter table public.system_unlocks drop constraint system_unlocks_company_id_template_type_key;
alter table public.system_unlocks add constraint system_unlocks_company_id_template_type_stage_key
  unique (company_id, template_type, stage);

-- Lets a Stage Three re-pass of a Stage One system carry different framing
-- text without a second table -- SystemUnlockRow displays this under the
-- system name when present.
alter table public.system_unlocks add column depth_note text;

-- 7 new Stage One types, 2 new Stage Three types. product_sheet and
-- pricing_breakdown already existed -- reused, not duplicated.
alter table public.document_templates drop constraint document_templates_type_check;
alter table public.document_templates add constraint document_templates_type_check
  check (type = ANY (ARRAY[
    'proposal','design_brief','contract','freebie','new_hire_packet',
    'product_sheet','pricing_breakdown','policies_sheet','links_page',
    'onboarding','vision_mapping','sales_script_milestones',
    'branding_essentials','policies_checklist',
    'client_journey_funnel','digital_hub_stack','fulfillment_checklist',
    'infrastructure_anatomy','cashflow_reports',
    'department_buildout','delegation_playbook'
  ]));

-- "Push the needle" suggestions reuse the existing safety_net_nudges
-- mechanism (same cash_buffer/quiet_lead pattern) rather than a new system.
alter table public.safety_net_nudges drop constraint safety_net_nudges_type_check;
alter table public.safety_net_nudges add constraint safety_net_nudges_type_check
  check (type in ('cash_buffer', 'quiet_lead', 'seasonal_dip', 'stage_progress'));

-- Per-person UI preference (not shared business data) driving the new
-- global company switcher and whole-app stage theming. Nullable, falls
-- back to the first company in the list, same as today's per-page pickers.
alter table public.profiles add column active_company_id uuid references public.companies(id) on delete set null;

-- Stage One: the 4 existing systems stay as-is, plus 7 net-new ones.
insert into public.system_unlocks (company_id, system_name, template_type, stage, status, unlocked_at)
select c.id, sys.name, sys.type, 'one',
  case when c.current_stage in ('two', 'three') then 'complete' else 'available' end,
  case when c.current_stage in ('two', 'three') then now() else null end
from public.companies c
cross join (values
  ('Simple Client Journey Funnel', 'client_journey_funnel'),
  ('Digital Hub Stack', 'digital_hub_stack'),
  ('Product Spec Sheets', 'product_sheet'),
  ('Pricing Breakdown', 'pricing_breakdown'),
  ('Fulfillment Checklists', 'fulfillment_checklist'),
  ('Infrastructure Anatomy', 'infrastructure_anatomy'),
  ('Cash Flow Reports', 'cashflow_reports')
) as sys(name, type)
on conflict (company_id, template_type, stage) do nothing;

-- Stage Three: a deliberate starting seed (2 systems), not an exhaustive
-- list -- the founder's notes don't give an explicit Stage Three checklist
-- the way they do for One/Two, she'll add more over time.
insert into public.system_unlocks (company_id, system_name, template_type, stage, status)
select c.id, sys.name, sys.type, 'three',
  case when c.current_stage = 'three' then 'available' else 'locked' end
from public.companies c
cross join (values
  ('Department Build-Out Plan', 'department_buildout'),
  ('Delegation & Hiring Playbook', 'delegation_playbook')
) as sys(name, type)
on conflict (company_id, template_type, stage) do nothing;

-- Stage Three also gets deepened re-passes of 4 Stage One systems, per the
-- founder's explicit "steps from stage one will also be there in further
-- detail" direction.
insert into public.system_unlocks (company_id, system_name, template_type, stage, status, depth_note)
select c.id, sys.name, sys.type, 'three',
  case when c.current_stage = 'three' then 'available' else 'locked' end,
  sys.depth_note
from public.companies c
cross join (values
  ('Vision Mapping', 'vision_mapping', 'Revisit with your team''s vision, not just your own.'),
  ('Sales Script Milestones', 'sales_script_milestones', 'Adapt for a team that isn''t you selling.'),
  ('Pricing Breakdown', 'pricing_breakdown', 'Full margin and multi-tier pricing analysis.'),
  ('Cash Flow Reports', 'cashflow_reports', 'Team payroll and delegation costs factored in.')
) as sys(name, type, depth_note)
on conflict (company_id, template_type, stage) do nothing;
