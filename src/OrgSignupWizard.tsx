// OrgSignupWizard.tsx
//
// Public, no-login self-serve signup for a brand-new tenant (Client Portal
// Expansion Phase 17 -- white-label). Standard anon-key auth.signUp(), then
// the signup_new_org() RPC atomically creates the profile + companies row +
// founder company_members row under that fresh session. Deliberately does
// NOT rebuild the "set up your business" ritual -- once the company exists
// with onboarding_completed_at left null (the column default),
// DashboardApp.tsx's existing needsOnboarding check auto-fires
// OnboardingWizard.tsx the moment this founder first loads the dashboard.
import React, { useState } from "react";
import { supabase } from "./supabase";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export function OrgSignupWizard() {
  const [orgName, setOrgName] = useState("");
  const [yourName, setYourName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgName.trim() || !yourName.trim() || !email.trim() || password.length < 8) return;
    setSubmitting(true);
    setError(null);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password });
    if (signUpError || !signUpData.session) {
      setError(signUpError?.message || "Check your email to confirm your account, then come back and sign in.");
      setSubmitting(false);
      return;
    }

    const { error: rpcError } = await supabase.rpc("signup_new_org", {
      p_org_name: orgName.trim(),
      p_org_slug: slugify(orgName),
      p_display_name: yourName.trim(),
    });

    if (rpcError) {
      setError(rpcError.message || "Something went wrong setting up your business — please try again.");
      setSubmitting(false);
      return;
    }

    setDone(true);
    window.location.href = "/";
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-6">
        <p className="text-neutral-600">Setting up your workspace…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-2xl border shadow-sm p-8 space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Set up your business</h1>
          <p className="text-sm text-neutral-500 mt-1">A fresh Backstage workspace for your own business, in a couple minutes.</p>
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700">Business name</label>
          <input value={orgName} onChange={(e) => setOrgName(e.target.value)} required className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700">Your name</label>
          <input value={yourName} onChange={(e) => setYourName(e.target.value)} required className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm" />
          <p className="text-xs text-neutral-400 mt-1">At least 8 characters.</p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-2xl bg-teal-600 text-white px-4 py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
        >
          {submitting ? "Setting up…" : "Create my workspace"}
        </button>
      </form>
    </div>
  );
}
