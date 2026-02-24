// CompanyDrawer.tsx
import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CompanyChip } from "./ui";
import { Client, CompanyData, DBTask, Product, Role, TASK_WEIGHT, isFounder } from "./types";
import { saveClient, saveProduct } from "./useDatabase";
import { supabase } from "./supabase";

function calcProgress(companyName: string, tasks: DBTask[]) {
  const relevant = tasks.filter(
    (t) => t.company_name === companyName && t.status !== "archived"
  );
  if (relevant.length === 0) return 100;
  let total = 0;
  let completed = 0;
  relevant.forEach((t) => {
    total += TASK_WEIGHT[t.impact];
    if (t.status === "completed") completed += TASK_WEIGHT[t.impact];
  });
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

export function CompanyDrawer({
  isOpen,
  onClose,
  role,
  company,
  tasks,
  clients,
  products,
  onRefetch,
  onAddTask,
}: {
  isOpen: boolean;
  onClose: () => void;
  role: Role;
  company: CompanyData | null;
  tasks: DBTask[];
  clients: Client[];
  products: Product[];
  onRefetch?: () => void;
  onAddTask?: (companyName: string) => void;
}) {
  const founder = isFounder(role);
  const companyName = company?.name || "";
  const progress = useMemo(() => (companyName ? calcProgress(companyName, tasks) : 0), [companyName, tasks]);

  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);

  // Client form state
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientScope, setNewClientScope] = useState("");
  const [newClientDeadline, setNewClientDeadline] = useState("");
  const [newClientLinks, setNewClientLinks] = useState<{ name: string; url: string }[]>([]);
  const [clientPhotoFile, setClientPhotoFile] = useState<File | null>(null);
  const [clientSaving, setClientSaving] = useState(false);

  // Product form state
  const [newProductName, setNewProductName] = useState("");
  const [newProductDesc, setNewProductDesc] = useState("");
  const [newProductSku, setNewProductSku] = useState("");
  const [newProductEtsy, setNewProductEtsy] = useState("");
  const [productPhotoFile, setProductPhotoFile] = useState<File | null>(null);
  const [productSaving, setProductSaving] = useState(false);

  async function uploadPhoto(file: File): Promise<string | null> {
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage
      .from("task-photos")
      .upload(path, file, { contentType: file.type });
    if (error || !data) return null;
    const { data: { publicUrl } } = supabase.storage.from("task-photos").getPublicUrl(data.path);
    return publicUrl;
  }

  async function handleSaveClient() {
    if (!company?.id || !newClientName.trim()) return;
    setClientSaving(true);
    const photo_url = clientPhotoFile ? await uploadPhoto(clientPhotoFile) : null;
    const filteredLinks = newClientLinks.filter((l) => l.name.trim() && l.url.trim());
    await saveClient({
      company_id: company.id,
      name: newClientName.trim(),
      contact_email: newClientEmail.trim() || null,
      contact_phone: newClientPhone.trim() || null,
      scope: newClientScope.trim() || null,
      deadline: newClientDeadline || null,
      quick_links: filteredLinks.length > 0 ? filteredLinks : null,
      ...(photo_url ? { photo_url } : {}),
    } as any);
    setNewClientName(""); setNewClientEmail(""); setNewClientPhone("");
    setNewClientScope(""); setNewClientDeadline(""); setNewClientLinks([]); setClientPhotoFile(null);
    setClientSaving(false);
    setShowAddClient(false);
    onRefetch?.();
  }

  async function handleSaveProduct() {
    if (!company?.id || !newProductName.trim()) return;
    setProductSaving(true);
    const photo_url = productPhotoFile ? await uploadPhoto(productPhotoFile) : null;
    await saveProduct({
      company_id: company.id,
      name: newProductName.trim(),
      description: newProductDesc.trim() || null,
      sku: newProductSku.trim() || null,
      etsy_link: newProductEtsy.trim() || null,
      ...(photo_url ? { photo_url } : {}),
    } as any);
    setNewProductName(""); setNewProductDesc(""); setNewProductSku("");
    setNewProductEtsy(""); setProductPhotoFile(null);
    setProductSaving(false);
    setShowAddProduct(false);
    onRefetch?.();
  }

  return (
    <AnimatePresence>
      {isOpen && company && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/30 z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed right-0 top-0 bottom-0 w-[540px] max-w-[92vw] bg-white z-50 border-l shadow-2xl flex flex-col"
            initial={{ x: 580 }} animate={{ x: 0 }} exit={{ x: 580 }}
            transition={{ type: "tween", duration: 0.25 }}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-semibold truncate">{company.name}</h2>
                  <CompanyChip name={company.name} />
                </div>
                {company.description && (
                  <p className="text-sm text-neutral-600 mt-1 line-clamp-2">{company.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {founder && onAddTask && (
                  <button
                    onClick={() => onAddTask(companyName)}
                    className="text-xs bg-teal-600 text-white rounded-xl px-3 py-1.5 hover:bg-teal-700 font-medium"
                  >
                    + Add Task
                  </button>
                )}
                <button onClick={onClose} className="text-neutral-500 hover:text-neutral-900 text-xl leading-none">×</button>
              </div>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto flex-1">
              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">Company Progress</div>
                  <div className="text-xs text-neutral-500">{progress}%</div>
                </div>
                <div className="h-2 rounded-full bg-teal-100 overflow-hidden">
                  <motion.div
                    className="h-full bg-teal-600"
                    initial={false}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                  />
                </div>
              </div>

              {/* Clients */}
              <Card title="Clients" subtitle="Projects & accounts" className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-neutral-500">{clients.length} total</div>
                  {founder && (
                    <button
                      onClick={() => setShowAddClient(true)}
                      className="text-xs bg-teal-600 text-white rounded-xl px-3 py-1.5 hover:bg-teal-700 font-medium"
                    >
                      + Add Client
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {clients.slice(0, 8).map((c) => (
                    <div key={c.id} className="rounded-xl border p-3 bg-white">
                      <div className="flex items-start gap-3">
                        {c.photo_url && (
                          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0"
                            style={{ backgroundImage: `url(${c.photo_url})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium">{c.name}</div>
                          {c.scope && <div className="text-xs text-neutral-500 mt-0.5">{c.scope}</div>}
                          <div className="flex flex-wrap gap-2 mt-1">
                            {c.contact_email && <span className="text-[10px] text-neutral-400">{c.contact_email}</span>}
                            {c.contact_phone && <span className="text-[10px] text-neutral-400">{c.contact_phone}</span>}
                            {c.deadline && (
                              <span className="text-[10px] text-teal-600 font-medium">
                                Due {new Date(c.deadline).toLocaleDateString([], { month: "short", day: "numeric" })}
                              </span>
                            )}
                          </div>
                          {c.quick_links && c.quick_links.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {c.quick_links.map((link: { name: string; url: string }, i: number) => (
                                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100">
                                  {link.name} →
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {clients.length === 0 && <div className="text-xs text-neutral-500">No clients yet.</div>}
                </div>
              </Card>

              {/* Products */}
              <Card title="Products" subtitle="Offers & SKUs" className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-neutral-500">{products.length} total</div>
                  {founder && (
                    <button
                      onClick={() => setShowAddProduct(true)}
                      className="text-xs bg-teal-600 text-white rounded-xl px-3 py-1.5 hover:bg-teal-700 font-medium"
                    >
                      + Add Product
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {products.slice(0, 8).map((p) => (
                    <div key={p.id} className="rounded-xl border p-3 bg-white">
                      <div className="flex items-start gap-3">
                        {p.photo_url && (
                          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0"
                            style={{ backgroundImage: `url(${p.photo_url})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium">{p.name}</div>
                          {p.description && <div className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{p.description}</div>}
                          <div className="flex flex-wrap gap-2 mt-1">
                            {p.sku && <span className="text-[10px] text-neutral-400">SKU: {p.sku}</span>}
                            {p.etsy_link && (
                              <a href={p.etsy_link} target="_blank" rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-[10px] text-teal-600 hover:underline">Etsy →</a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {products.length === 0 && <div className="text-xs text-neutral-500">No products yet.</div>}
                </div>
              </Card>
            </div>

            {/* Add Client modal */}
            <AnimatePresence>
              {showAddClient && (
                <motion.div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="absolute inset-0 bg-black/40" onClick={() => setShowAddClient(false)} />
                  <motion.div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl p-5 max-h-[90vh] overflow-y-auto"
                    initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="font-semibold">Add Client</div>
                      <button onClick={() => setShowAddClient(false)} className="text-neutral-500 text-xl leading-none">×</button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-neutral-600">Client name *</label>
                        <input value={newClientName} onChange={(e) => setNewClientName(e.target.value)}
                          className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
                          placeholder="Acme Co" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-neutral-600">What we're doing for them</label>
                        <textarea value={newClientScope} onChange={(e) => setNewClientScope(e.target.value)}
                          className="w-full mt-1 rounded-xl border px-3 py-2 text-sm min-h-[72px] focus:ring-2 focus:ring-teal-200 outline-none resize-none"
                          placeholder="e.g. Monthly social media management, content creation…" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-neutral-600">Contact email</label>
                          <input value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)}
                            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
                            placeholder="name@company.com" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-neutral-600">Contact phone</label>
                          <input value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)}
                            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
                            placeholder="(555) 000-0000" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-neutral-600">Project / due date</label>
                        <input type="date" value={newClientDeadline} onChange={(e) => setNewClientDeadline(e.target.value)}
                          className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-neutral-600">Quick Links</label>
                        <div className="mt-1 space-y-2">
                          {newClientLinks.map((link, i) => (
                            <div key={i} className="flex gap-2 items-center">
                              <input value={link.name} onChange={(e) => setNewClientLinks((ls) => ls.map((l, j) => j === i ? { ...l, name: e.target.value } : l))}
                                placeholder="Label (e.g. Notion)"
                                className="w-28 rounded-lg border px-2 py-1.5 text-xs focus:ring-2 focus:ring-teal-200 outline-none" />
                              <input value={link.url} onChange={(e) => setNewClientLinks((ls) => ls.map((l, j) => j === i ? { ...l, url: e.target.value } : l))}
                                placeholder="https://..."
                                className="flex-1 rounded-lg border px-2 py-1.5 text-xs focus:ring-2 focus:ring-teal-200 outline-none" />
                              <button onClick={() => setNewClientLinks((ls) => ls.filter((_, j) => j !== i))}
                                className="text-neutral-400 hover:text-red-500 text-sm leading-none">✕</button>
                            </div>
                          ))}
                          {newClientLinks.length < 4 && (
                            <button onClick={() => setNewClientLinks((ls) => [...ls, { name: "", url: "" }])}
                              className="text-xs text-teal-600 hover:text-teal-800">+ Add link</button>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-neutral-600">Photo</label>
                        <label className="mt-1 flex items-center gap-2 cursor-pointer rounded-xl border border-dashed px-3 py-2 hover:border-teal-300 transition-colors">
                          <span className="text-sm text-neutral-400 truncate">{clientPhotoFile ? clientPhotoFile.name : "Choose image..."}</span>
                          <input type="file" accept="image/*" className="hidden"
                            onChange={(e) => setClientPhotoFile(e.target.files?.[0] || null)} />
                        </label>
                      </div>
                      <div className="flex gap-2 pt-2 border-t">
                        <button onClick={() => { setShowAddClient(false); setClientPhotoFile(null); }}
                          className="px-4 py-2 border rounded-xl hover:bg-neutral-50 text-sm">Cancel</button>
                        <button onClick={handleSaveClient} disabled={!newClientName.trim() || clientSaving}
                          className="flex-1 bg-teal-600 text-white rounded-xl px-4 py-2 hover:bg-teal-700 font-medium text-sm disabled:opacity-50">
                          {clientSaving ? "Saving..." : "Add Client"}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Add Product modal */}
            <AnimatePresence>
              {showAddProduct && (
                <motion.div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="absolute inset-0 bg-black/40" onClick={() => setShowAddProduct(false)} />
                  <motion.div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl p-5 max-h-[90vh] overflow-y-auto"
                    initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="font-semibold">Add Product</div>
                      <button onClick={() => setShowAddProduct(false)} className="text-neutral-500 text-xl leading-none">×</button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-neutral-600">Product name *</label>
                        <input value={newProductName} onChange={(e) => setNewProductName(e.target.value)}
                          className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
                          placeholder="e.g. Wedding Bouquet Package" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-neutral-600">Description</label>
                        <textarea value={newProductDesc} onChange={(e) => setNewProductDesc(e.target.value)}
                          className="w-full mt-1 rounded-xl border px-3 py-2 text-sm min-h-[72px] focus:ring-2 focus:ring-teal-200 outline-none resize-none"
                          placeholder="What this product or offer includes…" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-neutral-600">SKU / ID</label>
                          <input value={newProductSku} onChange={(e) => setNewProductSku(e.target.value)}
                            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
                            placeholder="WED-BQ-001" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-neutral-600">Etsy link</label>
                          <input value={newProductEtsy} onChange={(e) => setNewProductEtsy(e.target.value)}
                            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
                            placeholder="https://etsy.com/listing/…" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-neutral-600">Photo</label>
                        <label className="mt-1 flex items-center gap-2 cursor-pointer rounded-xl border border-dashed px-3 py-2 hover:border-teal-300 transition-colors">
                          <span className="text-sm text-neutral-400 truncate">{productPhotoFile ? productPhotoFile.name : "Choose image..."}</span>
                          <input type="file" accept="image/*" className="hidden"
                            onChange={(e) => setProductPhotoFile(e.target.files?.[0] || null)} />
                        </label>
                      </div>
                      <div className="flex gap-2 pt-2 border-t">
                        <button onClick={() => { setShowAddProduct(false); setProductPhotoFile(null); }}
                          className="px-4 py-2 border rounded-xl hover:bg-neutral-50 text-sm">Cancel</button>
                        <button onClick={handleSaveProduct} disabled={!newProductName.trim() || productSaving}
                          className="flex-1 bg-teal-600 text-white rounded-xl px-4 py-2 hover:bg-teal-700 font-medium text-sm disabled:opacity-50">
                          {productSaving ? "Saving..." : "Add Product"}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
