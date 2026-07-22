// resend.ts
//
// Thin wrapper around the Resend SDK for transactional/marketing email.
// Requires RESEND_API_KEY (and ideally a verified sending domain) in Vercel
// env vars -- neither is configured yet, so every caller of this file is
// untested until that's set up. See claude/roadmap.md.
import { Resend } from "resend";

export function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Missing RESEND_API_KEY");
  return new Resend(apiKey);
}

export function getFromAddress(): string {
  return process.env.RESEND_FROM_ADDRESS || "onboarding@resend.dev";
}
