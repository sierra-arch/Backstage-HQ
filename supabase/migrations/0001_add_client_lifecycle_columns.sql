-- Foundation milestone (1/5): add client-lifecycle columns to the existing
-- `clients` table. Additive only — safe for the current (empty) table and
-- for any future rows. Nothing else in this migration.

alter table clients
  add column stage text not null default 'lead'
    check (stage in ('lead', 'proposal_sent', 'active', 'delivered', 'archived')),
  add column track text
    check (track in ('freelancer', 'founder_mini', 'founder_full', 'ceo')),
  add column source text;
