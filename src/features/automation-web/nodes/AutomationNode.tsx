import React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Automation } from "../types";
import { TRIGGER_LABELS, ACTION_LABELS, STATUS_LABELS } from "../types";

export interface AutomationNodeData extends Record<string, unknown> {
  automation: Automation;
  editable: boolean;
}

// Small hand-written icon set, matching this app's existing convention of
// inline SVGs rather than an icon library (none is installed -- see the
// Automation Web plan's note on why that's the deliberate choice here).
function NodeIcon({ icon }: { icon: string | null }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (icon === "check") {
    return (
      <svg {...common}>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }
  if (icon === "flag") {
    return (
      <svg {...common}>
        <path d="M4 21V4a1 1 0 0 1 1-1h13l-2 5 2 5H6a1 1 0 0 0-1 1v7" />
      </svg>
    );
  }
  // default: 'sparkles' and anything unrecognized
  return (
    <svg {...common}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" />
    </svg>
  );
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-teal-50 text-teal-700",
  waiting: "bg-neutral-100 text-neutral-600",
  paused: "bg-neutral-100 text-neutral-400",
};

export function AutomationNode({ data, selected }: NodeProps & { data: AutomationNodeData }) {
  const { automation, editable } = data;
  const title = automation.title || ACTION_LABELS[automation.action_type] || automation.action_type;
  const subtitle = automation.subtitle || TRIGGER_LABELS[automation.trigger_type] || automation.trigger_type;

  return (
    <div
      className={`rounded-2xl border bg-white px-4 py-3.5 w-[240px] shadow-sm transition-colors ${
        selected ? "border-teal-400 shadow-md" : "border-neutral-200/80"
      } ${editable ? "" : "opacity-70"}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-neutral-300 !border-none !w-2 !h-2" />
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-xl bg-sage-50 text-teal-700 p-2">
          <NodeIcon icon={automation.icon} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-800 truncate">{title}</p>
          <p className="text-xs text-neutral-400 truncate mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="mt-3">
        <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_STYLES[automation.status]}`}>
          {STATUS_LABELS[automation.status]}
        </span>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-neutral-300 !border-none !w-2 !h-2" />
    </div>
  );
}
