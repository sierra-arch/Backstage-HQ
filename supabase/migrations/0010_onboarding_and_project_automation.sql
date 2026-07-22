-- Milestone: real Client Journey automation + Getting Started wizard.
--
-- Two independent additions:
--
-- 1. `companies.onboarding_completed_at` gates the new step-by-step Getting
--    Started wizard. Existing companies are backfilled to `now()` so Sierra's
--    three real companies (Backstage, Mairë, Prose Florals) never see the
--    wizard forced on them retroactively -- it only auto-shows for a company
--    created after this migration with no value set.
--
-- 2. `tasks.metadata` already exists (jsonb) and is reused -- no new column
--    needed there. We tag automation-created tasks with
--    `{"auto_created": true, "trigger": "proposal_accepted"}` so the UI can
--    show a distinct "Automated" badge, and so this is auditable later.
--    Documented here for schema-history completeness even though it's a
--    convention, not a migration.

alter table companies
  add column onboarding_completed_at timestamptz;

update companies
  set onboarding_completed_at = now()
  where onboarding_completed_at is null;
