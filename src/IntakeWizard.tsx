// IntakeWizard.tsx
// Public, no-login stepped intake form — one per company (`/intake/{slug}`).
// Submission goes through api/submit-intake.ts (service-role key), never a
// direct client-side insert — clients/intake_responses have no anonymous-
// write RLS policy, and that's staying true. Progress is saved to
// localStorage only, so a visitor can leave and come back on the same
// browser without losing their answers.
import React, { useEffect, useState } from "react";

interface FormState {
  name: string;
  business_name: string;
  contact_email: string;
  contact_phone: string;
  revenue: string;
  team_size: string;
  stage: string;
  primary_goal: string;
  source: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  business_name: "",
  contact_email: "",
  contact_phone: "",
  revenue: "",
  team_size: "",
  stage: "",
  primary_goal: "",
  source: "",
};

const STEPS = ["About You", "Where You're At", "What You Need", "How You Found Us", "Review"];

function storageKey(companySlug: string) {
  return `backstage-intake-${companySlug}`;
}

export function IntakeWizard({ companySlug }: { companySlug: string }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey(companySlug));
    if (saved) {
      try {
        setForm({ ...EMPTY_FORM, ...JSON.parse(saved) });
      } catch {
        // ignore malformed saved state
      }
    }
  }, [companySlug]);

  useEffect(() => {
    if (!submitted) {
      localStorage.setItem(storageKey(companySlug), JSON.stringify(form));
    }
  }, [form, companySlug, submitted]);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const canContinue = (() => {
    if (step === 0) return form.name.trim() && form.contact_email.trim();
    if (step === 1) return form.revenue && form.team_size && form.stage;
    return true;
  })();

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/submit-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_slug: companySlug, ...form }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong — please try again.");
        return;
      }
      localStorage.removeItem(storageKey(companySlug));
      setSubmitted(true);
    } catch {
      setError("Something went wrong — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-semibold">Thank you!</h1>
          <p className="text-neutral-600">
            We've got your application — keep an eye on your inbox, we'll be in touch soon to
            schedule a discovery call.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      <aside className="w-56 shrink-0 border-r bg-white p-6 hidden md:block">
        <div className="space-y-3">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`text-sm px-3 py-2 rounded-xl ${
                i === step
                  ? "bg-teal-50 text-teal-900 font-medium"
                  : i < step
                  ? "text-teal-700"
                  : "text-neutral-400"
              }`}
            >
              {label}
            </div>
          ))}
        </div>
      </aside>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white rounded-2xl border shadow-sm p-8 space-y-6">
          <div className="md:hidden text-xs text-neutral-500">
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </div>

          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">About You & Your Business</h2>
              <div>
                <label className="text-sm font-medium text-neutral-700">Your Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700">Business Name</label>
                <input
                  value={form.business_name}
                  onChange={(e) => set("business_name", e.target.value)}
                  className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700">Email *</label>
                <input
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => set("contact_email", e.target.value)}
                  className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700">Phone (optional)</label>
                <input
                  value={form.contact_phone}
                  onChange={(e) => set("contact_phone", e.target.value)}
                  className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Where You're At</h2>
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-2">
                  Annual revenue
                </label>
                <div className="space-y-2">
                  {[
                    ["under_25k", "Under $25k"],
                    ["25k_75k", "$25k – $75k"],
                    ["75k_200k", "$75k – $200k"],
                    ["over_200k", "$200k+"],
                  ].map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="revenue"
                        checked={form.revenue === value}
                        onChange={() => set("revenue", value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-2">Team size</label>
                <div className="space-y-2">
                  {[
                    ["just_me", "Just me"],
                    ["one_to_two", "1–2 helpers"],
                    ["small_team", "A small team"],
                    ["full_team", "A full team"],
                  ].map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="team_size"
                        checked={form.team_size === value}
                        onChange={() => set("team_size", value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-2">
                  How would you describe where your business is right now?
                </label>
                <div className="space-y-2">
                  {[
                    ["just_starting", "Just starting out"],
                    ["steady_but_scattered", "Steady, but scattered"],
                    ["growing_but_stretched", "Growing, but stretched thin"],
                    ["ready_to_multiply", "Running smoothly, ready to multiply"],
                  ].map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="stage"
                        checked={form.stage === value}
                        onChange={() => set("stage", value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">What You Need Most</h2>
              <div className="space-y-2">
                {[
                  ["systems_delivery", "Systems & delivery"],
                  ["client_experience", "Client experience"],
                  ["more_clients", "Getting more clients"],
                  ["stepping_back", "Stepping back from day-to-day"],
                ].map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="primary_goal"
                      checked={form.primary_goal === value}
                      onChange={() => set("primary_goal", value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">How'd You Find Us</h2>
              <div className="space-y-2">
                {[
                  ["freebie", "A free resource/checklist"],
                  ["referral", "A referral"],
                  ["social", "Social media"],
                  ["search", "Search"],
                  ["other", "Other"],
                ].map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="source"
                      checked={form.source === value}
                      onChange={() => set("source", value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Review & Submit</h2>
              <div className="text-sm text-neutral-600 space-y-1">
                <p><strong>Name:</strong> {form.name}</p>
                {form.business_name && <p><strong>Business:</strong> {form.business_name}</p>}
                <p><strong>Email:</strong> {form.contact_email}</p>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="flex-1 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-neutral-50 transition-colors"
              >
                Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canContinue}
                className="flex-1 rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
