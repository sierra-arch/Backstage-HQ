import React from "react";
import { supabase } from "./supabase";

/* ----------------------------------------------------------------------
   Public marketing site — served at /site (see src/index.tsx).

   Deliberately NOT wired into App.tsx / AuthGate: this must render for
   fully anonymous visitors with zero auth calls, same reasoning as
   ClientPortalApp / BrandKitShareView / IntakeWizard in index.tsx.

   Not yet mounted at the root "/" on purpose — the founder's dashboard
   currently lives at "/", and swapping that is a routing decision that
   belongs with the Phase 1/2 auth restructuring (see CLAUDE.md), not
   something to change quietly from a "public site" ticket. Move this to
   "/" once that restructuring lands.

   Copy below is editable — pulled from the real Backstage company record
   (purpose / who_they_serve / how_they_serve / vision) and lightly
   rewritten for a visitor-facing tone. Edit COPY directly, no DB changes
   needed for wording tweaks.
   ------------------------------------------------------------------- */

const BACKSTAGE_COMPANY_ID = "bf72821a-f6ec-4bee-8563-fc8a96c41f79";

const COPY = {
  brandName: "Backstage",
  eyebrow: "For entrepreneurs building the business behind the business",
  headline: "The back office your creative business has been missing.",
  subhead:
    "We help busy entrepreneurs who'd rather be doing their craft — not chasing invoices and onboarding paperwork — build the operations behind the scenes so the business runs without them holding every piece.",
  whoWeServe:
    "Busy entrepreneurs who want to spend their time on their creative talents but feel overwhelmed by all the business back-end work.",
  howWeServe:
    "Automation and systems, built around how you actually work — not a generic template.",
  ctaPrimary: "Get started",
  ctaSecondary: "Client login",
  freebieTitle: "Free: Client Onboarding Checklist",
  freebieBody:
    "The exact checklist we use to onboard a new client without anything falling through the cracks. Drop your email and we'll send it over.",
};

/* ---------------- Lead capture form ---------------- */
function LeadCaptureForm({ source }: { source: string }) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !email.includes("@")) {
      setErrorMsg("Please add your name and a valid email.");
      return;
    }
    setErrorMsg(null);
    setStatus("sending");
    try {
      const res = await fetch("/api/submit-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, source }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Something went wrong");
      setStatus("sent");
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err?.message || "Something went wrong — please try again.");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-3xl border border-teal-200 bg-teal-50 p-6 text-center">
        <p className="font-semibold text-teal-800">Thanks — we've got it!</p>
        <p className="text-sm text-teal-700 mt-1">We'll be in touch soon.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-full border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
        <input
          type="email"
          placeholder="Your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-full border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
      </div>
      <textarea
        placeholder="What are you looking for help with? (optional)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        className="w-full rounded-2xl border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
      />
      {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full sm:w-auto rounded-full bg-teal-600 text-white px-6 py-2.5 font-medium hover:bg-teal-700 disabled:opacity-60 transition-colors"
      >
        {status === "sending" ? "Sending…" : COPY.ctaPrimary}
      </button>
    </form>
  );
}

/* ---------------- Section: Nav ---------------- */
function Nav() {
  return (
    <header className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
      <span className="font-semibold text-lg text-teal-800">{COPY.brandName}</span>
      <a
        href="/"
        className="text-sm rounded-full border border-teal-200 px-4 py-2 text-teal-700 hover:bg-teal-50 transition-colors"
      >
        {COPY.ctaSecondary}
      </a>
    </header>
  );
}

/* ---------------- Section: Hero ---------------- */
function Hero() {
  return (
    <section className="max-w-3xl mx-auto px-6 pt-10 pb-16 text-center">
      <p className="text-sm font-medium text-teal-600 mb-3">{COPY.eyebrow}</p>
      <h1 className="text-3xl sm:text-4xl font-semibold text-neutral-900 leading-tight mb-4">
        {COPY.headline}
      </h1>
      <p className="text-neutral-600 text-lg mb-8">{COPY.subhead}</p>
      <a
        href="#get-started"
        className="inline-block rounded-full bg-teal-600 text-white px-7 py-3 font-medium hover:bg-teal-700 transition-colors"
      >
        {COPY.ctaPrimary}
      </a>
    </section>
  );
}

/* ---------------- Section: What we do ---------------- */
function WhatWeDo() {
  const items = [
    { title: "Who we work with", body: COPY.whoWeServe },
    { title: "How we help", body: COPY.howWeServe },
  ];
  return (
    <section className="bg-sage-50 py-14">
      <div className="max-w-4xl mx-auto px-6 grid sm:grid-cols-2 gap-6">
        {items.map((item) => (
          <div key={item.title} className="rounded-3xl bg-white border border-neutral-200/70 p-6">
            <h3 className="font-semibold text-teal-800 mb-2">{item.title}</h3>
            <p className="text-sm text-neutral-600">{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Section: Testimonial wall ----------------
   `testimonials` has a public RLS policy ("public_reads_approved": select
   using is_approved = true — see supabase/migrations/0013), so this reads
   live via the anon client. No testimonials have been collected yet (the
   offboarding capture flow is a later phase), so this renders an honest
   "coming soon" state until real approved rows exist — never fabricated
   quotes.
   ------------------------------------------------------------------- */
type Testimonial = { id: string; quote: string; author_name: string; author_photo_url: string | null };

function TestimonialWall() {
  const [testimonials, setTestimonials] = React.useState<Testimonial[] | null>(null);

  React.useEffect(() => {
    let alive = true;
    supabase
      .from("testimonials")
      .select("id, quote, author_name, author_photo_url")
      .eq("company_id", BACKSTAGE_COMPANY_ID)
      .eq("is_approved", true)
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          console.error("Error loading testimonials:", error);
          setTestimonials([]);
          return;
        }
        setTestimonials((data as Testimonial[]) ?? []);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="py-14">
      <div className="max-w-4xl mx-auto px-6">
        <h2 className="text-xl font-semibold text-neutral-900 mb-6 text-center">Client stories</h2>
        {!testimonials ? null : testimonials.length === 0 ? (
          <p className="text-sm text-neutral-500 text-center">
            We're just getting started collecting stories from clients — check back soon.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-6">
            {testimonials.map((t) => (
              <blockquote key={t.id} className="rounded-3xl bg-sage-50 border border-neutral-200/70 p-6">
                <p className="text-neutral-700 text-sm mb-3">“{t.quote}”</p>
                <footer className="text-sm font-medium text-teal-800">{t.author_name}</footer>
              </blockquote>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------------- Section: Freebie + lead capture ---------------- */
function GetStarted() {
  return (
    <section id="get-started" className="bg-teal-800 py-16">
      <div className="max-w-2xl mx-auto px-6">
        <div className="rounded-3xl bg-white p-8">
          <h2 className="text-xl font-semibold text-neutral-900 mb-1">{COPY.freebieTitle}</h2>
          <p className="text-sm text-neutral-600 mb-6">{COPY.freebieBody}</p>
          <LeadCaptureForm source="public_site_freebie" />
        </div>
      </div>
    </section>
  );
}

/* ---------------- Section: Footer ---------------- */
function Footer() {
  return (
    <footer className="py-8 text-center text-xs text-neutral-400">
      © {new Date().getFullYear()} {COPY.brandName}. All rights reserved.
    </footer>
  );
}

export function PublicSite() {
  React.useEffect(() => {
    document.title = `${COPY.brandName} — ${COPY.eyebrow}`;
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) metaDescription.setAttribute("content", COPY.subhead);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <Hero />
      <WhatWeDo />
      <TestimonialWall />
      <GetStarted />
      <Footer />
    </div>
  );
}
