import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  updateAutomation,
  createAutomationEdge,
  deleteAutomationEdge,
} from "../../../useDatabase";
import type { Automation, AutomationEdge } from "../types";
import { DEPARTMENTS, TRIGGER_LABELS, ACTION_LABELS } from "../types";
import { ConfirmChainChange } from "./ConfirmChainChange";

type PendingChange =
  | { type: "toggle_active"; message: string }
  | { type: "add_edge"; targetId: string; message: string }
  | { type: "remove_edge"; edgeId: string; message: string };

export function NodeDetailPanel({
  automation,
  allAutomations,
  edges,
  companyId,
  editable,
  isFounder,
  onClose,
  onChanged,
}: {
  automation: Automation;
  allAutomations: Automation[];
  edges: AutomationEdge[];
  companyId: string;
  editable: boolean;
  isFounder: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [saving, setSaving] = useState(false);
  const [connectTarget, setConnectTarget] = useState("");

  const outgoing = edges.filter((e) => e.source_automation_id === automation.id);
  const connectable = allAutomations.filter(
    (a) => a.id !== automation.id && !outgoing.some((e) => e.target_automation_id === a.id)
  );

  async function handleConfirm() {
    if (!pending) return;
    setSaving(true);
    if (pending.type === "toggle_active") {
      await updateAutomation(automation.id, { active: !automation.active, status: automation.active ? "paused" : "active" });
    } else if (pending.type === "add_edge") {
      await createAutomationEdge(companyId, automation.id, pending.targetId);
    } else if (pending.type === "remove_edge") {
      await deleteAutomationEdge(pending.edgeId);
    }
    setSaving(false);
    setPending(null);
    setConnectTarget("");
    onChanged();
  }

  function stageToggleActive() {
    setPending({
      type: "toggle_active",
      message: automation.active
        ? "Pause this automation? It will stop running until you resume it."
        : "Resume this automation? It will start running again.",
    });
  }

  function stageAddEdge() {
    const target = allAutomations.find((a) => a.id === connectTarget);
    if (!target) return;
    setPending({
      type: "add_edge",
      targetId: target.id,
      message: `Connect these two? This means "${target.title || ACTION_LABELS[target.action_type]}" will now run right after "${automation.title || ACTION_LABELS[automation.action_type]}".`,
    });
  }

  function stageRemoveEdge(edge: AutomationEdge) {
    const target = allAutomations.find((a) => a.id === edge.target_automation_id);
    setPending({
      type: "remove_edge",
      edgeId: edge.id,
      message: `Disconnect "${target?.title || target?.action_type || "this step"}"? It will no longer run after "${automation.title || ACTION_LABELS[automation.action_type]}".`,
    });
  }

  async function toggleDepartment(dept: string) {
    const next = automation.clearance_departments.includes(dept)
      ? automation.clearance_departments.filter((d) => d !== dept)
      : [...automation.clearance_departments, dept];
    await updateAutomation(automation.id, { clearance_departments: next });
    onChanged();
  }

  return (
    <motion.div
      initial={{ x: 400 }}
      animate={{ x: 0 }}
      exit={{ x: 400 }}
      className="fixed right-0 top-0 bottom-0 w-[420px] bg-white border-l shadow-2xl z-40 flex flex-col"
    >
      <div className="border-b px-5 py-4 flex items-center justify-between">
        <h3 className="font-semibold text-sm text-neutral-800">Automation details</h3>
        <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 text-lg leading-none">
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        <div>
          <p className="text-base font-semibold text-neutral-800">{automation.title || ACTION_LABELS[automation.action_type]}</p>
          <p className="text-sm text-neutral-400 mt-0.5">{automation.subtitle || TRIGGER_LABELS[automation.trigger_type]}</p>
        </div>

        <div className="space-y-1.5 text-sm">
          <p className="text-neutral-500">
            Trigger: <span className="text-neutral-700">{TRIGGER_LABELS[automation.trigger_type]}</span>
          </p>
          <p className="text-neutral-500">
            Action: <span className="text-neutral-700">{ACTION_LABELS[automation.action_type]}</span>
          </p>
        </div>

        {editable && (
          <button
            onClick={stageToggleActive}
            className="rounded-full border px-4 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            {automation.active ? "Pause this automation" : "Resume this automation"}
          </button>
        )}

        <div>
          <p className="text-sm font-medium text-neutral-700 mb-2">Runs next</p>
          {outgoing.length === 0 && <p className="text-sm text-neutral-400">Nothing connected yet.</p>}
          <div className="space-y-2">
            {outgoing.map((edge) => {
              const target = allAutomations.find((a) => a.id === edge.target_automation_id);
              return (
                <div key={edge.id} className="flex items-center justify-between rounded-xl border px-3 py-2 bg-neutral-50">
                  <span className="text-sm text-neutral-700">{target?.title || ACTION_LABELS[target?.action_type ?? ""] || "Unknown step"}</span>
                  {editable && (
                    <button onClick={() => stageRemoveEdge(edge)} className="text-xs text-neutral-400 hover:text-neutral-600">
                      Disconnect
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {editable && connectable.length > 0 && (
            <div className="flex gap-2 mt-3">
              <select
                value={connectTarget}
                onChange={(e) => setConnectTarget(e.target.value)}
                className="flex-1 rounded-xl border px-2 py-1.5 text-sm"
              >
                <option value="">Connect to…</option>
                {connectable.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title || ACTION_LABELS[a.action_type]}
                  </option>
                ))}
              </select>
              <button
                onClick={stageAddEdge}
                disabled={!connectTarget}
                className="rounded-xl border px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-40"
              >
                Connect
              </button>
            </div>
          )}
        </div>

        {isFounder && (
          <div>
            <p className="text-sm font-medium text-neutral-700 mb-2">Visible/editable to</p>
            <p className="text-xs text-neutral-400 mb-2">
              Leave empty for everyone on the team to see. Only tagged departments (plus you) can edit it.
            </p>
            <div className="flex flex-wrap gap-2">
              {DEPARTMENTS.map((dept) => {
                const active = automation.clearance_departments.includes(dept);
                return (
                  <button
                    key={dept}
                    onClick={() => toggleDepartment(dept)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border ${
                      active ? "bg-teal-50 text-teal-700 border-teal-200" : "text-neutral-500 border-neutral-200 hover:bg-neutral-50"
                    }`}
                  >
                    {dept}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {pending && (
          <ConfirmChainChange
            message={pending.message}
            confirming={saving}
            onConfirm={handleConfirm}
            onCancel={() => setPending(null)}
          />
        )}
      </div>
    </motion.div>
  );
}
