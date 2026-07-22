-- Phase 4 (Client Portal Expansion): post-acceptance onboarding form,
-- template-driven per service type, extending the same document_templates
-- mechanism the proposal engine already uses -- not a new parallel system.
-- structure shape for type='onboarding': { questions: [{ key, label, kind,
-- options? }], task_templates: [{ title, description }] }.
alter table public.document_templates drop constraint document_templates_type_check;
alter table public.document_templates add constraint document_templates_type_check
  check (type = ANY (ARRAY['proposal'::text, 'design_brief'::text, 'contract'::text, 'freebie'::text, 'new_hire_packet'::text, 'product_sheet'::text, 'pricing_breakdown'::text, 'policies_sheet'::text, 'links_page'::text, 'onboarding'::text]));

alter table public.projects add column onboarding_completed_at timestamptz;
alter table public.projects add column onboarding_responses jsonb not null default '{}'::jsonb;
