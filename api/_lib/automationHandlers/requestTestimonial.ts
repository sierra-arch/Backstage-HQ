// requestTestimonial.ts
//
// The vetted handler behind the 'request_testimonial' action_type. Today
// this is a deliberate no-op: Phase 7's OffboardingCard already surfaces
// the testimonial/referral capture reactively (it checks
// project.status === 'completed' on every portal load, per roadmap.md's
// Phase 10 note), so there's no additional side effect to fire here yet.
// Kept as a real handler -- not omitted from the dispatch table -- so a
// founder can still place this node in a chain and see it execute (status
// pill updates) without silently doing nothing unexplained.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface RequestTestimonialContext {
  companyId: string;
}

export async function requestTestimonial(_supabase: SupabaseClient, _ctx: RequestTestimonialContext): Promise<void> {
  // No-op by design -- see file header.
}
