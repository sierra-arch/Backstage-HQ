-- Phase 13 (Client Portal Expansion): social media planner -- calendar +
-- drafts only, no third-party posting API yet. Internal-only (team RLS),
-- so this needs no new serverless function -- the team writes directly via
-- their own session under team_full_access, same as tasks/notes/etc.
create table public.social_posts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'facebook', 'tiktok', 'pinterest', 'twitter', 'linkedin', 'other')),
  content text not null default '',
  image_url text,
  scheduled_date date,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'posted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index social_posts_company_id_idx on public.social_posts(company_id);
create index social_posts_scheduled_date_idx on public.social_posts(scheduled_date);
alter table public.social_posts enable row level security;
create policy "team_full_access" on public.social_posts for all using (is_company_member(company_id)) with check (is_company_member(company_id));
