// process-email-sequences.ts
//
// Daily Vercel cron job (see vercel.json) that sends whatever sequence step
// is due today for each active enrollment, then advances it to the next
// step (or marks it completed if there isn't one). Protected by CRON_SECRET
// -- Vercel automatically sends `Authorization: Bearer $CRON_SECRET` on
// scheduled invocations when that env var is set.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminClient } from "../_lib/supabaseServer";
import { getResendClient, getFromAddress } from "../_lib/resend";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const admin = getAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: due, error: dueError } = await admin
    .from("email_sequence_enrollments")
    .select("id, sequence_id, email, next_step_order")
    .eq("status", "active")
    .lte("next_send_at", today);

  if (dueError) {
    console.error("Error loading due enrollments:", dueError);
    res.status(500).json({ error: "Failed to load due enrollments" });
    return;
  }
  if (!due || due.length === 0) {
    res.status(200).json({ ok: true, processed: 0 });
    return;
  }

  let resend;
  try {
    resend = getResendClient();
  } catch {
    res.status(500).json({ error: "Email sending is not configured yet" });
    return;
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

  res.status(200).json({ ok: true, processed });
}
