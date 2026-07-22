// CompanyDrawer.tsx
import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, Avatar, CompanyChip } from "./ui";
import { Client, CompanyData, DBTask, Product, Role, TASK_WEIGHT, isFounder } from "./types";
import { saveClient, saveProduct } from "./useDatabase";

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
  onRefetch, // optional: trigger parent refetch
}: {
  isOpen: boolean;
  onClose: () => void;
  role: Role;
  company: CompanyData | null;
  tasks: DBTask[];
  clients: Client[];
  products: Product[];
  onRefetch?: () => void;
}) {
  const founder = isFounder(role);

  const companyName = company?.name || "";
  const progress = useMemo(() => (companyName ? calcProgress(companyName, tasks) : 0), [companyName, tasks]);

  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);

  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");

  const [newProductName, setNewProductName] = useState("");
  const [newProductDesc, setNewProductDesc] = useState("");

  async function handleSaveClient() {
    if (!company?.id || !newClientName.trim()) return;
    await saveClient({
      company_id: company.id,
      name: newClientName.trim(),
      contact_email: newClientEmail.trim() || null,
    } as any);
    setNewClientName("");
    setNewClientEmail("");
    setShowAddClient(false);
    onRefetch?.();
  }

  async function handleSaveProduct() {
    if (!company?.id || !newProductName.trim()) return;
    await saveProduct({
      company_id: company.id,
      name: newProductName.trim(),
      description: newProductDesc.trim() || null,
    } as any);
    setNewProductName("");
    setNewProductDesc("");
    setShowAddProduct(false);
    onRefetch?.();
  }

  return (
    <AnimatePresence>
      {isOpen && company && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/30 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed right-0 top-0 bottom-0 w-[520px] max-w-[92vw] bg-white z-50 border-l shadow-2xl flex flex-col"
            initial={{ x: 560 }}
            animate={{ x: 0 }}
            exit={{ x: 560 }}
            transition={{ type: "tween", duration: 0.25 }}
          >
            <div className="px-5 py-4 border-b flex items-start justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold truncate">{company.name}</h2>
                  <CompanyChip name={company.name} />
                </div>
                {company.description && (
                  <p className="text-sm text-neutral-600 mt-1 line-clamp-2">
                    {company.description}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="text-neutral-500 hover:text-neutral-900 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto">
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
              <Card
                title="Clients"
                subtitle="Projects & accounts"
                className="p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-neutral-500">
                    {clients.length} total
                  </div>
                  {founder && (
                    <button
                      onClick={() => setShowAddClient(true)}
                      className="text-xs bg-teal-600 text-white rounded-xl px-3 py-1.5 hover:bg-teal-700 font-medium"
                    >
                      ➕ Add Client
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {clients.slice(0, 8).map((c) => (
                    <div key={c.id} className="rounded-xl border p-3 bg-white">
                      <div className="text-sm font-medium">{c.name}</div>
                      {c.contact_email && (
                        <div className="text-xs text-neutral-500 mt-1">
                          {c.contact_email}
                        </div>
                      )}
                    </div>
                  ))}
                  {clients.length === 0 && (
                    <div className="text-xs text-neutral-500">No clients yet.</div>
                  )}
                </div>
              </Card>

              {/* Products */}
              <Card title="Products" subtitle="Offers & SKUs" className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-neutral-500">
                    {products.length} total
                  </div>
                  {founder && (
                    <button
                      onClick={() => setShowAddProduct(true)}
                      className="text-xs bg-teal-600 text-white rounded-xl px-3 py-1.5 hover:bg-teal-700 font-medium"
                    >
                      ➕ Add Product
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {products.slice(0, 8).map((p) => (
                    <div key={p.id} className="rounded-xl border p-3 bg-white">
                      <div className="text-sm font-medium">{p.name}</div>
                      {p.description && (
                        <div className="text-xs text-neutral-500 mt-1 line-clamp-2">
                          {p.description}
                        </div>
                      )}
                    </div>
                  ))}
                  {products.length === 0 && (
                    <div className="text-xs text-neutral-500">No products yet.</div>
                  )}
                </div>
              </Card>
            </div>

            {/* Add Client modal (inline, lightweight) */}
            <AnimatePresence>
              {showAddClient && (
                <motion.div
                  className="fixed inset-0 z-[60] flex items-center justify-center p-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="absolute inset-0 bg-black/40" onClick={() => setShowAddClient(false)} />
                  <motion.div
                    className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl p-5"
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-semibold">Add Client</div>
                      <button onClick={() => setShowAddClient(false)} className="text-neutral-500 text-xl leading-none">×</button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-neutral-600">Client name</label>
                        <input
                          value={newClientName}
                          onChange={(e) => setNewClientName(e.target.value)}
                          className="w-full mt-1 rounded-xl border px-3 py-2 text-sm"
                          placeholder="Acme Co"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-neutral-600">Contact email (optional)</label>
                        <input
                          value={newClientEmail}
                          onChange={(e) => setNewClientEmail(e.target.value)}
                          className="w-full mt-1 rounded-xl border px-3 py-2 text-sm"
                          placeholder="name@company.com"
                        />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => setShowAddClient(false)}
                          className="px-4 py-2 border rounded-xl hover:bg-neutral-50 text-sm"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveClient}
                          disabled={!newClientName.trim()}
                          className="flex-1 bg-teal-600 text-white rounded-xl px-4 py-2 hover:bg-teal-700 font-medium text-sm disabled:opacity-50"
                        >
                          Add Client
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
                <motion.div
                  className="fixed inset-0 z-[60] flex items-center justify-center p-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="absolute inset-0 bg-black/40" onClick={() => setShowAddProduct(false)} />
                  <motion.div
                    className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl p-5"
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-semibold">Add Product</div>
                      <button onClick={() => setShowAddProduct(false)} className="text-neutral-500 text-xl leading-none">×</button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-neutral-600">Product name</label>
                        <input
                          value={newProductName}
                          onChange={(e) => setNewProductName(e.target.value)}
                          className="w-full mt-1 rounded-xl border px-3 py-2 text-sm"
                          placeholder="Ops Retainer"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-neutral-600">Description (optional)</label>
                        <textarea
                          value={newProductDesc}
                          onChange={(e) => setNewProductDesc(e.target.value)}
                          className="w-full mt-1 rounded-xl border px-3 py-2 text-sm min-h-[90px]"
                          placeholder="What this offer includes…"
                        />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => setShowAddProduct(false)}
                          className="px-4 py-2 border rounded-xl hover:bg-neutral-50 text-sm"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveProduct}
                          disabled={!newProductName.trim()}
                          className="flex-1 bg-teal-600 text-white rounded-xl px-4 py-2 hover:bg-teal-700 font-medium text-sm disabled:opacity-50"
                        >
                          Add Product
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
