// TaskModals.tsx - All modal components
import React, { useState } from "react";
import { motion } from "framer-motion";
import { DBTask, Client, Product, COMPANIES, TIME_BY_LEVEL, isFounder, Role } from "./types";
import { createTask as dbCreateTask, getCompanyByName, sendMessage } from "./useDatabase";
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
   Task Modal (view/edit/complete)
   ────────────────────────────────────────────────────────────────── */
export function TaskModal({
  task,
  isOpen,
  onClose,
  onComplete,
  onReassign,
  onApprove,
  onSave,
  role,
  teamMembers = [],
}: {
  task: DBTask | null;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  onReassign?: (taskId: string, memberId: string | null) => Promise<void>;
  onApprove?: (task: DBTask) => void;
  onSave?: (taskId: string, updates: Partial<DBTask>) => Promise<void>;
  role: Role;
  teamMembers?: { id: string; display_name: string | null }[];
}) {
  const [reassigning, setReassigning] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState("");
  const [editDesc, setEditDesc] = React.useState("");
  const [editDue, setEditDue] = React.useState("");
  const [editImpact, setEditImpact] = React.useState<DBTask["impact"]>("medium");
  const [saving, setSaving] = React.useState(false);

  function startEdit() {
    setEditTitle(task!.title);
    setEditDesc(task!.description || "");
    setEditDue(task!.due_date ? task!.due_date.slice(0, 10) : "");
    setEditImpact(task!.impact);
    setEditing(true);
  }

  async function handleSave() {
    if (!task || !onSave) return;
    setSaving(true);
    await onSave(task.id, {
      title: editTitle.trim() || task.title,
      description: editDesc.trim() || null,
      due_date: editDue || null,
      impact: editImpact,
    });
    setSaving(false);
    setEditing(false);
    onClose();
  }

  if (!task) return null;

  const isDone = task.status === "completed" || task.status === "archived";
  const isSubmitted = task.status === "submitted";
  const buttonText = isFounder(role) ? "Mark Complete" : "Submit for Approval";

  async function handleReassign(e: React.ChangeEvent<HTMLSelectElement>) {
    if (!onReassign) return;
    const memberId = e.target.value || null;
    setReassigning(true);
    await onReassign(task!.id, memberId);
    setReassigning(false);
  }

  return (
    <Modal isOpen={isOpen} onClose={() => { setEditing(false); onClose(); }} title={editing ? "Edit Task" : task.title} size="medium" coverImage={!editing ? task.photo_url || undefined : undefined}>
      <div className="space-y-4">
        {editing ? (
          /* ── Edit Mode ── */
          <>
            <div>
              <label className="text-sm font-medium text-neutral-700">Title</label>
              <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-700">Description</label>
              <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                className="w-full mt-1 rounded-xl border px-3 py-2 text-sm min-h-[80px] focus:ring-2 focus:ring-teal-200 outline-none resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-neutral-700">Due Date</label>
                <input type="date" value={editDue} onChange={(e) => setEditDue(e.target.value)}
                  className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none" />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700">Impact</label>
                <select value={editImpact} onChange={(e) => setEditImpact(e.target.value as DBTask["impact"])}
                  className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none">
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-4 border-t">
              <button onClick={handleSave} disabled={saving || !editTitle.trim()}
                className="flex-1 bg-teal-600 text-white rounded-xl px-4 py-2 hover:bg-teal-700 font-medium disabled:opacity-50">
                {saving ? "Saving…" : "Save Changes"}
              </button>
              <button onClick={() => setEditing(false)} className="px-4 py-2 border rounded-xl hover:bg-neutral-50">Cancel</button>
            </div>
          </>
        ) : (
          /* ── View Mode ── */
          <>
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
                <label className="text-sm font-medium text-neutral-700">
                  {task.due_date ? "Due Date" : "Estimate"}
                </label>
                <p className="text-sm text-neutral-600 mt-1">
                  {task.due_date ? new Date(task.due_date).toLocaleDateString() : `${task.estimate_minutes} min`}
                </p>
              </div>
            </div>
            {task.metadata?.link && (
              <a href={task.metadata.link} target="_blank" rel="noopener noreferrer"
                className="text-sm text-teal-600 hover:text-teal-800 underline break-all">
                {task.metadata.link}
              </a>
            )}
            {task.metadata?.submission_notes && (
              <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 space-y-1">
                <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Completion Notes</p>
                <p className="text-sm text-teal-900 whitespace-pre-wrap">{task.metadata.submission_notes}</p>
              </div>
            )}
            <div className="flex gap-3 pt-4 border-t">
              {!isDone && isSubmitted && isFounder(role) && onApprove ? (
                <>
                  <button
                    onClick={() => { onApprove(task); onClose(); }}
                    className="flex-1 bg-teal-600 text-white rounded-xl px-4 py-2 hover:bg-teal-700 font-medium"
                  >
                    Review Submission
                  </button>
                  <button onClick={onClose} className="px-4 py-2 border rounded-xl hover:bg-neutral-50">Close</button>
                </>
              ) : !isDone ? (
                <>
                  <button
                    onClick={() => { onComplete(); onClose(); }}
                    className="flex-1 bg-teal-600 text-white rounded-xl px-4 py-2 hover:bg-teal-700 font-medium"
                  >
                    {buttonText}
              </button>
              <button onClick={onClose} className="px-4 py-2 border rounded-xl hover:bg-neutral-50">Close</button>
            </>
          ) : (
            <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-xl hover:bg-neutral-50">Close</button>
          )}
        </div>
        {isFounder(role) && onSave && !isDone && (
          <button
            onClick={startEdit}
            className="w-full text-center text-xs text-neutral-400 hover:text-teal-600 py-1 mt-1"
          >
            Edit task details
          </button>
        )}
        </>
      )}
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
  defaultCompany,
  clients = [],
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  role: Role;
  userName: string;
  teamMembers?: { id: string; display_name: string | null }[];
  defaultCompany?: string;
  clients?: Client[];
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [company, setCompany] = useState(defaultCompany || "Prose Florals");
  const [assignee, setAssignee] = useState(isFounder(role) ? "" : userName);
  const [level, setLevel] = useState<"small" | "medium" | "large">("medium");
  const [deadline, setDeadline] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [linkUrl, setLinkUrl] = useState("");
  const [recurring, setRecurring] = useState<
    "none" | "daily" | "weekly" | "biweekly" | "monthly" | "quarterly"
  >("none");
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Clients for the selected company
  const companyClients = clients.filter((c) => c.company_name === company);

  async function handleCreate() {
    setCreating(true);
    setCreateError(null);

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

    const result = await dbCreateTask({
      title,
      description,
      company_id: companyData?.id ?? null,
      assigned_to: assignedToId,
      status: "active",
      priority: "medium",
      impact: level,
      estimate_minutes: estimate,
      due_date: deadline || null,
      photo_url: photoUrl,
      client_id: clientId || null,
      metadata: (recurring !== "none" || linkUrl.trim()) ? { ...(recurring !== "none" ? { recurring } : {}), ...(linkUrl.trim() ? { link: linkUrl.trim() } : {}) } : null,
    });

    setCreating(false);

    if (!result) {
      setCreateError("Failed to create task. Check your connection and try again.");
      return;
    }

    if (assignedToId) {
      await sendMessage(`You've been assigned a new task: "${title}"`, assignedToId, false, result.id);
    }

    setTitle("");
    setDescription("");
    setDeadline("");
    setClientId("");
    setLinkUrl("");
    setRecurring("none");
    setPhotoFile(null);
    onCreated();
    onClose();
  }

  const [showAdvanced, setShowAdvanced] = useState(false);
  const teamMemberNames = teamMembers.map((tm) => tm.display_name || "Unknown");
  const assignOptions = isFounder(role) ? teamMemberNames : [userName, "Founder"];

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
          <select value={company} onChange={(e) => { setCompany(e.target.value); setClientId(""); }}
            className="rounded-full border px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-teal-200 outline-none bg-white">
            {COMPANIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {companyClients.length > 0 && (
            <select value={clientId} onChange={(e) => setClientId(e.target.value)}
              className="rounded-full border px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-teal-200 outline-none bg-white">
              <option value="">No client</option>
              {companyClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
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
              <label className="text-xs font-medium text-neutral-500 mb-1 block">Link</label>
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
              />
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
        {createError && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{createError}</p>
        )}
        <div className="flex gap-2 pt-2 border-t">
          <button onClick={onClose} className="px-4 py-2 border rounded-xl hover:bg-neutral-50 text-sm">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={!title || creating}
            className="flex-1 bg-teal-600 text-white rounded-xl px-4 py-2 hover:bg-teal-700 text-sm font-medium disabled:opacity-40">
            {creating ? "Creating..." : "Create Task"}
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
  onAdd: (text: string) => void;
}) {
  const [text, setText] = useState("");

  function handleAdd() {
    if (!text.trim()) return;
    onAdd(text);
    setText("");
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
        <p className="text-xs text-neutral-400">This will be shared with your team.</p>
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
   Submit Notes Modal (team member fills in what they did before submitting)
   ────────────────────────────────────────────────────────────────── */
export function SubmitNotesModal({
  isOpen,
  onClose,
  task,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  task: DBTask | null;
  onConfirm: (notes: string) => void;
}) {
  const [notes, setNotes] = useState("");

  function handleConfirm() {
    if (!notes.trim()) return;
    onConfirm(notes.trim());
    setNotes("");
  }

  function handleClose() {
    setNotes("");
    onClose();
  }

  if (!task) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Submit for Review" size="medium">
      <div className="space-y-4">
        <div className="bg-neutral-50 rounded-xl px-4 py-3 border text-sm text-neutral-700 font-medium">
          {task.title}
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700 block mb-1">
            Completion Notes <span className="text-red-500">*</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe what you did, any decisions made, or anything the founder should know..."
            className="w-full rounded-xl border px-3 py-2 text-sm min-h-[120px] focus:ring-2 focus:ring-teal-200 outline-none resize-none"
            autoFocus
          />
          <p className="text-xs text-neutral-400 mt-1">Required — these notes will be visible to the founder during review.</p>
        </div>
        <div className="flex gap-3 pt-4 border-t">
          <button onClick={handleClose} className="px-4 py-2 border rounded-xl hover:bg-neutral-50 text-sm">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!notes.trim()}
            className="flex-1 bg-teal-600 text-white rounded-xl px-4 py-2 hover:bg-teal-700 font-medium text-sm disabled:opacity-50"
          >
            Submit for Review
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

        {task.metadata?.submission_notes && (
          <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 space-y-1">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Team member's notes</p>
            <p className="text-sm text-teal-900 whitespace-pre-wrap">{task.metadata.submission_notes}</p>
          </div>
        )}

        {/* Tab toggle */}
        <div className="flex rounded-xl border overflow-hidden">
          <button
            onClick={() => { setTab("archive"); setMessage(""); }}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${isArchive ? "bg-yellow-400 text-yellow-900" : "bg-white text-neutral-600 hover:bg-neutral-50"}`}>
            Archive ✓
          </button>
          <button
            onClick={() => { setTab("return"); setMessage(""); }}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors border-l ${!isArchive ? "bg-teal-600 text-white" : "bg-white text-neutral-600 hover:bg-neutral-50"}`}>
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
            className={`flex-1 rounded-xl px-4 py-2 font-medium text-sm ${isArchive ? "bg-yellow-400 hover:bg-yellow-500 text-yellow-900" : "bg-teal-600 hover:bg-teal-700 text-white"}`}>
            {isArchive
              ? message.trim() ? "Archive & Send Thanks" : "Archive"
              : message.trim() ? "Reassign with Notes" : "Reassign"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Send Kudos Modal (standalone, no task required)
   ────────────────────────────────────────────────────────────────── */
export function SendKudosModal({
  isOpen,
  onClose,
  teamMembers,
  onSend,
  defaultMemberId,
}: {
  isOpen: boolean;
  onClose: () => void;
  teamMembers: { id: string; display_name: string | null }[];
  onSend: (toUserId: string, message: string) => void;
  defaultMemberId?: string;
}) {
  const [selectedId, setSelectedId] = useState(defaultMemberId ?? "");
  const [message, setMessage] = useState("");

  function handleSend() {
    if (!selectedId || !message.trim()) return;
    onSend(selectedId, message.trim());
    setSelectedId("");
    setMessage("");
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Send Kudos" size="small">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-neutral-700 block mb-1">Who deserves a shout-out?</label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded-xl border px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
          >
            <option value="">Select a teammate…</option>
            {teamMembers.map((tm) => (
              <option key={tm.id} value={tm.id}>{tm.display_name || "Unknown"}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700 block mb-1">Your message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Huge shout-out for crushing it on…"
            className="w-full rounded-xl border px-3 py-2 text-sm min-h-[100px] focus:ring-2 focus:ring-teal-200 outline-none"
          />
        </div>
        <div className="flex gap-3 pt-4 border-t">
          <button onClick={onClose} className="px-4 py-2 border rounded-xl hover:bg-neutral-50 text-sm">Cancel</button>
          <button
            onClick={handleSend}
            disabled={!selectedId || !message.trim()}
            className="flex-1 bg-yellow-500 text-white rounded-xl px-4 py-2 hover:bg-yellow-600 font-medium text-sm disabled:opacity-50"
          >
            Send Kudos 🏆
          </button>
        </div>
      </div>
    </Modal>
  );
}
