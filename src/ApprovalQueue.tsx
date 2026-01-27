// =====================================================
// FOUNDER APPROVAL QUEUE
// Component for founders to review and approve team changes
// Add this to your DashboardApp.tsx
// =====================================================

import React, { useState } from "react";
import { 
  usePendingApprovals, 
  approvePendingChange, 
  rejectPendingChange,
  PendingApproval 
} from "./useDatabase";

interface ApprovalQueueProps {
  isOpen: boolean;
  onClose: () => void;
}

function ApprovalQueue({ isOpen, onClose }: ApprovalQueueProps) {
  const { approvals, loading, refetch } = usePendingApprovals();
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState(false);

  async function handleApprove(approvalId: string) {
    setProcessing(true);
    const success = await approvePendingChange(approvalId);
    setProcessing(false);
    
    if (success) {
      alert("Change approved successfully!");
      refetch();
      setSelectedApproval(null);
    } else {
      alert("Failed to approve change. Please try again.");
    }
  }

  async function handleReject() {
    if (!selectedApproval) return;
    
    setProcessing(true);
    const success = await rejectPendingChange(selectedApproval.id, rejectionReason);
    setProcessing(false);
    
    if (success) {
      alert("Change rejected.");
      refetch();
      setSelectedApproval(null);
      setRejectionReason("");
    } else {
      alert("Failed to reject change. Please try again.");
    }
  }

  function getEntityLabel(type: string): string {
    const labels: Record<string, string> = {
      client: "Client",
      product: "Product",
      sop: "SOP",
      task: "Task",
      company: "Company",
    };
    return labels[type] || type;
  }

  function getActionLabel(action: string): string {
    const labels: Record<string, string> = {
      create: "Create",
      update: "Update",
      delete: "Delete",
    };
    return labels[action] || action;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pending Approvals" size="large">
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-neutral-500">Loading approvals...</div>
        ) : approvals.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">
            <div className="text-4xl mb-3">✓</div>
            <div>No pending approvals!</div>
          </div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            {approvals.map((approval) => (
              <div
                key={approval.id}
                className="border rounded-xl p-4 hover:shadow-md transition-shadow bg-white"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-medium">
                        {getEntityLabel(approval.entity_type)}
                      </span>
                      <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                        {getActionLabel(approval.action_type)}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-600">
                      Submitted: {new Date(approval.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedApproval(approval)}
                      className="px-3 py-1 rounded-lg border text-xs hover:bg-neutral-50"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => handleApprove(approval.id)}
                      disabled={processing}
                      className="px-3 py-1 rounded-lg bg-teal-600 text-white text-xs hover:bg-teal-700 disabled:opacity-50"
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => setSelectedApproval(approval)}
                      disabled={processing}
                      className="px-3 py-1 rounded-lg bg-red-50 text-red-600 text-xs hover:bg-red-100 disabled:opacity-50"
                    >
                      ✗ Reject
                    </button>
                  </div>
                </div>
                
                {/* Quick preview of changes */}
                <div className="text-xs text-neutral-500 bg-neutral-50 rounded-lg p-2">
                  <strong>Changes:</strong> {approval.change_data?.name || approval.change_data?.title || "View details for more info"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail/Rejection Modal */}
      <Modal
        isOpen={!!selectedApproval}
        onClose={() => {
          setSelectedApproval(null);
          setRejectionReason("");
        }}
        title="Approval Details"
        size="medium"
      >
        {selectedApproval && (
          <div className="space-y-4">
            <div className="border rounded-xl p-4 bg-neutral-50">
              <h4 className="font-semibold mb-2">Proposed Changes</h4>
              <pre className="text-xs overflow-auto max-h-60 p-3 bg-white rounded border">
                {JSON.stringify(selectedApproval.change_data, null, 2)}
              </pre>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700 block mb-2">
                Rejection Reason (optional)
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                className="w-full rounded-xl border px-3 py-2 text-sm resize-none"
                placeholder="Explain why this change is being rejected..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedApproval(null);
                  setRejectionReason("");
                }}
                className="flex-1 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleApprove(selectedApproval.id)}
                disabled={processing}
                className="flex-1 rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {processing ? "Processing..." : "Approve"}
              </button>
              <button
                onClick={handleReject}
                disabled={processing}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {processing ? "Processing..." : "Reject"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </Modal>
  );
}

// =====================================================
// APPROVAL BADGE (for sidebar)
// Shows count of pending approvals
// =====================================================
function ApprovalBadge() {
  const { approvals } = usePendingApprovals();
  const count = approvals.length;

  if (count === 0) return null;

  return (
    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-semibold">
      {count > 9 ? "9+" : count}
    </div>
  );
}

export { ApprovalQueue, ApprovalBadge };
