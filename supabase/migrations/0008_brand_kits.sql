-- Brand Kit milestone: one brand kit per company, driving on-brand
-- rendering for every future document module, plus a public shareable
-- reference view at /brand/{share_slug}.

create table brand_kits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  logo_variants jsonb not null default '{}'::jsonb,
    -- { primary, mark_only, light, dark } — plain URLs, same convention
    -- as clients.photo_url / products.photo_url elsewhere in this app.
  color_primary text,
  color_secondary text,
  color_accent text,
  font_heading text,
  font_body text,
  brand_description text,
  tone_notes text,
  policy_defaults jsonb not null default '{}'::jsonb,
  cashflow_bands jsonb not null default '{}'::jsonb,
  share_slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table brand_kits enable row level security;

create policy "team_full_access" on brand_kits
  for all using (is_team_member()) with check (is_team_member());

-- Deliberate exception to "everything RLS-locked": brand kits are meant to
-- be handed out as a public share link ("hand a link to my designer and
-- they have everything they need"). No client/task data lives on this
-- table — just branding — so public SELECT is the intended behavior, not
-- a leak.
create policy "public_can_read_brand_kits" on brand_kits
  for select using (true);
