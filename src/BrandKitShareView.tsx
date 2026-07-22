// BrandKitShareView.tsx
// The first fully public, no-login page in this app — anyone with the link
// can view it, by design (see supabase/migrations/0008_brand_kits.sql's
// public_can_read_brand_kits policy). Entirely separate from App.tsx and
// ClientPortalApp.tsx; touches nothing but brand_kits via the anon client.
import React, { useEffect, useState } from "react";
import { fetchBrandKitBySlug, type BrandKit } from "./useDatabase";

type LoadState =
  | { kind: "loading" }
  | { kind: "not_found" }
  | { kind: "ready"; brandKit: BrandKit };

const LOGO_LABELS: Record<string, string> = {
  primary: "Primary Logo",
  mark_only: "Mark Only",
  light: "Light Version",
  dark: "Dark Version",
};

const POLICY_LABELS: Record<string, string> = {
  payment_terms: "Payment Terms",
  cancellation_window: "Cancellation Window",
  communication_hours: "Communication Hours",
  revision_limits: "Revision Limits",
};

function CopyableSwatch({ label, hex }: { label: string; hex: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(hex).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      onClick={copy}
      className="rounded-2xl border overflow-hidden text-left hover:shadow-md transition-shadow"
    >
      <div className="h-20" style={{ backgroundColor: hex }} />
      <div className="p-3">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-neutral-500 font-mono">
          {copied ? "Copied!" : hex}
        </div>
      </div>
    </button>
  );
}

function CopyableText({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      onClick={copy}
      className="rounded-xl border px-4 py-3 text-left hover:bg-neutral-50 transition-colors w-full"
    >
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-sm font-medium">{copied ? "Copied!" : value}</div>
    </button>
  );
}

export function BrandKitShareView({ slug }: { slug: string }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let mounted = true;
    fetchBrandKitBySlug(slug).then((brandKit) => {
      if (!mounted) return;
      setState(brandKit ? { kind: "ready", brandKit } : { kind: "not_found" });
    });
    return () => {
      mounted = false;
    };
  }, [slug]);

  if (state.kind === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center text-neutral-400">
        Loading…
      </div>
    );
  }

  if (state.kind === "not_found") {
    return (
      <div className="min-h-screen flex items-center justify-center text-neutral-400">
        This brand kit link isn't valid.
      </div>
    );
  }

  const kit = state.brandKit;
  const logoEntries = Object.entries(kit.logo_variants || {}).filter(([, url]) => url);
  const policyEntries = Object.entries(kit.policy_defaults || {}).filter(([, v]) => v);

  return (
    <div className="min-h-screen bg-neutral-50 py-12 px-6">
      <div className="max-w-3xl mx-auto space-y-10">
        <div>
          <h1 className="text-2xl font-semibold">Brand Kit</h1>
          {kit.brand_description && (
            <p className="text-neutral-600 mt-2">{kit.brand_description}</p>
          )}
        </div>

        {logoEntries.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-neutral-700 mb-3">Logos</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {logoEntries.map(([key, url]) => (
                <div key={key} className="rounded-2xl border p-4 bg-white text-center space-y-2">
                  <img src={url} alt={LOGO_LABELS[key] || key} className="h-16 mx-auto object-contain" />
                  <div className="text-xs text-neutral-500">{LOGO_LABELS[key] || key}</div>
                  <a
                    href={url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-teal-700 hover:text-teal-800 underline"
                  >
                    Download
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}

        {(kit.color_primary || kit.color_secondary || kit.color_accent) && (
          <section>
            <h2 className="text-sm font-semibold text-neutral-700 mb-3">Colors</h2>
            <div className="grid grid-cols-3 gap-3">
              {kit.color_primary && <CopyableSwatch label="Primary" hex={kit.color_primary} />}
              {kit.color_secondary && <CopyableSwatch label="Secondary" hex={kit.color_secondary} />}
              {kit.color_accent && <CopyableSwatch label="Accent" hex={kit.color_accent} />}
            </div>
          </section>
        )}

        {(kit.font_heading || kit.font_body) && (
          <section>
            <h2 className="text-sm font-semibold text-neutral-700 mb-3">Typography</h2>
            <div className="grid grid-cols-2 gap-3">
              {kit.font_heading && <CopyableText label="Heading Font" value={kit.font_heading} />}
              {kit.font_body && <CopyableText label="Body Font" value={kit.font_body} />}
            </div>
          </section>
        )}

        {kit.tone_notes && (
          <section>
            <h2 className="text-sm font-semibold text-neutral-700 mb-3">Tone & Voice</h2>
            <p className="text-sm text-neutral-600 whitespace-pre-line">{kit.tone_notes}</p>
          </section>
        )}

        {policyEntries.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-neutral-700 mb-3">Policies</h2>
            <div className="grid grid-cols-2 gap-3">
              {policyEntries.map(([key, value]) => (
                <div key={key} className="rounded-xl border px-4 py-3 bg-white">
                  <div className="text-xs text-neutral-500">{POLICY_LABELS[key] || key}</div>
                  <div className="text-sm">{value}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
