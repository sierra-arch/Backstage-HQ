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
function SOPModal({ sop, isOpen, onClose }: { sop: SOP | null; isOpen: boolean; onClose: () => void }) {
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
            <label className="text-sm font-medium text-neutral-700">Full Description</label>
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
      </div>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Create SOP Modal
   ────────────────────────────────────────────────────────────────── */
function CreateSOPModal({ isOpen, onClose, onCreated }: { isOpen: boolean; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [shortDesc, setShortDesc] = useState("");
  const [fullDesc, setFullDesc] = useState("");
  const [company, setCompany] = useState("");
  const [roleContext, setRoleContext] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!title.trim()) return;
    setSaving(true);
    await saveSOP({
      title,
      short_description: shortDesc || null,
      full_description: fullDesc || null,
      role_context: roleContext || null,
      company_id: null,
      instructions: null,
      tags: null,
      is_active: true,
      task_count: 0,
    });
    setSaving(false);
    setTitle(""); setShortDesc(""); setFullDesc(""); setCompany(""); setRoleContext("");
    onCreated();
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Playbook Entry" size="medium">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-neutral-700">Title *</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Client Onboarding Process"
            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none" />
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700">Overview</label>
          <input type="text" value={shortDesc} onChange={(e) => setShortDesc(e.target.value)}
            placeholder="One-line summary"
            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none" />
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700">Role Context</label>
          <input type="text" value={roleContext} onChange={(e) => setRoleContext(e.target.value)}
            placeholder="Who this is for (e.g. Team, Founder)"
            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none" />
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700">Full Content</label>
          <textarea value={fullDesc} onChange={(e) => setFullDesc(e.target.value)}
            placeholder="Full SOP content, steps, notes..."
            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm min-h-[120px] focus:ring-2 focus:ring-teal-200 outline-none" />
        </div>
        <div className="flex gap-3 pt-4 border-t">
          <button onClick={handleCreate} disabled={!title.trim() || saving}
            className="flex-1 bg-teal-600 text-white rounded-xl px-4 py-2 hover:bg-teal-700 font-medium text-sm disabled:opacity-50">
            {saving ? "Saving..." : "Create Entry"}
          </button>
          <button onClick={onClose} className="px-4 py-2 border rounded-xl hover:bg-neutral-50 text-sm">Cancel</button>
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
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCompany, setFilterCompany] = useState("all");

  const filtered = sops.filter((s) => {
    const matchSearch = s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.short_description?.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  return (
    <div className="space-y-4">
      <Card title="Playbook" subtitle="SOPs and guides for your team">
        <div className="flex items-center gap-3 mb-4">
          <input
            placeholder="Search playbook..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
          />
          {isFounder(role) && (
            <button onClick={() => setShowCreate(true)}
              className="rounded-full border-2 border-teal-600 bg-white text-teal-600 px-4 py-2 hover:bg-teal-50 text-sm font-medium flex-shrink-0">
              NEW
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-sm text-neutral-500 text-center py-8">Loading playbook...</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-neutral-500 text-center py-8">
            {sops.length === 0 ? "No entries yet — add your first SOP!" : "No results for that search."}
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
                  <div className="mt-2 text-[11px] text-neutral-500">{sop.role_context}</div>
                )}
                {sop.tags && sop.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {sop.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-500">{tag}</span>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      <SOPModal sop={selectedSOP} isOpen={!!selectedSOP} onClose={() => setSelectedSOP(null)} />

      <AnimatePresence>
        {showCreate && (
          <CreateSOPModal isOpen={showCreate} onClose={() => setShowCreate(false)} onCreated={refetch} />
        )}
      </AnimatePresence>
    </div>
  );
}
