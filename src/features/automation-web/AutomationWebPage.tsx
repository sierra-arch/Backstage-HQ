import React, { useEffect, useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { useAutomationWeb, useProfile, fetchCompanyMembers } from "../../useDatabase";
import type { Automation, CompanyMember } from "./types";
import { canEditAutomation } from "./permissions";
import { AutomationWebCanvas } from "./AutomationWebCanvas";
import { NodeDetailPanel } from "./panel/NodeDetailPanel";

// companyId now comes from the app's global company switcher (Stage
// System Buildout) instead of a local picker -- one company in focus at a
// time, consistent with SystemsPage/MarketingPage.
export function AutomationWebPage({ companyId }: { companyId: string }) {
  const [member, setMember] = useState<CompanyMember | null>(null);
  const [selected, setSelected] = useState<Automation | null>(null);
  const { profile } = useProfile();
  const { automations, edges, loading, refetch } = useAutomationWeb(companyId || null);

  const loadMember = useCallback(async () => {
    if (!companyId || !profile) {
      setMember(null);
      return;
    }
    const members = await fetchCompanyMembers(companyId);
    setMember(members.find((m) => m.profile_id === profile.id) ?? null);
  }, [companyId, profile]);

  useEffect(() => {
    loadMember();
  }, [loadMember]);

  // Keep the panel's data fresh against the latest fetched automation, and
  // close it if the node it's showing is no longer visible/present.
  useEffect(() => {
    if (!selected) return;
    const fresh = automations.find((a) => a.id === selected.id);
    setSelected(fresh ?? null);
  }, [automations, selected]);

  const isFounderHere = member?.role === "founder";

  function handleChanged() {
    refetch();
  }

  return (
    <div className="space-y-4 h-[calc(100vh-140px)] flex flex-col">
      {!loading && automations.length === 0 && (
        <p className="text-sm text-neutral-400">Nothing here yet for this company.</p>
      )}

      <div className="flex-1">
        <AutomationWebCanvas
          automations={automations}
          edges={edges}
          isFounder={isFounderHere}
          member={member}
          onSelectAutomation={setSelected}
        />
      </div>

      <AnimatePresence>
        {selected && (
          <NodeDetailPanel
            automation={selected}
            allAutomations={automations}
            edges={edges}
            companyId={companyId}
            editable={canEditAutomation(selected, isFounderHere, member)}
            isFounder={isFounderHere}
            onClose={() => setSelected(null)}
            onChanged={handleChanged}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
