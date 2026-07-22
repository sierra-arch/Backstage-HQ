-- Phase 7 (Client Portal Expansion): a client needs to see their own
-- testimonial submission even before the team approves it (so the portal
-- can show "thanks, awaiting review" instead of re-prompting for another).
create policy "client_reads_own" on public.testimonials for select using (client_owns(client_id));
