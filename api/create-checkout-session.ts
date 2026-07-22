// create-checkout-session.ts
//
// Client-portal endpoint: starts a Stripe Checkout session (hosted page, not
// Elements) for a single payment_installment. Never trusts a client-sent
// amount -- the charge amount always comes from the installment row itself,
// resolved server-side after verifying the installment belongs to the
// calling client.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import { getRequestClientUser, getAdminClient, UnauthorizedError } from "./_lib/supabaseServer";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let clientId: string;
  try {
    ({ clientId } = await getRequestClientUser(req.headers.authorization));
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      res.status(401).json({ error: err.message });
      return;
    }
    console.error("Auth error in create-checkout-session:", err);
    res.status(500).json({ error: "Something went wrong verifying your session" });
    return;
  }

  const { installment_id } = (req.body || {}) as { installment_id?: string };
  if (!installment_id || typeof installment_id !== "string") {
    res.status(400).json({ error: "installment_id is required" });
    return;
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const siteUrl = process.env.VITE_SITE_URL;
  if (!stripeSecretKey || !siteUrl) {
    console.error("Missing STRIPE_SECRET_KEY or VITE_SITE_URL");
    res.status(500).json({ error: "Online payments are not configured yet" });
    return;
  }

  const admin = getAdminClient();

  const { data: installment, error: installmentError } = await admin
    .from("payment_installments")
    .select("id, amount, sequence_number, status, invoice_id, payment_schedule_id, payment_schedules(client_id)")
    .eq("id", installment_id)
    .maybeSingle();

  if (installmentError || !installment) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }

  const scheduleClientId = (installment as any).payment_schedules?.client_id;
  if (scheduleClientId !== clientId) {
    res.status(403).json({ error: "You don't have access to this payment" });
    return;
  }

  if (installment.status === "paid") {
    res.status(409).json({ error: "This payment has already been made" });
    return;
  }

  let invoiceId = installment.invoice_id as string | null;
  if (!invoiceId) {
    const { data: invoice, error: invoiceError } = await admin
      .from("invoices")
      .insert({ client_id: clientId, amount: installment.amount, status: "unpaid" })
      .select("id")
      .single();

    if (invoiceError || !invoice) {
      console.error("Error creating invoice for installment:", invoiceError);
      res.status(500).json({ error: "Failed to start payment — please try again" });
      return;
    }
    invoiceId = invoice.id;

    await admin
      .from("payment_installments")
      .update({ invoice_id: invoiceId, status: "invoiced" })
      .eq("id", installment.id);
  }

  const stripe = new Stripe(stripeSecretKey);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: `Payment ${installment.sequence_number}` },
          unit_amount: Math.round(installment.amount * 100),
        },
        quantity: 1,
      },
    ],
    success_url: `${siteUrl}/portal?payment=success`,
    cancel_url: `${siteUrl}/portal?payment=cancelled`,
    client_reference_id: clientId,
    metadata: { installment_id: installment.id, invoice_id: invoiceId },
  });

  if (!session.url) {
    res.status(500).json({ error: "Failed to start payment — please try again" });
    return;
  }

  res.status(200).json({ url: session.url });
}
