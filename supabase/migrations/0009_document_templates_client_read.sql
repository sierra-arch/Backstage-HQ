-- Allow a client-portal user to read the document_templates row linked to
-- one of their own generated_documents. Needed so the client portal can
-- render proposal section labels, line-item names/descriptions, and
-- optional/quantity bounds without granting broad template access.
create policy "client_reads_linked" on document_templates
  for select
  using (
    exists (
      select 1 from generated_documents gd
      where gd.template_id = document_templates.id
        and client_owns(gd.client_id)
    )
  );
