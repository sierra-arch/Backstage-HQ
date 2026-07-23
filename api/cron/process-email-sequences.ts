// process-email-sequences.ts
//
// Daily Vercel cron job (see vercel.json). Two jobs share this one
// scheduled function -- email sequence processing and Safety Net nudge
// generation -- rather than each getting its own serverless function,
// since Vercel Hobby caps a deployment at 12 and this project is already
// at that limit (see roadmap.md's Phase 12 hotfix note). Protected by
// CRON_SECRET -- Vercel automatically sends `Authorization: Bearer
// $CRON_SECRET` on scheduled invocations when that env var is set.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminClient } from "../_lib/supabaseServer";
import { getResendClient, getFromAddress } from "../_lib/resend";

async function processEmailSequences(admin: SupabaseClient): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: due, error: dueError } = await admin
    .from("email_sequence_enrollments")
    .select("id, sequence_id, email, next_step_order")
    .eq("status", "active")
    .lte("next_send_at", today);

  if (dueError) {
    console.error("Error loading due enrollments:", dueError);
    return 0;
  }
  if (!due || due.length === 0) return 0;

  let resend;
  try {
    resend = getResendClient();
  } catch {
    console.error("Email sending is not configured yet -- skipping sequence processing");
    return 0;
  }

  let processed = 0;
  for (const enrollment of due) {
    const { data: step } = await admin
      .from("email_sequence_steps")
      .select("subject, body")
      .eq("sequence_id", enrollment.sequence_id)
      .eq("step_order", enrollment.next_step_order)
      .maybeSingle();

    if (!step) {
      await admin.from("email_sequence_enrollments").update({ status: "completed" }).eq("id", enrollment.id);
      continue;
    }

    try {
      await resend.emails.send({ from: getFromAddress(), to: enrollment.email, subject: step.subject, html: step.body });
    } catch (sendError) {
      console.error(`Failed sending sequence step to ${enrollment.email}:`, sendError);
      continue;
    }

    const { data: nextStep } = await admin
      .from("email_sequence_steps")
      .select("step_order, delay_days")
      .eq("sequence_id", enrollment.sequence_id)
      .eq("step_order", enrollment.next_step_order + 1)
      .maybeSingle();

    if (nextStep) {
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + nextStep.delay_days);
      await admin
        .from("email_sequence_enrollments")
        .update({ next_step_order: nextStep.step_order, next_send_at: nextDate.toISOString().slice(0, 10) })
        .eq("id", enrollment.id);
    } else {
      await admin.from("email_sequence_enrollments").update({ status: "completed" }).eq("id", enrollment.id);
    }
    processed++;
  }

  return processed;
}

// Safety Net v1: cash_buffer and quiet_lead only -- seasonal_dip is a valid
// type but deliberately not generated yet (needs a full season of revenue
// history to mean anything). Dedup: skip creating a nudge of a given type
// if the company already has one that's neither dismissed nor acted on --
// once the founder clears it, the check is free to fire again if the
// underlying pattern is still true.
async function generateSafetyNetNudges(admin: SupabaseClient): Promise<number> {
  const { data: companies } = await admin.from("companies").select("id");
  if (!companies) return 0;

  let created = 0;

  for (const company of companies) {
    const { data: existingActive } = await admin
      .from("safety_net_nudges")
      .select("type")
      .eq("company_id", company.id)
      .is("dismissed_at", null)
      .is("acted_at", null);
    const activeTypes = new Set((existingActive || []).map((n) => n.type));

    // Cash buffer: this week's paid revenue vs. the trailing 4-week average.
    if (!activeTypes.has("cash_buffer")) {
      const now = new Date();
      const startOfThisWeek = new Date(now);
      startOfThisWeek.setDate(now.getDate() - now.getDay());
      startOfThisWeek.setHours(0, 0, 0, 0);
      const startOfTrailing = new Date(startOfThisWeek);
      startOfTrailing.setDate(startOfTrailing.getDate() - 28);

      const { data: invoices } = await admin
        .from("invoices")
        .select("amount, created_at")
        .eq("status", "paid")
        .gte("created_at", startOfTrailing.toISOString());
      // invoices has no company_id directly -- scope via the client it belongs to.
      const { data: companyClientIds } = await admin.from("clients").select("id").eq("company_id", company.id);
      const clientIdSet = new Set((companyClientIds || []).map((c) => c.id));

      if (invoices && clientIdSet.size > 0) {
        const { data: scopedInvoices } = await admin
          .from("invoices")
          .select("amount, created_at, client_id")
          .eq("status", "paid")
          .gte("created_at", startOfTrailing.toISOString())
          .in("client_id", Array.from(clientIdSet));

        const thisWeek = (scopedInvoices || []).filter((i) => new Date(i.created_at) >= startOfThisWeek);
        const trailing = (scopedInvoices || []).filter((i) => new Date(i.created_at) < startOfThisWeek);
        const thisWeekTotal = thisWeek.reduce((s, i) => s + Number(i.amount), 0);
        const trailingAvg = trailing.reduce((s, i) => s + Number(i.amount), 0) / 4;

        if (trailingAvg > 0 && thisWeekTotal < trailingAvg * 0.5) {
          await admin.from("safety_net_nudges").insert({
            company_id: company.id,
            type: "cash_buffer",
            message: "This week's income looks lighter than your recent average — want to take a look at your pipeline?",
          });
          created++;
        }
      }
    }

    // Quiet lead: active-pipeline leads with no movement in 7+ days.
    if (!activeTypes.has("quiet_lead")) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data: quietLeads } = await admin
        .from("leads")
        .select("id")
        .eq("company_id", company.id)
        .not("status", "in", "(won,lost)")
        .lt("updated_at", sevenDaysAgo.toISOString());

      if (quietLeads && quietLeads.length > 0) {
        const plural = quietLeads.length === 1 ? "lead hasn't" : "leads haven't";
        await admin.from("safety_net_nudges").insert({
          company_id: company.id,
          type: "quiet_lead",
          message: `${quietLeads.length} ${plural} heard from you in over a week — here's an option to check back in, whenever works.`,
        });
        created++;
      }
    }
  }

  return created;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const admin = getAdminClient();
  const sequencesProcessed = await processEmailSequences(admin);
  const nudgesCreated = await generateSafetyNetNudges(admin);

  res.status(200).json({ ok: true, sequencesProcessed, nudgesCreated });
}
