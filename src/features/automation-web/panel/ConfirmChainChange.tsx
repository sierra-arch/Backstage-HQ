import React from "react";

// The inline confirm step for anything that changes what a chain does
// (toggling active/paused, adding/removing a connection) -- per the
// Automation Web spec's Section 4, this replaces a heavier multi-screen
// Preview/Explanation/Decision flow because these changes are reversible
// and always visible in the UI, never silent. Repositioning a node for
// layout doesn't go through this at all -- it saves immediately.
export function ConfirmChainChange({
  message,
  onConfirm,
  onCancel,
  confirming,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirming: boolean;
}) {
  return (
    <div className="rounded-2xl border-2 p-4 bg-[#F3F7F1]" style={{ borderColor: "#0F766E" }}>
      <p className="text-sm text-neutral-700">{message}</p>
      <div className="flex gap-3 mt-3">
        <button
          onClick={onConfirm}
          disabled={confirming}
          className="text-xs font-medium text-teal-700 hover:underline disabled:opacity-50"
        >
          {confirming ? "Saving…" : "Confirm"}
        </button>
        <button onClick={onCancel} disabled={confirming} className="text-xs font-medium text-neutral-400 hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
}
