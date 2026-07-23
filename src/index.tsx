import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ClientPortalApp } from "./ClientPortalApp";
import { BrandKitShareView } from "./BrandKitShareView";
import { IntakeWizard } from "./IntakeWizard";
import { PublicSite } from "./PublicSite";
import { OrgSignupWizard } from "./OrgSignupWizard";
import "./styles.css";

// Deliberately not a router — the client portal must never share App.tsx's
// AuthGate/ensureProfile path (see ClientPortalApp.tsx and
// supabase/migrations/0003_client_users_table.sql for why). The brand kit
// share view and intake wizard are both fully public (no-login) pages, so
// they're kept just as separate.
const path = window.location.pathname;
const isPortal = path.startsWith("/portal");
const brandSlugMatch = path.match(/^\/brand\/([^/]+)/);
const intakeSlugMatch = path.match(/^\/intake\/([^/]+)/);
// Public marketing site — lives at /site for now, not the root "/", so it
// doesn't disturb the founder's existing dashboard bookmark. Move to "/"
// once the Phase 1/2 route restructuring (app/portal/public split) lands.
const isPublicSite = path.startsWith("/site");
// White-label (Phase 17): self-serve signup for a brand-new tenant.
const isGetStarted = path.startsWith("/get-started");

function Root() {
  if (isPortal) return <ClientPortalApp />;
  if (brandSlugMatch) return <BrandKitShareView slug={brandSlugMatch[1]} />;
  if (intakeSlugMatch) return <IntakeWizard companySlug={intakeSlugMatch[1]} />;
  if (isPublicSite) return <PublicSite />;
  if (isGetStarted) return <OrgSignupWizard />;
  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
