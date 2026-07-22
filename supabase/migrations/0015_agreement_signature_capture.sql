-- Phase 3 (Client Portal Expansion): lightweight e-signature capture, not a
-- paid vendor. Typed full name + timestamp (signed_at, already existed) + IP.
alter table public.agreements
  add column signed_name text,
  add column signed_ip text;
