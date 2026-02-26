// PlaybookPage.tsx - SOPs and guides
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSOPs, saveSOP, SOP } from "./useDatabase";
import { Card, CompanyChip } from "./ui";
import { COMPANIES, Role, isFounder } from "./types";
import { Modal } from "./TaskModals";

/* ──────────────────────────────────────────────────────────────────
   SOP Detail Modal
   ────────────────────────────────────────────────────────────────── */
function SOPModal({
  sop, isOpen, onClose, role, onEdit,
}: {
  sop: SOP | null; isOpen: boolean; onClose: () => void; role: Role; onEdit: () => void;
}) {
  if (!sop) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={sop.title} size="large">
      <div className="space-y-5">
        {sop.role_context && (
          <div className="bg-teal-50 rounded-xl p-3 text-sm text-teal-800 border border-teal-200">
            {sop.role_context}
          </div>
        )}
        {sop.short_description && (
          <div>
            <label className="text-sm font-medium text-neutral-700">Overview</label>
            <p className="text-sm text-neutral-600 mt-1">{sop.short_description}</p>
          </div>
        )}
        {sop.instructions && sop.instructions.length > 0 && (
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-3 block">Steps</label>
            <div className="space-y-3">
              {sop.instructions.map((step) => (
                <div key={step.step} className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-teal-600 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    {step.step}
                  </div>
                  <p className="text-sm text-neutral-700">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {sop.full_description && (
          <div>
            <label className="text-sm font-medium text-neutral-700">Notes</label>
            <p className="text-sm text-neutral-600 mt-1 whitespace-pre-wrap">{sop.full_description}</p>
          </div>
        )}
        {sop.tags && sop.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {sop.tags.map((tag) => (
              <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">{tag}</span>
            ))}
          </div>
        )}
        {isFounder(role) && (
          <div className="pt-4 border-t">
            <button onClick={onEdit}
              className="w-full border rounded-xl py-2 text-sm hover:bg-neutral-50 font-medium">
              Edit Entry
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Create / Edit SOP Modal
   ────────────────────────────────────────────────────────────────── */
function SOPFormModal({
  isOpen, onClose, onSaved, existing,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing?: SOP | null;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [shortDesc, setShortDesc] = useState(existing?.short_description ?? "");
  const [fullDesc, setFullDesc] = useState(existing?.full_description ?? "");
  const [roleContext, setRoleContext] = useState(existing?.role_context ?? "");
  const [steps, setSteps] = useState<string[]>(
    existing?.instructions?.map((s) => s.text) ?? [""]
  );
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function addStep() { setSteps((s) => [...s, ""]); }
  function removeStep(i: number) { setSteps((s) => s.filter((_, idx) => idx !== i)); }
  function updateStep(i: number, val: string) {
    setSteps((s) => { const n = [...s]; n[i] = val; return n; });
  }

  function addTag(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const t = tagInput.trim().toLowerCase();
      if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
      setTagInput("");
    }
  }
  function removeTag(t: string) { setTags((prev) => prev.filter((x) => x !== t)); }

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    setSaveError(null);
    const instructions = steps
      .filter((s) => s.trim())
      .map((text, i) => ({ step: i + 1, text }));
    try {
      await saveSOP({
        id: existing?.id,
        title,
        short_description: shortDesc || null,
        full_description: fullDesc || null,
        role_context: roleContext || null,
        instructions: instructions.length > 0 ? instructions : null,
        tags: tags.length > 0 ? tags : null,
        is_active: true,
        task_count: existing?.task_count ?? 0,
        company_id: existing?.company_id ?? null,
      });
      setSaving(false);
      onSaved();
      onClose();
    } catch (err: any) {
      setSaving(false);
      setSaveError(err?.message ?? "Failed to save — check the browser console.");
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={existing ? "Edit Entry" : "New Playbook Entry"} size="large">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-neutral-700">Title *</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Client Onboarding Process"
            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none" />
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700">One-line overview</label>
          <input type="text" value={shortDesc} onChange={(e) => setShortDesc(e.target.value)}
            placeholder="Quick summary visible on the card"
            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none" />
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700">Who this is for</label>
          <input type="text" value={roleContext} onChange={(e) => setRoleContext(e.target.value)}
            placeholder="e.g. All team members, Founder only, New hires"
            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none" />
        </div>

        {/* Step builder */}
        <div>
          <label className="text-sm font-medium text-neutral-700 mb-2 block">Steps</label>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="w-6 h-6 rounded-full bg-teal-600 text-white text-xs flex items-center justify-center flex-shrink-0 mt-2">
                  {i + 1}
                </div>
                <input
                  value={step}
                  onChange={(e) => updateStep(i, e.target.value)}
                  placeholder={`Step ${i + 1}...`}
                  className="flex-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
                />
                {steps.length > 1 && (
                  <button onClick={() => removeStep(i)}
                    className="text-neutral-400 hover:text-red-500 text-lg leading-none mt-1.5 px-1">
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <button onClick={addStep}
            className="mt-2 text-xs text-teal-600 hover:text-teal-800 font-medium flex items-center gap-1">
            + Add step
          </button>
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700">Notes / Full content</label>
          <textarea value={fullDesc} onChange={(e) => setFullDesc(e.target.value)}
            placeholder="Additional context, tips, links..."
            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm min-h-[80px] focus:ring-2 focus:ring-teal-200 outline-none resize-none" />
        </div>

        {/* Tags */}
        <div>
          <label className="text-sm font-medium text-neutral-700">Tags</label>
          <div className="mt-1 flex flex-wrap gap-1.5 rounded-xl border px-3 py-2 focus-within:ring-2 focus-within:ring-teal-200 bg-white min-h-[38px]">
            {tags.map((t) => (
              <span key={t} className="flex items-center gap-1 text-[11px] bg-teal-50 text-teal-800 border border-teal-200 rounded-full px-2 py-0.5">
                {t}
                <button onClick={() => removeTag(t)} className="text-teal-400 hover:text-teal-700 leading-none">×</button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={addTag}
              placeholder={tags.length === 0 ? "Type a tag and press Enter..." : ""}
              className="flex-1 min-w-[120px] outline-none text-sm bg-transparent"
            />
          </div>
          <p className="text-xs text-neutral-400 mt-1">Press Enter or comma to add a tag</p>
        </div>

        {saveError && (
          <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
            {saveError}
          </div>
        )}
        <div className="flex gap-3 pt-4 border-t">
          <button onClick={onClose} className="px-4 py-2 border rounded-xl hover:bg-neutral-50 text-sm">Cancel</button>
          <button onClick={handleSave} disabled={!title.trim() || saving}
            className="flex-1 bg-teal-600 text-white rounded-xl px-4 py-2 hover:bg-teal-700 font-medium text-sm disabled:opacity-50">
            {saving ? "Saving..." : existing ? "Save Changes" : "Create Entry"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Playbook Page
   ────────────────────────────────────────────────────────────────── */
export function PlaybookPage({ role }: { role: Role }) {
  const { sops, loading, refetch } = useSOPs();
  const [selectedSOP, setSelectedSOP] = useState<SOP | null>(null);
  const [editingSOP, setEditingSOP] = useState<SOP | null | undefined>(undefined);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = sops.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.short_description?.toLowerCase().includes(search.toLowerCase()) ||
    s.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <Card title="Playbooks" subtitle="SOPs and guides for your team">
        <div className="flex items-center gap-3 mb-4">
          <input
            placeholder="Search by title, description, or tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
          />
          {isFounder(role) && (
            <button onClick={() => setShowCreate(true)}
              className="rounded-full border-2 border-teal-600 bg-white text-teal-600 px-4 py-2 hover:bg-teal-50 text-sm font-medium flex-shrink-0">
              + New Entry
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-sm text-neutral-500 text-center py-8">Loading playbook...</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-neutral-500 text-center py-8">
            {sops.length === 0
              ? "No entries yet — founders can add SOPs and guides for the team."
              : "No results for that search."}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((sop) => (
              <motion.div
                key={sop.id}
                layout
                onClick={() => setSelectedSOP(sop)}
                className="rounded-xl border p-4 bg-white cursor-pointer hover:border-teal-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{sop.title}</div>
                    {sop.short_description && (
                      <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{sop.short_description}</p>
                    )}
                  </div>
                  {sop.instructions && sop.instructions.length > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 flex-shrink-0">
                      {sop.instructions.length} steps
                    </span>
                  )}
                </div>
                {sop.role_context && (
                  <div className="mt-2 text-[11px] text-neutral-500 italic">{sop.role_context}</div>
                )}
                {sop.tags && sop.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {sop.tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-500">{tag}</span>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      {/* View modal */}
      <SOPModal
        sop={selectedSOP}
        isOpen={!!selectedSOP}
        onClose={() => setSelectedSOP(null)}
        role={role}
        onEdit={() => { setEditingSOP(selectedSOP); setSelectedSOP(null); }}
      />

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <SOPFormModal
            isOpen={showCreate}
            onClose={() => setShowCreate(false)}
            onSaved={refetch}
          />
        )}
      </AnimatePresence>

      {/* Edit modal */}
      <AnimatePresence>
        {editingSOP !== undefined && (
          <SOPFormModal
            isOpen={editingSOP !== undefined}
            onClose={() => setEditingSOP(undefined)}
            onSaved={refetch}
            existing={editingSOP}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
