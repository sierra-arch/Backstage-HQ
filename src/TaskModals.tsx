// TaskModals.tsx
import React, { useState } from "react";
import { Modal } from "./Modal";
import { Avatar, CompanyChip } from "./ui";
import { DBTask, Role, TIME_BY_LEVEL, COMPANIES, isFounder } from "./types";
import { createTask as dbCreateTask, getCompanyByName } from "./useDatabase";

export function TaskModal({
  task,
  isOpen,
  onClose,
  onComplete,
  role,
}: {
  task: DBTask | null;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  role: Role;
}) {
  if (!task) return null;

  const buttonText = isFounder(role) ? "Mark Complete" : "Submit for Approval";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={task.title}
      size="medium"
      coverImage={task.photo_url || undefined}
    >
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-neutral-700">
            Description
          </label>
          <p className="text-sm text-neutral-600 mt-1">
            {task.description || "No description provided"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-700">
              Company
            </label>
            <div className="mt-1">
              <CompanyChip name={task.company_name || "Unknown"} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700">
              Assigned To
            </label>
            <div className="mt-1 flex items-center gap-2">
              <Avatar name={task.assignee_name || "Unassigned"} size={20} />
              <span className="text-sm text-neutral-600">
                {task.assignee_name || "Unassigned"}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-700">
              Priority
            </label>
            <p className="text-sm text-neutral-600 mt-1 capitalize">
              {task.priority}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700">
              Impact
            </label>
            <p className="text-sm text-neutral-600 mt-1 capitalize">
              {task.impact}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700">
              Estimate
            </label>
            <p className="text-sm text-neutral-600 mt-1">
              {task.estimate_minutes} min
            </p>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button
            onClick={() => {
              onComplete();
              onClose();
            }}
            className="flex-1 bg-teal-600 text-white rounded-xl px-4 py-2 hover:bg-teal-700 font-medium"
          >
            {buttonText}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-xl hover:bg-neutral-50"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function TaskCreateModal({
  isOpen,
  onClose,
  onCreated,
  role,
  userName,
  teamMembers = [],
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  role: Role;
  userName: string;
  teamMembers?: { id: string; display_name: string | null }[];
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [company, setCompany] = useState(COMPANIES[0]);
  const [assignee, setAssignee] = useState(isFounder(role) ? "" : userName);
  const [level, setLevel] = useState<"small" | "medium" | "large">("medium");
  const [deadline, setDeadline] = useState("");

  async function handleCreate() {
    const companyData = await getCompanyByName(company);
    const estimate = TIME_BY_LEVEL[level];

    await dbCreateTask({
      title,
      description,
      company_id: companyData?.id,
      status: "active",
      priority: "medium",
      impact: level,
      estimate_minutes: estimate,
      due_date: deadline || null,
    });

    setTitle("");
    setDescription("");
    setDeadline("");
    onCreated();
    onClose();
  }

  const teamMemberNames = teamMembers.map((tm) => tm.display_name || "Unknown");
  const assignOptions = isFounder(role)
    ? ["", ...teamMemberNames]
    : [userName, "Founder"];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Task" size="medium">
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
            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm min-h-[100px] focus:ring-2 focus:ring-teal-200 outline-none"
            placeholder="Add details..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-700">
              Company *
            </label>
            <select
              value={company}
              onChange={(e) => setCompany(e.target.value as any)}
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-700">
              Level *
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
              Deadline (Optional)
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button
            onClick={handleCreate}
            disabled={!title || !description}
            className="flex-1 bg-teal-600 text-white rounded-xl px-4 py-2 hover:bg-teal-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Task
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-xl hover:bg-neutral-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
