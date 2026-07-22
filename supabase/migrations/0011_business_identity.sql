-- Backstage OS philosophy (claude/backstage-os-philosophy.md) defines a
-- "BusinessIdentity" data model captured during the one-time onboarding
-- ritual: purpose, who_they_serve, how_they_serve, boundaries, vision, and a
-- generated read-only witness_statement stitched from those answers.
--
-- These live on `companies` since a company is already Backstage HQ's
-- top-level "business" entity. All columns are nullable text -- existing
-- companies (Backstage, Mairë, Prose Florals) simply have them unset, which
-- is fine since their onboarding_completed_at is already backfilled and the
-- wizard will never force itself onto them.
--
-- witness_statement is generated once by the wizard from the four answers
-- and is treated as read-only in the app layer (only regenerated if
-- onboarding is explicitly re-run via the Settings replay entry point).

alter table companies
  add column purpose text,
  add column who_they_serve text,
  add column how_they_serve text,
  add column boundaries text,
  add column vision text,
  add column witness_statement text;
