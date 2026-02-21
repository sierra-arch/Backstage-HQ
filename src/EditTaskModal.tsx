// =====================================================
// EDIT TASK MODAL
// Add this component to your DashboardApp.tsx
// =====================================================

import React, { useState, useEffect } from "react";

interface EditTaskModalProps {
  task: DBTask | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  role: Role;
  userName: string;
  teamMembers?: { id: string; display_name: string | null }[];
}

function EditTaskModal({
  task,
  isOpen,
  onClose,
  onSaved,
  role,
  userName,
  teamMembers = [],
}: EditTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [company, setCompany] = useState("Prose Florals");
  const [assignee, setAssignee] = useState("");
  const [level, setLevel] = useState<"small" | "medium" | "large">("medium");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [status, setStatus] = useState<"focus" | "active" | "submitted" | "completed">("active");
  const [deadline, setDeadline] = useState("");

  // Load task data when modal opens
  useEffect(() => {
    if (task && isOpen) {
      setTitle(task.title);
      setDescription(task.description || "");
      setCompany(task.company_name || "Prose Florals");
      setAssignee(task.assignee_name || "");
      setLevel(task.impact);
      setPriority(task.priority);
      setStatus(task.status);
      setDeadline(task.due_date ? task.due_date.split("T")[0] : "");
    }
  }, [task, isOpen]);

  async function handleSave() {
    if (!task) return;

    const companyData = await getCompanyByName(company);
    const estimate = TIME_BY_LEVEL[level];

    // Find assignee profile by display name
    const assigneeProfile = teamMembers.find(
      (tm) => tm.display_name === assignee
    );

    await dbUpdateTask(task.id, {
      title,
      description,
      company_id: companyData?.id,
      assigned_to: assigneeProfile?.id,
      priority,
      impact: level,
      estimate_minutes: estimate,
      due_date: deadline || null,
      status,
    });

    onSaved();
    onClose();
  }

  if (!task) return null;

  // Team members can only assign to self or Founder
  const teamMemberNames = teamMembers.map((tm) => tm.display_name || "Unknown");
  const assignOptions = isFounder(role)
    ? ["", ...teamMemberNames]
    : [userName, "Founder"];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Task"
      size="medium"
    >
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-neutral-700">
            Task Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
            placeholder="Enter task title..."
          />
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700">
            Description *
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none resize-none"
            placeholder="Describe the task..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-700">
              Company *
            </label>
            <select
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
            >
              {COMPANIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700">
              Assign To *
            </label>
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
            >
              <option value="">Unassigned</option>
              {assignOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-700">
              Impact *
            </label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as any)}
              className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
            >
              <option value="small">Small (~{TIME_BY_LEVEL.small} min)</option>
              <option value="medium">Medium (~{TIME_BY_LEVEL.medium} min)</option>
              <option value="large">Large (~{TIME_BY_LEVEL.large} min)</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700">
              Priority *
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700">
              Status *
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
            >
              <option value="focus">Focus</option>
              <option value="active">Active</option>
              <option value="submitted">Submitted</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700">
            Deadline (Optional)
          </label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || !description.trim()}
            className="flex-1 rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </Modal>
  );
}

// =====================================================
// ADD EDIT BUTTON TO TASK CARDS
// =====================================================
// Add this inside your task card rendering:
/*
<button
  onClick={(e) => {
    e.stopPropagation();
    setSelectedTaskForEdit(task);
    setShowEditModal(true);
  }}
  className="p-1 rounded-lg hover:bg-neutral-100 transition-colors"
  title="Edit task"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
</button>
*/

// =====================================================
// ADD STATE & MODAL TO DashboardApp
// =====================================================
// Add these to your DashboardApp component:
/*
const [showEditModal, setShowEditModal] = useState(false);
const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<DBTask | null>(null);

// Add the modal at the bottom with your other modals:
<EditTaskModal
  task={selectedTaskForEdit}
  isOpen={showEditModal}
  onClose={() => {
    setShowEditModal(false);
    setSelectedTaskForEdit(null);
  }}
  onSaved={refetch}
  role={role}
  userName={userName}
  teamMembers={teamMembers}
/>
*/
