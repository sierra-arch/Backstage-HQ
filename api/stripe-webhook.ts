// stripe-webhook.ts
//
// Receives Stripe's checkout.session.completed event and marks the matching
// invoice + payment_installment paid. This is the only path that ever flips
// an installment to "paid" -- never trust a client-side "payment succeeded"
// callback, only a signature-verified webhook from Stripe itself.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import { getAdminClient } from "./_lib/supabaseServer";

export const config = {
  api: { bodyParser: false },
};

function readRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers["stripe-signature"];
  if (!stripeSecretKey || !webhookSecret || !signature || typeof signature !== "string") {
    res.status(500).json({ error: "Webhook is not configured" });
    return;
  }

  const stripe = new Stripe(stripeSecretKey);
  const rawBody = await readRawBody(req);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const installmentId = session.metadata?.installment_id;
    const invoiceId = session.metadata?.invoice_id;
    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

    if (installmentId && invoiceId) {
      const admin = getAdminClient();
      await admin.from("invoices").update({ status: "paid", stripe_payment_intent_id: paymentIntentId ?? null }).eq("id", invoiceId);
      await admin.from("payment_installments").update({ status: "paid" }).eq("id", installmentId);
    } else {
      console.error("checkout.session.completed missing installment_id/invoice_id metadata", session.id);
    }
  }

  res.status(200).json({ received: true });
}
