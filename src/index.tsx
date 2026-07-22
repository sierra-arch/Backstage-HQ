import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ClientPortalApp } from "./ClientPortalApp";
import { BrandKitShareView } from "./BrandKitShareView";
import { IntakeWizard } from "./IntakeWizard";
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

function Root() {
  if (isPortal) return <ClientPortalApp />;
  if (brandSlugMatch) return <BrandKitShareView slug={brandSlugMatch[1]} />;
  if (intakeSlugMatch) return <IntakeWizard companySlug={intakeSlugMatch[1]} />;
  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
