// TaskModals.tsx - All modal components
import React, { useState } from "react";
import { motion } from "framer-motion";
import { DBTask, Client, Product, COMPANIES, TIME_BY_LEVEL, isFounder, Role } from "./types";
import { createTask as dbCreateTask, getCompanyByName } from "./useDatabase";
import { supabase } from "./supabase";
import { CompanyChip, Avatar } from "./ui";

/* ──────────────────────────────────────────────────────────────────
   Base Modal
   ────────────────────────────────────────────────────────────────── */
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "large",
  coverImage,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "small" | "medium" | "large";
  coverImage?: string;
}) {
  if (!isOpen) return null;

  const sizeClasses = { small: "max-w-md", medium: "max-w-2xl", large: "max-w-4xl" };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={`bg-white rounded-2xl shadow-2xl ${sizeClasses[size]} w-full max-h-[90vh] overflow-auto`}
      >
        {coverImage && (
          <div
            className="h-48 bg-cover bg-center rounded-t-2xl"
            style={{ backgroundImage: `url(${coverImage})` }}
          />
        )}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-900 text-2xl leading-none">
            ×
          </button>
        </div>
        <div className="p-6">{children}</div>
      </motion.div>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Task Modal (view/complete)
   ────────────────────────────────────────────────────────────────── */
export function TaskModal({
  task,
  isOpen,
  onClose,
  onComplete,
  onReassign,
  role,
  teamMembers = [],
}: {
  task: DBTask | null;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  onReassign?: (taskId: string, memberId: string | null) => Promise<void>;
  role: Role;
  teamMembers?: { id: string; display_name: string | null }[];
}) {
  const [reassigning, setReassigning] = React.useState(false);

  if (!task) return null;

  const isDone = task.status === "completed" || task.status === "archived";
  const buttonText = isFounder(role) ? "Mark Complete" : "Submit for Approval";

  async function handleReassign(e: React.ChangeEvent<HTMLSelectElement>) {
    if (!onReassign) return;
    const memberId = e.target.value || null;
    setReassigning(true);
    await onReassign(task!.id, memberId);
    setReassigning(false);
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={task.title} size="medium" coverImage={task.photo_url || undefined}>
      <div className="space-y-4">
        {isDone && (
          <div className="flex items-center gap-2 text-sm text-neutral-500 bg-neutral-50 border rounded-xl px-4 py-2 capitalize">
            <span className="w-2 h-2 rounded-full bg-neutral-400 flex-shrink-0" />
            This task is {task.status}
          </div>
        )}
        <div>
          <label className="text-sm font-medium text-neutral-700">Description</label>
          <p className="text-sm text-neutral-600 mt-1">{task.description || "No description provided"}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-700">Company</label>
            <div className="mt-1"><CompanyChip name={task.company_name || "Unknown"} /></div>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700">Assigned To</label>
            {isFounder(role) && onReassign ? (
              <select
                defaultValue={task.assigned_to ?? ""}
                onChange={handleReassign}
                disabled={reassigning}
                className="mt-1 w-full rounded-xl border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-teal-200 disabled:opacity-50"
              >
                <option value="">Unassigned</option>
                {teamMembers.map((tm) => (
                  <option key={tm.id} value={tm.id}>{tm.display_name || "Unknown"}</option>
                ))}
              </select>
            ) : (
              <div className="mt-1 flex items-center gap-2">
                <Avatar name={task.assignee_name || "Unassigned"} size={20} />
                <span className="text-sm text-neutral-600">{task.assignee_name || "Unassigned"}</span>
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-700">Priority</label>
            <p className="text-sm text-neutral-600 mt-1 capitalize">{task.priority}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700">Impact</label>
            <p className="text-sm text-neutral-600 mt-1 capitalize">{task.impact}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700">Estimate</label>
            <p className="text-sm text-neutral-600 mt-1">{task.estimate_minutes} min</p>
          </div>
        </div>
        <div className="flex gap-3 pt-4 border-t">
          {!isDone && (
            <button
              onClick={() => { onComplete(); onClose(); }}
              className="flex-1 bg-teal-600 text-white rounded-xl px-4 py-2 hover:bg-teal-700 font-medium"
            >
              {buttonText}
            </button>
          )}
          <button onClick={onClose} className={`px-4 py-2 border rounded-xl hover:bg-neutral-50 ${isDone ? "flex-1" : ""}`}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Task Create Modal
   ────────────────────────────────────────────────────────────────── */
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
  const [company, setCompany] = useState("Prose Florals");
  const [assignee, setAssignee] = useState(isFounder(role) ? "" : userName);
  const [level, setLevel] = useState<"small" | "medium" | "large">("medium");
  const [deadline, setDeadline] = useState("");
  const [recurring, setRecurring] = useState<
    "none" | "daily" | "weekly" | "biweekly" | "monthly" | "quarterly"
  >("none");
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  async function handleCreate() {
    const companyData = await getCompanyByName(company);
    const estimate = TIME_BY_LEVEL[level];

    let photoUrl: string | null = null;
    if (photoFile) {
      const ext = photoFile.name.split(".").pop();
      const path = `${Date.now()}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("task-photos")
        .upload(path, photoFile, { contentType: photoFile.type });
      if (!uploadError && uploadData) {
        const { data: { publicUrl } } = supabase.storage
          .from("task-photos")
          .getPublicUrl(uploadData.path);
        photoUrl = publicUrl;
      }
    }

    // Resolve assignee display name → user ID
    const assignedMember = teamMembers.find((tm) => tm.display_name === assignee);
    const assignedToId = assignedMember?.id ?? null;

    await dbCreateTask({
      title,
      description,
      company_id: companyData?.id,
      assigned_to: assignedToId,
      status: "active",
      priority: "medium",
      impact: level,
      estimate_minutes: estimate,
      due_date: deadline || null,
      photo_url: photoUrl,
    });

    setTitle("");
    setDescription("");
    setDeadline("");
    setRecurring("none");
    setPhotoFile(null);
    onCreated();
    onClose();
  }

  const [showAdvanced, setShowAdvanced] = useState(false);
  const teamMemberNames = teamMembers.map((tm) => tm.display_name || "Unknown");
  const assignOptions = isFounder(role) ? ["", ...teamMemberNames] : [userName, "Founder"];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Task" size="small">
      <div className="space-y-3">

        {/* Title */}
        <input
          type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          autoFocus
          className="w-full rounded-xl border px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-teal-200 outline-none placeholder:text-neutral-400"
          placeholder="Task title..."
        />

        {/* Description */}
        <textarea
          value={description} onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-xl border px-3 py-2 text-sm min-h-[68px] focus:ring-2 focus:ring-teal-200 outline-none placeholder:text-neutral-400 resize-none"
          placeholder="Details... (optional)"
        />

        {/* Inline metadata chips */}
        <div className="flex flex-wrap gap-2">
          <select value={company} onChange={(e) => setCompany(e.target.value)}
            className="rounded-full border px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-teal-200 outline-none bg-white">
            {COMPANIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {isFounder(role) && (
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)}
              className="rounded-full border px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-teal-200 outline-none bg-white">
              <option value="">Unassigned</option>
              {assignOptions.map((t) => <option key={t} value={t}>{t || "Unassigned"}</option>)}
            </select>
          )}
          <select value={level} onChange={(e) => setLevel(e.target.value as any)}
            className="rounded-full border px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-teal-200 outline-none bg-white">
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
            className="rounded-full border px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-teal-200 outline-none bg-white text-neutral-500" />
        </div>

        {/* Advanced toggle */}
        <button type="button" onClick={() => setShowAdvanced((v) => !v)}
          className="text-xs text-neutral-400 hover:text-neutral-600 flex items-center gap-1">
          <span>{showAdvanced ? "▾" : "▸"}</span>
          {showAdvanced ? "Hide options" : "More options"}
        </button>

        {showAdvanced && (
          <div className="space-y-3 border-t pt-3">
            <div>
              <label className="text-xs font-medium text-neutral-500 mb-1 block">Recurring</label>
              <select value={recurring} onChange={(e) => setRecurring(e.target.value as any)}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none">
                <option value="none">None</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500 mb-1 block">Cover photo</label>
              <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-dashed px-3 py-2 hover:border-teal-300 transition-colors">
                <span className="text-sm text-neutral-400">{photoFile ? photoFile.name : "Choose image..."}</span>
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
              </label>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <button onClick={onClose} className="px-4 py-2 border rounded-xl hover:bg-neutral-50 text-sm">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={!title}
            className="flex-1 bg-teal-600 text-white rounded-xl px-4 py-2 hover:bg-teal-700 text-sm font-medium disabled:opacity-40">
            Create Task
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Client Modal (view-only)
   ────────────────────────────────────────────────────────────────── */
export function ClientModal({
  client,
  isOpen,
  onClose,
}: {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!client) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={client.name} size="large" coverImage={client.photo_url}>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-neutral-700">Description</label>
          <p className="text-sm text-neutral-600 mt-1">{client.description}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-700">Contact</label>
            <p className="text-sm text-neutral-600 mt-1">{client.contact}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700">Scope</label>
            <p className="text-sm text-neutral-600 mt-1">{client.scope}</p>
          </div>
        </div>
        {client.quick_links && client.quick_links.length > 0 && (
          <div>
            <label className="text-sm font-medium text-neutral-700">Quick Links</label>
            <div className="flex gap-2 mt-2">
              {client.quick_links.map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs bg-teal-50 text-teal-700 px-3 py-1.5 rounded-lg hover:bg-teal-100">
                  {link.name}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Product Modal (view-only)
   ────────────────────────────────────────────────────────────────── */
export function ProductModal({
  product,
  isOpen,
  onClose,
}: {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!product) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={product.name} size="large" coverImage={product.photo_url}>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-neutral-700">Description</label>
          <p className="text-sm text-neutral-600 mt-1">{product.description}</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-700">SKU</label>
            <p className="text-sm text-neutral-600 mt-1">{product.sku}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700">Active</label>
            <p className="text-sm text-neutral-600 mt-1">{product.months_active} months</p>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700">Added</label>
            <p className="text-sm text-neutral-600 mt-1">
              {product.date_added ? new Date(product.date_added).toLocaleDateString() : "—"}
            </p>
          </div>
        </div>
        {product.etsy_link && (
          <a href={product.etsy_link} target="_blank" rel="noopener noreferrer"
            className="inline-block bg-teal-600 text-white px-4 py-2 rounded-xl hover:bg-teal-700 text-sm font-medium">
            View on Etsy →
          </a>
        )}
      </div>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Add Accomplishment Modal
   ────────────────────────────────────────────────────────────────── */
export function AddAccomplishmentModal({
  isOpen,
  onClose,
  userName,
  onAdd,
}: {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  onAdd: (text: string, postToTeam: boolean) => void;
}) {
  const [text, setText] = useState("");
  const [postToTeam, setPostToTeam] = useState(false);

  function handleAdd() {
    if (!text.trim()) return;
    onAdd(text, postToTeam);
    setText("");
    setPostToTeam(false);
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Accomplishment" size="small">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-neutral-700">What did you accomplish?</label>
          <textarea value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Shipped Q3 client presentation..."
            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm min-h-[100px] focus:ring-2 focus:ring-teal-200 outline-none" />
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={postToTeam} onChange={(e) => setPostToTeam(e.target.checked)}
            className="w-4 h-4 accent-teal-600" />
          <span className="text-sm text-neutral-700">Post to Team Chat</span>
        </label>
        <div className="flex gap-3 pt-4 border-t">
          <button onClick={onClose} className="px-4 py-2 border rounded-xl hover:bg-neutral-50 text-sm">Cancel</button>
          <button onClick={handleAdd} disabled={!text.trim()}
            className="flex-1 bg-teal-600 text-white rounded-xl px-4 py-2 hover:bg-teal-700 font-medium text-sm disabled:opacity-50">
            Add
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Kudos Modal (Task Review: Archive with Thanks OR Return with Notes)
   ────────────────────────────────────────────────────────────────── */
export function KudosModal({
  isOpen,
  onClose,
  task,
  onSend,
}: {
  isOpen: boolean;
  onClose: () => void;
  task: DBTask | null;
  onSend: (action: "archive" | "return", message: string) => void;
}) {
  const [tab, setTab] = useState<"archive" | "return">("archive");
  const [message, setMessage] = useState("");

  function handleSend() {
    onSend(tab, message.trim());
    setMessage("");
    setTab("archive");
  }

  if (!task) return null;

  const isArchive = tab === "archive";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Review: ${task.title}`} size="medium">
      <div className="space-y-4">
        <div className="bg-neutral-50 rounded-xl px-4 py-3 border text-sm text-neutral-600">
          Submitted by <span className="font-medium text-neutral-900">@{task.assignee_name}</span>
        </div>

        {/* Tab toggle */}
        <div className="flex rounded-xl border overflow-hidden">
          <button
            onClick={() => { setTab("archive"); setMessage(""); }}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${isArchive ? "bg-teal-600 text-white" : "bg-white text-neutral-600 hover:bg-neutral-50"}`}>
            Archive ✓
          </button>
          <button
            onClick={() => { setTab("return"); setMessage(""); }}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors border-l ${!isArchive ? "bg-amber-500 text-white" : "bg-white text-neutral-600 hover:bg-neutral-50"}`}>
            Return with Notes
          </button>
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700 block mb-2">
            {isArchive
              ? `Send a note of gratitude to ${task.assignee_name}`
              : `Add instructions for ${task.assignee_name}`}
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={isArchive
              ? "Amazing work on this — really moved the needle on... (optional)"
              : "Please revisit the following before resubmitting... (optional)"}
            className="w-full rounded-xl border px-3 py-2 text-sm min-h-[100px] focus:ring-2 focus:ring-teal-200 outline-none"
          />
          <p className="text-xs text-neutral-400 mt-1">
            {isArchive
              ? message.trim() ? "Will be sent as a direct message." : "Skip to archive without a message."
              : message.trim() ? "Notes will appear on the task." : "Skip to reassign without notes."}
          </p>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button onClick={onClose} className="px-4 py-2 border rounded-xl hover:bg-neutral-50 text-sm">
            Cancel
          </button>
          <button
            onClick={handleSend}
            className={`flex-1 text-white rounded-xl px-4 py-2 font-medium text-sm ${isArchive ? "bg-teal-600 hover:bg-teal-700" : "bg-amber-500 hover:bg-amber-600"}`}>
            {isArchive
              ? message.trim() ? "Archive & Send Thanks" : "Archive"
              : message.trim() ? "Reassign with Notes" : "Reassign"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
