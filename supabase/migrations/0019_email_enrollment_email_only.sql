-- Phase 12: allow enrolling anyone by email, not only existing leads/clients
-- -- the sending logic only ever reads the `email` column, and requiring a
-- pre-existing lead_id/client_id link is an unnecessary usability constraint.
alter table public.email_sequence_enrollments drop constraint email_sequence_enrollments_one_target;
