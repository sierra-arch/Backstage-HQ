// notifyTeam.ts
//
// The vetted handler behind the 'notify_team' action_type. Same logic as
// src/useDatabase.ts's notifyFounders() (message every founder of a company
// via a self-addressed `messages` row, which is what the unread-badge query
// actually tracks -- see roadmap.md's Phase 10 note on why `from_user_id`
// is set to the same founder rather than a broadcast). Duplicated here
// rather than imported because useDatabase.ts pulls in the browser Supabase
// client module, which api/ routes don't load -- this takes whichever
// client the caller already has, same pattern as the rest of api/_lib.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface NotifyTeamContext {
  companyId: string;
  message: string;
}

export async function notifyTeam(supabase: SupabaseClient, ctx: NotifyTeamContext): Promise<void> {
  const { data: founders } = await supabase
    .from("company_members")
    .select("profile_id")
    .eq("company_id", ctx.companyId)
    .eq("role", "founder");

  if (!founders || founders.length === 0) return;

  await supabase.from("messages").insert(
    founders.map((f) => ({
      from_user_id: f.profile_id,
      to_user_id: f.profile_id,
      content: ctx.message,
      message_type: "team",
    }))
  );
}
