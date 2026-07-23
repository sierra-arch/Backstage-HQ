-- Phase 20 (Post-Expansion): Stage One systems as document_templates types,
-- following the exact pattern established in Phase 4 (onboarding type).
-- Naming disambiguation (not asked about, low-risk call, documented in
-- roadmap.md): "branding_essentials" instead of a literal "branding_kit"
-- type to avoid colliding with the already-built brand_kits TABLE/feature;
-- "policies_checklist" instead of overloading the existing "policies_sheet"
-- type, which is a different thing (a reference document, not a checklist).
alter table public.document_templates drop constraint document_templates_type_check;
alter table public.document_templates add constraint document_templates_type_check
  check (type = ANY (ARRAY['proposal'::text, 'design_brief'::text, 'contract'::text, 'freebie'::text, 'new_hire_packet'::text, 'product_sheet'::text, 'pricing_breakdown'::text, 'policies_sheet'::text, 'links_page'::text, 'onboarding'::text, 'vision_mapping'::text, 'sales_script_milestones'::text, 'branding_essentials'::text, 'policies_checklist'::text]));
