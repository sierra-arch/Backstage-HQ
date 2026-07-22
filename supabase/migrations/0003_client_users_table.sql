-- Foundation milestone (3/5): maps a future magic-link auth user to exactly
-- one client record. Nothing uses this table yet — it exists now so the
-- client-login milestone has somewhere to record "invited" vs. "accepted"
-- without another schema change at that point.
--
-- IMPORTANT for the future client-login milestone: the login flow for a
-- client_users row must NOT route through src/App.tsx's existing
-- AuthGate/ensureProfile. That path unconditionally creates a `profiles`
-- row for any authenticated session, which — once RLS lands in 0004/0005 —
-- grants full internal-tool access. A client login must never get a
-- `profiles` row.

create table client_users (
  id uuid primary key references auth.users(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  email text not null,
  invited_at timestamptz not null default now(),
  first_login_at timestamptz,
  created_at timestamptz not null default now()
);

create index client_users_client_id_idx on client_users(client_id);
