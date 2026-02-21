// =====================================================
// COMPANY MANAGEMENT COMPONENTS
// Clients, Products, SOPs with approval workflow
// Add these to your DashboardApp.tsx
// =====================================================

import React, { useState } from "react";
import { 
  saveClient, 
  saveProduct, 
  saveSOP,
  syncProductWithEtsy,
  Client,
  Product,
  SOP 
} from "./useDatabase";

// =====================================================
// CLIENT CARD COMPONENT
// =====================================================
interface ClientCardProps {
  client: Client;
  onEdit: (client: Client) => void;
  isFounder: boolean;
}

function ClientCard({ client, onEdit, isFounder }: ClientCardProps) {
  return (
    <div className="rounded-2xl border p-4 bg-white hover:shadow-lg transition-shadow">
      {client.photo_url && (
        <img
          src={client.photo_url}
          alt={client.name}
          className="w-full h-32 object-cover rounded-xl mb-3"
        />
      )}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-semibold text-lg">{client.name}</h3>
          <p className="text-sm text-neutral-500">{client.contact_email}</p>
        </div>
        <button
          onClick={() => onEdit(client)}
          className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      </div>
      <p className="text-sm text-neutral-600 mb-3">{client.description}</p>
      {client.scope && (
        <div className="mb-3">
          <span className="text-xs font-medium text-neutral-500">Scope:</span>
          <p className="text-sm text-neutral-700">{client.scope}</p>
        </div>
      )}
      {client.deadline && (
        <div className="mb-3">
          <span className="text-xs font-medium text-neutral-500">Deadline:</span>
          <p className="text-sm text-neutral-700">
            {new Date(client.deadline).toLocaleDateString()}
          </p>
        </div>
      )}
      {client.quick_links && client.quick_links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {client.quick_links.map((link, idx) => (
            <a
              key={idx}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-2 py-1 rounded-full bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors"
            >
              {link.name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================
// CLIENT MODAL (Create/Edit)
// =====================================================
interface ClientModalProps {
  client: Client | null;
  companyId: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  isFounder: boolean;
}

function ClientModal({ client, companyId, isOpen, onClose, onSaved, isFounder }: ClientModalProps) {
  const [name, setName] = useState(client?.name || "");
  const [description, setDescription] = useState(client?.description || "");
  const [contactEmail, setContactEmail] = useState(client?.contact_email || "");
  const [contactPhone, setContactPhone] = useState(client?.contact_phone || "");
  const [scope, setScope] = useState(client?.scope || "");
  const [deadline, setDeadline] = useState(client?.deadline ? client.deadline.split("T")[0] : "");
  const [photoUrl, setPhotoUrl] = useState(client?.photo_url || "");
  const [links, setLinks] = useState<{name: string; url: string}[]>(client?.quick_links || []);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (client && isOpen) {
      setName(client.name);
      setDescription(client.description || "");
      setContactEmail(client.contact_email || "");
      setContactPhone(client.contact_phone || "");
      setScope(client.scope || "");
      setDeadline(client.deadline ? client.deadline.split("T")[0] : "");
      setPhotoUrl(client.photo_url || "");
      setLinks(client.quick_links || []);
    }
  }, [client, isOpen]);

  function addLink() {
    setLinks([...links, { name: "", url: "" }]);
  }

  function updateLink(idx: number, field: "name" | "url", value: string) {
    const updated = [...links];
    updated[idx][field] = value;
    setLinks(updated);
  }

  function removeLink(idx: number) {
    setLinks(links.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    setSaving(true);
    const clientData: Partial<Client> = {
      id: client?.id,
      company_id: companyId,
      name,
      description,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      scope,
      deadline: deadline || null,
      photo_url: photoUrl,
      quick_links: links.filter(l => l.name && l.url),
      status: client?.status || "active",
    };

    const result = await saveClient(clientData, !isFounder);
    setSaving(false);

    if (result) {
      if (!isFounder) {
        alert("Your changes have been submitted for approval!");
      }
      onSaved();
      onClose();
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={client ? "Edit Client" : "Add Client"} size="large">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        <div>
          <label className="text-sm font-medium text-neutral-700">Client Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm"
            placeholder="Client name..."
          />
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700">Photo URL</label>
          <input
            type="text"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm"
            placeholder="https://..."
          />
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm resize-none"
            placeholder="Brief description..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-700">Contact Email</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full mt-1 rounded-xl border px-3 py-2 text-sm"
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700">Contact Phone</label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full mt-1 rounded-xl border px-3 py-2 text-sm"
              placeholder="(555) 123-4567"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700">Scope</label>
          <textarea
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            rows={2}
            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm resize-none"
            placeholder="Project scope..."
          />
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700">Deadline</label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-neutral-700">Quick Links</label>
            <button
              onClick={addLink}
              className="text-xs px-2 py-1 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100"
            >
              + Add Link
            </button>
          </div>
          <div className="space-y-2">
            {links.map((link, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="text"
                  value={link.name}
                  onChange={(e) => updateLink(idx, "name", e.target.value)}
                  placeholder="Link name"
                  className="flex-1 rounded-xl border px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={link.url}
                  onChange={(e) => updateLink(idx, "url", e.target.value)}
                  placeholder="URL"
                  className="flex-1 rounded-xl border px-3 py-2 text-sm"
                />
                <button
                  onClick={() => removeLink(idx)}
                  className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="flex-1 rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : isFounder ? "Save" : "Submit for Approval"}
          </button>
        </div>
      </div>
    </Modal>
  );
}


// =====================================================
// PRODUCT CARD COMPONENT
// =====================================================
interface ProductCardProps {
  product: Product;
  onEdit: (product: Product) => void;
  onSync?: (productId: string) => void;
  isFounder: boolean;
}

function ProductCard({ product, onEdit, onSync, isFounder }: ProductCardProps) {
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    if (!onSync) return;
    setSyncing(true);
    await onSync(product.id);
    setSyncing(false);
  }

  return (
    <div className="rounded-2xl border p-4 bg-white hover:shadow-lg transition-shadow">
      {product.photo_url && (
        <img
          src={product.photo_url}
          alt={product.name}
          className="w-full h-48 object-cover rounded-xl mb-3"
        />
      )}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-semibold text-lg">{product.name}</h3>
          <p className="text-xs text-neutral-500">{product.sku}</p>
        </div>
        <div className="flex gap-1">
          {product.etsy_listing_id && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="p-2 rounded-lg hover:bg-purple-50 text-purple-600 transition-colors disabled:opacity-50"
              title="Sync with Etsy"
            >
              {syncing ? "..." : "🔄"}
            </button>
          )}
          <button
            onClick={() => onEdit(product)}
            className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>
      </div>
      <p className="text-sm text-neutral-600 mb-3">{product.description}</p>
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-semibold">${product.price?.toFixed(2) || "0.00"}</span>
          <span className="text-xs text-neutral-500 ml-2">
            Stock: {product.inventory_count}
          </span>
        </div>
        {product.etsy_url && (
          <a
            href={product.etsy_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-2 py-1 rounded-full bg-purple-50 text-purple-700 hover:bg-purple-100"
          >
            View on Etsy
          </a>
        )}
      </div>
      {product.last_synced_at && (
        <p className="text-xs text-neutral-400 mt-2">
          Last synced: {new Date(product.last_synced_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}

// =====================================================
// PRODUCT MODAL (Create/Edit)
// =====================================================
interface ProductModalProps {
  product: Product | null;
  companyId: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  isFounder: boolean;
}

function ProductModal({ product, companyId, isOpen, onClose, onSaved, isFounder }: ProductModalProps) {
  const [name, setName] = useState(product?.name || "");
  const [description, setDescription] = useState(product?.description || "");
  const [sku, setSku] = useState(product?.sku || "");
  const [price, setPrice] = useState(product?.price?.toString() || "");
  const [inventory, setInventory] = useState(product?.inventory_count?.toString() || "0");
  const [photoUrl, setPhotoUrl] = useState(product?.photo_url || "");
  const [etsyListingId, setEtsyListingId] = useState(product?.etsy_listing_id || "");
  const [etsyUrl, setEtsyUrl] = useState(product?.etsy_url || "");
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (product && isOpen) {
      setName(product.name);
      setDescription(product.description || "");
      setSku(product.sku || "");
      setPrice(product.price?.toString() || "");
      setInventory(product.inventory_count?.toString() || "0");
      setPhotoUrl(product.photo_url || "");
      setEtsyListingId(product.etsy_listing_id || "");
      setEtsyUrl(product.etsy_url || "");
    }
  }, [product, isOpen]);

  async function handleSave() {
    setSaving(true);
    const productData: Partial<Product> = {
      id: product?.id,
      company_id: companyId,
      name,
      description,
      sku,
      price: parseFloat(price) || 0,
      inventory_count: parseInt(inventory) || 0,
      photo_url: photoUrl,
      etsy_listing_id: etsyListingId || null,
      etsy_url: etsyUrl || null,
      is_active: true,
    };

    const result = await saveProduct(productData, !isFounder);
    setSaving(false);

    if (result) {
      if (!isFounder) {
        alert("Your changes have been submitted for approval!");
      }
      onSaved();
      onClose();
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={product ? "Edit Product" : "Add Product"} size="large">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        <div>
          <label className="text-sm font-medium text-neutral-700">Product Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm"
            placeholder="Product name..."
          />
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700">Photo URL</label>
          <input
            type="text"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm"
            placeholder="https://..."
          />
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm resize-none"
            placeholder="Product description..."
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-700">SKU</label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="w-full mt-1 rounded-xl border px-3 py-2 text-sm"
              placeholder="SKU-001"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700">Price *</label>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full mt-1 rounded-xl border px-3 py-2 text-sm"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700">Inventory</label>
            <input
              type="number"
              value={inventory}
              onChange={(e) => setInventory(e.target.value)}
              className="w-full mt-1 rounded-xl border px-3 py-2 text-sm"
              placeholder="0"
            />
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="text-sm font-semibold mb-3">Etsy Integration</h4>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-neutral-700">Etsy Listing ID</label>
              <input
                type="text"
                value={etsyListingId}
                onChange={(e) => setEtsyListingId(e.target.value)}
                className="w-full mt-1 rounded-xl border px-3 py-2 text-sm"
                placeholder="1234567890"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-700">Etsy URL</label>
              <input
                type="text"
                value={etsyUrl}
                onChange={(e) => setEtsyUrl(e.target.value)}
                className="w-full mt-1 rounded-xl border px-3 py-2 text-sm"
                placeholder="https://etsy.com/listing/..."
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || !price || saving}
            className="flex-1 rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : isFounder ? "Save" : "Submit for Approval"}
          </button>
        </div>
      </div>
    </Modal>
  );
}


// =====================================================
// SOP CARD COMPONENT (Box that expands)
// =====================================================
interface SOPCardProps {
  sop: SOP;
  onEdit: (sop: SOP) => void;
  isFounder: boolean;
}

function SOPCard({ sop, onEdit, isFounder }: SOPCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-2xl border p-4 bg-white hover:shadow-lg transition-shadow">
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="cursor-pointer"
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-1">{sop.title}</h3>
            <p className="text-sm text-neutral-600">{sop.short_description}</p>
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(sop);
              }}
              className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <div className="text-2xl text-neutral-400">
              {isExpanded ? "−" : "+"}
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className="text-xs px-2 py-1 rounded-full bg-teal-50 text-teal-700">
            {sop.task_count} {sop.task_count === 1 ? "task" : "tasks"}
          </span>
          {sop.role_context && (
            <span className="text-xs px-2 py-1 rounded-full bg-neutral-100 text-neutral-700 capitalize">
              {sop.role_context}
            </span>
          )}
          {sop.tags?.map((tag, idx) => (
            <span key={idx} className="text-xs px-2 py-1 rounded-full bg-purple-50 text-purple-700">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="mt-4 pt-4 border-t"
        >
          {sop.full_description && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-neutral-700 mb-2">Full Description</h4>
              <p className="text-sm text-neutral-600 whitespace-pre-wrap">{sop.full_description}</p>
            </div>
          )}
          {sop.instructions && sop.instructions.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-neutral-700 mb-2">Instructions</h4>
              <ol className="space-y-2">
                {sop.instructions.map((instruction, idx) => (
                  <li key={idx} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-semibold">
                      {instruction.step}
                    </span>
                    <p className="text-sm text-neutral-700 flex-1">{instruction.text}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

// =====================================================
// SOP MODAL (Create/Edit)
// =====================================================
interface SOPModalProps {
  sop: SOP | null;
  companyId: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  isFounder: boolean;
}

function SOPModal({ sop, companyId, isOpen, onClose, onSaved, isFounder }: SOPModalProps) {
  const [title, setTitle] = useState(sop?.title || "");
  const [shortDesc, setShortDesc] = useState(sop?.short_description || "");
  const [fullDesc, setFullDesc] = useState(sop?.full_description || "");
  const [roleContext, setRoleContext] = useState(sop?.role_context || "all");
  const [taskCount, setTaskCount] = useState(sop?.task_count?.toString() || "0");
  const [tags, setTags] = useState<string[]>(sop?.tags || []);
  const [instructions, setInstructions] = useState<{step: number; text: string}[]>(
    sop?.instructions || [{step: 1, text: ""}]
  );
  const [saving, setSaving] = useState(false);
  const [newTag, setNewTag] = useState("");

  React.useEffect(() => {
    if (sop && isOpen) {
      setTitle(sop.title);
      setShortDesc(sop.short_description || "");
      setFullDesc(sop.full_description || "");
      setRoleContext(sop.role_context || "all");
      setTaskCount(sop.task_count?.toString() || "0");
      setTags(sop.tags || []);
      setInstructions(sop.instructions || [{step: 1, text: ""}]);
    }
  }, [sop, isOpen]);

  function addInstruction() {
    setInstructions([...instructions, { step: instructions.length + 1, text: "" }]);
  }

  function updateInstruction(idx: number, text: string) {
    const updated = [...instructions];
    updated[idx].text = text;
    setInstructions(updated);
  }

  function removeInstruction(idx: number) {
    const updated = instructions.filter((_, i) => i !== idx);
    // Renumber steps
    updated.forEach((inst, i) => inst.step = i + 1);
    setInstructions(updated);
  }

  function addTag() {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  }

  function removeTag(tag: string) {
    setTags(tags.filter(t => t !== tag));
  }

  async function handleSave() {
    setSaving(true);
    const sopData: Partial<SOP> = {
      id: sop?.id,
      company_id: companyId,
      title,
      short_description: shortDesc,
      full_description: fullDesc,
      role_context: roleContext,
      task_count: parseInt(taskCount) || 0,
      tags,
      instructions: instructions.filter(i => i.text.trim()),
      is_active: true,
    };

    const result = await saveSOP(sopData, !isFounder);
    setSaving(false);

    if (result) {
      if (!isFounder) {
        alert("Your SOP has been submitted for approval!");
      }
      onSaved();
      onClose();
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={sop ? "Edit SOP" : "Create SOP"} size="large">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        <div>
          <label className="text-sm font-medium text-neutral-700">SOP Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm"
            placeholder="e.g., Weekly Client Check-in Process"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700">Short Description *</label>
          <textarea
            value={shortDesc}
            onChange={(e) => setShortDesc(e.target.value)}
            rows={2}
            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm resize-none"
            placeholder="Brief summary visible on the card..."
          />
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700">Full Description</label>
          <textarea
            value={fullDesc}
            onChange={(e) => setFullDesc(e.target.value)}
            rows={4}
            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm resize-none"
            placeholder="Detailed description shown when expanded..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-700">Role Context</label>
            <select
              value={roleContext}
              onChange={(e) => setRoleContext(e.target.value)}
              className="w-full mt-1 rounded-xl border px-3 py-2 text-sm"
            >
              <option value="all">All Roles</option>
              <option value="founder">Founder Only</option>
              <option value="team">Team Only</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700">Task Count</label>
            <input
              type="number"
              value={taskCount}
              onChange={(e) => setTaskCount(e.target.value)}
              className="w-full mt-1 rounded-xl border px-3 py-2 text-sm"
              placeholder="0"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700 mb-2 block">Tags</label>
          <div className="flex gap-2 mb-2 flex-wrap">
            {tags.map((tag, idx) => (
              <span 
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-50 text-purple-700 text-xs"
              >
                {tag}
                <button onClick={() => removeTag(tag)} className="hover:text-purple-900">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && addTag()}
              className="flex-1 rounded-xl border px-3 py-2 text-sm"
              placeholder="Add tag..."
            />
            <button
              onClick={addTag}
              className="px-4 py-2 rounded-xl bg-purple-50 text-purple-700 text-sm hover:bg-purple-100"
            >
              Add
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-neutral-700">Instructions</label>
            <button
              onClick={addInstruction}
              className="text-xs px-2 py-1 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100"
            >
              + Add Step
            </button>
          </div>
          <div className="space-y-2">
            {instructions.map((instruction, idx) => (
              <div key={idx} className="flex gap-2">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-sm font-semibold">
                  {instruction.step}
                </div>
                <textarea
                  value={instruction.text}
                  onChange={(e) => updateInstruction(idx, e.target.value)}
                  rows={2}
                  className="flex-1 rounded-xl border px-3 py-2 text-sm resize-none"
                  placeholder="Instruction text..."
                />
                <button
                  onClick={() => removeInstruction(idx)}
                  className="p-2 rounded-lg hover:bg-red-50 text-red-600 h-8"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || !shortDesc.trim() || saving}
            className="flex-1 rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : isFounder ? "Save SOP" : "Submit for Approval"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// =====================================================
// EXPORT ALL COMPONENTS
// =====================================================
export {
  ClientCard,
  ClientModal,
  ProductCard,
  ProductModal,
  SOPCard,
  SOPModal,
};
