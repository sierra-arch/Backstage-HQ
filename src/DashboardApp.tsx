// DashboardApp.tsx - COMPLETE MULTI-BRAND VERSION
// ✨ Full client/product management, cover photos, smart navigation
import "./styles.css";
import React, { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "./supabase";
import {
  useTasks,
  useProfile,
  useCompanies,
  createTask as dbCreateTask,
  updateTask as dbUpdateTask,
  completeTask as dbCompleteTask,
  deleteTask as dbDeleteTask,
  getCompanyByName,
} from "./useDatabase";

/* ──────────────────────────────────────────────────────────────────
   Types & Constants
   ────────────────────────────────────────────────────────────────── */
type AppRole = "founder" | "team";
type Role = "Founder" | "Team";
const fromDbToUi: Record<AppRole, Role> = { founder: "Founder", team: "Team" };

function useSession() {
  const [s, setS] = React.useState<any>(undefined);
  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setS(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) =>
      setS(sess ?? null)
    );
    return () => sub.subscription.unsubscribe();
  }, []);
  return s;
}

const isFounder = (r: Role) => r === "Founder";

const COMPANIES = ["Prose Florals", "Backstage", "Mairé"] as const;
const TEAMMATES = ["Sierra", "Alex", "Maya"] as const;
const XP_BY_IMPACT = { small: 5, medium: 10, large: 20 } as const;
const LEVEL_XP_THRESHOLD = 200;

// Auto-calculate time estimates from level
const TIME_BY_LEVEL = { small: 20, medium: 45, large: 90 } as const;

type DBTask = {
  id: string;
  title: string;
  description: string | null;
  company_id: string | null;
  assigned_to: string | null;
  status: 'focus' | 'active' | 'submitted' | 'completed' | 'archived';
  priority: 'low' | 'medium' | 'high';
  impact: 'small' | 'medium' | 'large';
  estimate_minutes: number;
  company_name?: string;
  assignee_name?: string;
  due_date?: string | null;
  photo_url?: string | null;
  // recurring?: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly'; // TODO: Add to DB schema
};

type Client = {
  id: string;
  company: string;
  name: string;
  photo_url: string;
  description: string;
  contact: string;
  scope: string;
  quick_links: string[];
  deadline?: string;
  added_date: string;
};

type Product = {
  id: string;
  name: string;
  photo_url: string;
  description: string;
  etsy_link: string;
  sku: string;
  date_added: string;
  months_active: number;
};

type CompanyData = {
  name: string;
  logo_url: string;
  description: string;
  color: string;
  social_links: { platform: string; url: string }[];
  software_links: { name: string; url: string }[];
};

type Message = {
  id: string;
  from: string;
  to?: string;
  content: string;
  timestamp: number;
  type: 'dm' | 'team';
  read: boolean;
  attachment?: {
    name: string;
    url: string;
    type: string;
  };
  isKudos?: boolean;
  taskLink?: string;
};

type Accomplishment = {
  id: string;
  user: string;
  text: string;
  timestamp: number;
  postedToTeam: boolean;
};

// Mock data - will be replaced with database
const MOCK_CLIENTS: Client[] = [
  {
    id: '1',
    company: 'Prose Florals',
    name: 'Sarah & James Wedding',
    photo_url: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=400',
    description: 'Romantic garden wedding with blush and ivory palette',
    contact: 'sarah.j@email.com',
    scope: 'Full floral design, ceremony & reception',
    quick_links: ['Contract', 'Mood Board', 'Timeline'],
    deadline: '2026-06-15',
    added_date: '2025-12-01',
  },
  {
    id: '2',
    company: 'Prose Florals',
    name: 'Corporate Event - Tech Co',
    photo_url: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=400',
    description: 'Modern minimalist arrangements for tech conference',
    contact: 'events@techco.com',
    scope: 'Lobby installations, table centerpieces',
    quick_links: ['Proposal', 'Venue Details'],
    deadline: '2026-03-20',
    added_date: '2026-01-10',
  },
];

const MOCK_PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Pressed Flower Bookmark',
    photo_url: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=300',
    description: 'Handcrafted pressed flower bookmarks with gold leaf accents',
    etsy_link: 'https://etsy.com/listing/12345',
    sku: 'MRE-BM-001',
    date_added: '2024-08-15',
    months_active: 5,
  },
  {
    id: '2',
    name: 'Botanical Wall Art',
    photo_url: 'https://images.unsplash.com/photo-1513519245088-0e12902e35ca?w=300',
    description: 'Framed pressed flowers in modern minimalist frames',
    etsy_link: 'https://etsy.com/listing/67890',
    sku: 'MRE-ART-002',
    date_added: '2024-10-01',
    months_active: 3,
  },
];

const COMPANY_DATA: Record<string, CompanyData> = {
  'Prose Florals': {
    name: 'Prose Florals',
    logo_url: '🌸',
    description: 'High-touch creative floral design for weddings and events',
    color: '#84cc16',
    social_links: [
      { platform: 'Instagram', url: 'https://instagram.com/proseflorals' },
      { platform: 'Website', url: 'https://proseflorals.com' },
    ],
    software_links: [
      { name: 'Honeybook', url: 'https://honeybook.com' },
      { name: 'Canva', url: 'https://canva.com' },
    ],
  },
  'Backstage': {
    name: 'Backstage',
    logo_url: '🎯',
    description: 'Business operations systems and strategic consulting',
    color: '#14b8a6',
    social_links: [
      { platform: 'LinkedIn', url: 'https://linkedin.com/company/backstage' },
      { platform: 'Website', url: 'https://backstageop.com' },
    ],
    software_links: [
      { name: 'Notion', url: 'https://notion.so' },
      { name: 'Airtable', url: 'https://airtable.com' },
    ],
  },
  'Mairé': {
    name: 'Mairé',
    logo_url: '✨',
    description: 'Handcrafted botanical products and pressed flower art',
    color: '#10b981',
    social_links: [
      { platform: 'Etsy', url: 'https://etsy.com/shop/maire' },
      { platform: 'TikTok', url: 'https://tiktok.com/@maire' },
    ],
    software_links: [
      { name: 'Etsy Seller', url: 'https://etsy.com/seller' },
      { name: 'Shipstation', url: 'https://shipstation.com' },
    ],
  },
};

/* ──────────────────────────────────────────────────────────────────
   Confetti
   ────────────────────────────────────────────────────────────────── */
function Confetti({ fire }: { fire: boolean }) {
  if (!fire) return null;
  return (
    <div style={{ pointerEvents: "none", position: "fixed", inset: 0, zIndex: 60 }}>
      {Array.from({ length: 140 }).map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.2;
        const dur = 0.8 + Math.random() * 0.9;
        const size = 4 + Math.random() * 7;
        const rot = Math.random() * 360;
        const hue = 155 + Math.random() * 40;
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              top: "-6vh",
              left: `${left}%`,
              width: size,
              height: size * 0.35,
              background: `hsl(${hue} 70% 45%)`,
              transform: `rotate(${rot}deg)`,
              borderRadius: 2,
              opacity: 0.9,
              animation: `fall ${dur}s ${delay}s linear forwards`,
            }}
          />
        );
      })}
      <style>{`@keyframes fall{to{transform:translateY(110vh) rotate(720deg);opacity:1}}`}</style>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   UI Components
   ────────────────────────────────────────────────────────────────── */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[12px] rounded-full border bg-teal-50 text-teal-900/80 px-3 py-1">
      {children}
    </span>
  );
}

function Card({
  title,
  subtitle,
  children,
  className = "",
  variant = "default",
  onClick,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "compact";
  onClick?: () => void;
}) {
  return (
    <section
      onClick={onClick}
      className={`rounded-2xl border border-neutral-200 bg-white ${
        variant === "compact" ? "p-4 md:p-5" : "p-5 md:p-6"
      } shadow-sm ${className} ${onClick ? 'cursor-pointer hover:border-teal-300 transition-colors' : ''}`}
    >
      {(title || subtitle) && (
        <header className="mb-2 md:mb-3">
          {title && (
            <h2 className="text-[14px] md:text-[15px] font-semibold leading-tight">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-xs md:text-[13px] text-neutral-500">
              {subtitle}
            </p>
          )}
        </header>
      )}
      {children}
    </section>
  );
}

function LevelRing({
  level,
  value,
  max,
  showStats = true,
  size = 132,
  stroke = 16,
}: {
  level: number;
  value: number;
  max: number;
  showStats?: boolean;
  size?: number;
  stroke?: number;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const r = size / 2 - stroke - 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);

  const ringSvg = (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} stroke="#CDEDE6" fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        stroke="#0F766E"
        fill="none"
        strokeLinecap="round"
        style={{
          strokeDasharray: c,
          strokeDashoffset: off,
          transform: "rotate(-90deg)",
          transformOrigin: "50% 50%",
        }}
      />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize={Math.max(12, Math.round(size * 0.18))} fill="#0F172A">
        L{level}
      </text>
    </svg>
  );

  if (!showStats) return <div>{ringSvg}</div>;
  return (
    <div className="flex items-center gap-3">
      {ringSvg}
      <div>
        <div className="text-lg font-semibold">{pct}%</div>
        <div className="text-xs text-neutral-500">to next level</div>
      </div>
    </div>
  );
}

function CompanyChip({ name, showLogo = true }: { name: string; showLogo?: boolean }) {
  const map: any = {
    "Prose Florals": { bg: "bg-lime-50", text: "text-lime-900/80", border: "border-lime-200", logo: "🌸" },
    Backstage: { bg: "bg-teal-100", text: "text-teal-900/90", border: "border-teal-300", logo: "🎯" },
    Mairé: { bg: "bg-emerald-50", text: "text-emerald-900/80", border: "border-emerald-200", logo: "✨" },
  };
  const s = map[name] || { bg: "bg-neutral-50", text: "text-neutral-800", border: "border-neutral-200", logo: "📦" };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${s.bg} ${s.text} ${s.border} inline-flex items-center gap-1`}>
      {showLogo && <span>{s.logo}</span>}
      {name}
    </span>
  );
}

function Avatar({ name, size = 24, photoUrl }: { name: string; size?: number; photoUrl?: string }) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        title={name}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  
  const initials = name.split(" ").map((s) => s[0]?.toUpperCase()).join("").slice(0, 2);
  const palette = ["#0F766E", "#166534", "#065F46", "#064E3B", "#0B4D4B"];
  const color = palette[(name.charCodeAt(0) + name.charCodeAt(name.length - 1)) % palette.length];
  return (
    <div
      title={name}
      className="flex items-center justify-center rounded-full text-white"
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: Math.max(10, Math.round(size * 0.4)),
      }}
    >
      {initials}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Modal System
   ────────────────────────────────────────────────────────────────── */
function Modal({ isOpen, onClose, title, children, size = "large", coverImage }: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "small" | "medium" | "large";
  coverImage?: string;
}) {
  if (!isOpen) return null;

  const sizeClasses = {
    small: "max-w-md",
    medium: "max-w-2xl",
    large: "max-w-4xl",
  };

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
            <button
              onClick={onClose}
              className="text-neutral-500 hover:text-neutral-900 text-2xl leading-none"
            >
              ×
            </button>
          </div>
          <div className="p-6">{children}</div>
        </motion.div>
      </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Task Modal
   ────────────────────────────────────────────────────────────────── */
function TaskModal({ task, isOpen, onClose, onComplete, role }: {
  task: DBTask | null;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  role: Role;
}) {
  if (!task) return null;

  const buttonText = isFounder(role) ? "Mark Complete" : "Submit for Approval";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={task.title} size="medium" coverImage={task.photo_url || undefined}>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-neutral-700">Description</label>
          <p className="text-sm text-neutral-600 mt-1">{task.description || "No description provided"}</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-700">Company</label>
            <div className="mt-1">
              <CompanyChip name={task.company_name || "Unknown"} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700">Assigned To</label>
            <div className="mt-1 flex items-center gap-2">
              <Avatar name={task.assignee_name || "Unassigned"} size={20} />
              <span className="text-sm text-neutral-600">{task.assignee_name || "Unassigned"}</span>
            </div>
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

/* ──────────────────────────────────────────────────────────────────
   Task Creation Modal
   ────────────────────────────────────────────────────────────────── */
function TaskCreateModal({ isOpen, onClose, onCreated, role, userName }: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  role: Role;
  userName: string;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [company, setCompany] = useState("Prose Florals");
  const [assignee, setAssignee] = useState(isFounder(role) ? "" : userName);
  const [level, setLevel] = useState<"small" | "medium" | "large">("medium");
  const [deadline, setDeadline] = useState("");
  const [recurring, setRecurring] = useState<"none" | "daily" | "weekly" | "biweekly" | "monthly" | "quarterly">("none");
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  async function handleCreate() {
    const companyData = await getCompanyByName(company);
    
    // Auto-calculate estimate from level
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
      // recurring, // TODO: Add recurring column to database schema
    });

    // Reset form
    setTitle("");
    setDescription("");
    setDeadline("");
    setRecurring("none");
    setPhotoFile(null);
    
    onCreated();
    onClose();
  }

  // Team members can only assign to self or Founder
  const assignOptions = isFounder(role) 
    ? ["", ...TEAMMATES] 
    : [userName, "Founder"];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Task" size="medium">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-neutral-700">Task Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
            placeholder="Enter task title..."
          />
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700">Description *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm min-h-[100px] focus:ring-2 focus:ring-teal-200 outline-none"
            placeholder="Add details..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-700">Company *</label>
            <select
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
            >
              {COMPANIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700">Assign To *</label>
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
            >
              <option value="">Unassigned</option>
              {assignOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-700">Level *</label>
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
            <label className="text-sm font-medium text-neutral-700">Recurring</label>
            <select
              value={recurring}
              onChange={(e) => setRecurring(e.target.value as any)}
              className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
            >
              <option value="none">None</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700">Deadline (Optional)</label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700">Photo (Optional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
            className="w-full mt-1 text-sm"
          />
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

/* ──────────────────────────────────────────────────────────────────
   Client/Product Modals
   ────────────────────────────────────────────────────────────────── */
function ClientModal({ client, isOpen, onClose }: {
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

        <div>
          <label className="text-sm font-medium text-neutral-700">Quick Links</label>
          <div className="flex gap-2 mt-2">
            {client.quick_links.map((link, i) => (
              <a
                key={i}
                href="#"
                className="text-xs bg-teal-50 text-teal-700 px-3 py-1.5 rounded-lg hover:bg-teal-100"
              >
                {link}
              </a>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ProductModal({ product, isOpen, onClose }: {
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
            <p className="text-sm text-neutral-600 mt-1">{new Date(product.date_added).toLocaleDateString()}</p>
          </div>
        </div>

        <div>
          <a
            href={product.etsy_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-teal-600 text-white px-4 py-2 rounded-xl hover:bg-teal-700 text-sm font-medium"
          >
            View on Etsy →
          </a>
        </div>
      </div>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Company Modal
   ────────────────────────────────────────────────────────────────── */
function CompanyModal({ companyName, isOpen, onClose, onClientClick, onProductClick }: {
  companyName: string | null;
  isOpen: boolean;
  onClose: () => void;
  onClientClick: (client: Client) => void;
  onProductClick: (product: Product) => void;
}) {
  if (!companyName) return null;
  
  const company = COMPANY_DATA[companyName];
  const clients = MOCK_CLIENTS.filter(c => c.company === companyName);
  const products = companyName === 'Mairé' ? MOCK_PRODUCTS : [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={companyName} size="large">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="text-6xl">{company.logo_url}</div>
          <div className="flex-1">
            <p className="text-sm text-neutral-600">{company.description}</p>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700 block mb-2">Social Links</label>
          <div className="flex gap-2">
            {company.social_links.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full border-2 border-teal-700 flex items-center justify-center text-teal-700 hover:bg-teal-50 transition-colors"
              >
                <span className="text-xs font-bold">{link.platform[0]}</span>
              </a>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700 block mb-2">Software</label>
          <div className="flex gap-2">
            {company.software_links.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-teal-700 hover:text-teal-800 underline"
              >
                {link.name}
              </a>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700 block mb-3">
            {companyName === 'Mairé' ? 'All Products' : 'All Clients & Projects'}
          </label>
          <div className="grid grid-cols-12 gap-2">
            {clients.map((client) => (
              <div
                key={client.id}
                onClick={() => {
                  onClientClick(client);
                  onClose();
                }}
                className="relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                style={{
                  backgroundImage: `url(${client.photo_url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <p className="text-white text-xs font-medium truncate">{client.name}</p>
                </div>
              </div>
            ))}
            {products.map((product) => (
              <div
                key={product.id}
                onClick={() => {
                  onProductClick(product);
                  onClose();
                }}
                className="relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                style={{
                  backgroundImage: `url(${product.photo_url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <p className="text-white text-xs font-medium truncate">{product.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Chat System
   ────────────────────────────────────────────────────────────────── */
function ChatPanel({ userName, isOpen, onClose, messages, onSendMessage }: {
  userName: string;
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  onSendMessage: (content: string, to?: string) => void;
}) {
  const [newMessage, setNewMessage] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState("Team");

  function sendMessage() {
    if (!newMessage.trim()) return;
    onSendMessage(newMessage, selectedRecipient !== "Team" ? selectedRecipient : undefined);
    setNewMessage("");
  }

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ x: 400 }}
      animate={{ x: 0 }}
      exit={{ x: 400 }}
      className="fixed right-0 top-0 bottom-0 w-96 bg-white border-l shadow-2xl z-40 flex flex-col"
    >
      <div className="border-b px-4 py-3 flex items-center justify-between bg-teal-50">
        <h3 className="font-semibold text-lg">Inbox</h3>
        <button onClick={onClose} className="text-neutral-500 hover:text-neutral-900 text-xl">×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`rounded-xl p-3 ${
            msg.isKudos ? 'bg-yellow-50 border border-yellow-200' :
            msg.type === 'announcement' ? 'bg-teal-50 border border-teal-200' : 'bg-neutral-50'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <Avatar name={msg.from} size={20} />
              <span className="text-xs font-medium">{msg.from}</span>
              {msg.to && <span className="text-xs text-neutral-500">→ {msg.to}</span>}
              {msg.isKudos && <span className="text-xs">🎉</span>}
              <span className="text-xs text-neutral-400 ml-auto">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className="text-sm text-neutral-700">{msg.content}</p>
            {msg.taskLink && (
              <a href="#" className="text-xs text-teal-600 underline mt-1 block">
                View completed task →
              </a>
            )}
          </div>
        ))}
      </div>

      <div className="border-t p-4 space-y-2">
        <select
          value={selectedRecipient}
          onChange={(e) => setSelectedRecipient(e.target.value)}
          className="w-full rounded-xl border px-3 py-2 text-sm"
        >
          <option value="Team">📢 Team Chat</option>
          {TEAMMATES.filter(t => t !== userName).map((t) => (
            <option key={t} value={t}>💬 {t} (Direct Message)</option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
          />
          <button
            onClick={sendMessage}
            className="bg-teal-600 text-white rounded-xl px-4 py-2 hover:bg-teal-700 text-sm font-medium"
          >
            Send
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Sidebar
   ────────────────────────────────────────────────────────────────── */
type FounderPage = "Today" | "Meetings" | "Tasks" | "Companies" | "Playbook" | "My Team" | "Settings";
type TeamPage = "Today" | "Tasks" | "Companies" | "Playbook" | "Career Path" | "Settings";
type Page = FounderPage | TeamPage;

function Sidebar({
  role,
  active,
  onSelect,
  userName,
}: {
  role: Role;
  active: Page;
  onSelect: (p: Page) => void;
  userName: string;
}) {
  const founderNav: FounderPage[] = ["Today", "Meetings", "Tasks", "Companies", "Playbook", "My Team"];
  const teamNav: TeamPage[] = ["Today", "Tasks", "Companies", "Playbook", "Career Path"];
  const nav = isFounder(role) ? founderNav : teamNav;

  return (
    <aside className="w-72 shrink-0 border-r bg-white/90 backdrop-blur-sm sticky top-0 h-screen p-4 flex flex-col">
      <div className="text-[26px] font-semibold leading-none mb-6 tracking-tight">
        Backstage Headquarters
      </div>
      <nav className="space-y-1 text-[15px]">
        {nav.map((item) => {
          const isActive = active === item;
          return (
            <button
              key={item}
              onClick={() => onSelect(item)}
              className={`w-full text-left flex items-center justify-between rounded-xl px-3 py-2 hover:bg-teal-50 ${
                isActive ? "bg-teal-50 text-teal-900 font-medium" : ""
              }`}
            >
              <span>{item}</span>
              {item === "Today" && isActive && (
                <span className="text-[10px] rounded-full bg-teal-100 text-teal-800 px-2 py-0.5">Now</span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="mt-auto pt-6">
        <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Signed in</div>
        <button
          onClick={() => onSelect("Settings" as Page)}
          className="text-sm font-medium hover:text-teal-600 transition-colors text-left"
        >
          {userName}
        </button>
      </div>
    </aside>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Header
   ────────────────────────────────────────────────────────────────── */
function TopHeader({
  name,
  levelXP,
  levelMax,
  onSearch,
  onOpenChat,
  unreadCount,
}: {
  name: string;
  levelXP: number;
  levelMax: number;
  onSearch: (q: string) => void;
  onOpenChat: () => void;
  unreadCount: number;
}) {
  const pct = Math.min(100, Math.round((levelXP / levelMax) * 100));
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="sticky top-0 z-30 -mx-4 md:-mx-6 lg:-mx-8 -mt-4 md:-mt-6 lg:-mt-8">
      <div className="h-12 md:h-14 bg-white flex items-center justify-between px-3 md:px-4 border-b">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="text-[13px] md:text-[14px] text-neutral-900 font-medium">
            Welcome, {name}
          </div>
          <div className="hidden md:block w-[180px] h-1.5 rounded-full bg-teal-100 overflow-hidden">
            <div className="h-full bg-teal-600" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center w-[200px] md:w-[280px]">
            <input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                onSearch(e.target.value);
              }}
              className="w-full rounded-full border px-2.5 py-0.5 text-[12px] outline-none focus:ring-2 focus:ring-teal-200"
            />
          </div>
          <button
            onClick={onOpenChat}
            className="relative rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm hover:bg-teal-100 transition-colors font-medium text-teal-900"
          >
            Inbox
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-orange-500 rounded-full w-3 h-3" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Task Components
   ────────────────────────────────────────────────────────────────── */
function TaskRow({ task, onClick }: { task: DBTask; onClick: () => void }) {
  return (
    <motion.div
      layout
      onClick={onClick}
      className="group flex items-center gap-3 rounded-xl border p-3 hover:border-teal-200 transition-colors bg-white cursor-pointer"
    >
      {task.photo_url && (
        <div
          className="w-12 h-12 rounded-lg bg-cover bg-center flex-shrink-0"
          style={{ backgroundImage: `url(${task.photo_url})` }}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] md:text-[14px] font-medium truncate">{task.title}</div>
        <div className="text-xs text-neutral-500 truncate">{task.description || 'No description'}</div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <CompanyChip name={task.company_name || 'Unknown'} />
          <span className="text-[10px] px-2 py-0.5 rounded-full border bg-teal-50 text-teal-900/80">
            {task.impact}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full border bg-neutral-50 inline-flex items-center gap-1">
            <Avatar name={task.assignee_name || "Unassigned"} size={14} />
            {task.assignee_name || "Unassigned"}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function TaskList({ tasks, onTaskClick }: { tasks: DBTask[]; onTaskClick: (task: DBTask) => void }) {
  return (
    <div className="space-y-2">
      {tasks.length === 0 && (
        <div className="text-sm text-neutral-500 text-center py-8">No tasks yet</div>
      )}
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} onClick={() => onTaskClick(t)} />
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Welcome Card
   ────────────────────────────────────────────────────────────────── */
function WelcomeCard({
  name,
  doneThisWeek,
  level,
  levelXP,
  levelMax,
  className = "",
}: {
  name: string;
  doneThisWeek: number;
  level: number;
  levelXP: number;
  levelMax: number;
  className?: string;
}) {
  const pct = Math.min(100, Math.round((levelXP / levelMax) * 100));
  
  // Extract first name only
  const firstName = name.split(" ")[0];
  
  const getNameFontSize = () => {
    if (firstName.length > 12) return "text-[28px]";
    if (firstName.length > 8) return "text-[34px]";
    return "text-[40px] md:text-[44px]";
  };

  return (
    <Card variant="compact" className={`h-full ${className}`}>
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-6 pt-1 pb-4">
          <div className="flex-1 min-w-0">
            <div className="text-[12px] text-neutral-500">Welcome back</div>
            <div className={`${getNameFontSize()} font-semibold tracking-tight leading-tight`}>
              {firstName}
            </div>
          </div>
          <div className="flex-none">
            <LevelRing
              level={level}
              value={levelXP}
              max={levelMax}
              showStats={false}
              size={120}
              stroke={14}
            />
          </div>
        </div>
        <div className="mt-auto pt-2 flex flex-wrap items-center gap-2">
          <Chip>{pct}% to next level</Chip>
          <Chip>{doneThisWeek} completed this week</Chip>
        </div>
      </div>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Brand Snapshot & Companies Page
   ────────────────────────────────────────────────────────────────── */
// Smart progress calculation
function calculateCompanyProgress(companyTasks: DBTask[]) {
  if (companyTasks.length === 0) return 100; // No tasks = 100% complete!
  
  const weights = { small: 1, medium: 2, large: 3 };
  let totalPoints = 0;
  let completedPoints = 0;
  
  companyTasks.forEach(task => {
    const points = weights[task.impact];
    totalPoints += points;
    if (task.status === 'completed') {
      completedPoints += points;
    }
  });
  
  return totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;
}

function BrandSnapshot({ allTasks, onCompanyClick }: {
  allTasks: DBTask[];
  onCompanyClick: (company: string) => void;
}) {
  const buckets = COMPANIES.map((c) => {
    const companyTasks = allTasks.filter((t) => t.company_name === c);
    const open = companyTasks.filter(t => t.status !== 'completed').length;
    const progress = calculateCompanyProgress(companyTasks);
    
    return { name: c, open, progress };
  });
  
  return (
    <Card title="Brand Snapshot">
      <div className="space-y-3">
        {buckets.map((b) => (
          <div
            key={b.name}
            onClick={() => onCompanyClick(b.name)}
            className="rounded-2xl border p-4 bg-white cursor-pointer hover:border-teal-300 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="text-[15px] font-semibold flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 200 150" className="w-6 h-6 opacity-60">
                    <path d="M0,150 L50,80 L100,100 L150,40 L200,150 Z" fill="#0F766E"/>
                    <circle cx="160" cy="40" r="15" fill="#0F766E"/>
                  </svg>
                </div>
                {b.name}
              </div>
              <div className="text-xs text-neutral-600">{b.open} open</div>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-teal-100 overflow-hidden">
              <div className="h-full bg-teal-600" style={{ width: `${b.progress}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CompaniesPage({ onCompanyClick, onClientClick, onProductClick, navigateTo }: {
  onCompanyClick: (company: string) => void;
  onClientClick: (client: Client) => void;
  onProductClick: (product: Product) => void;
  navigateTo: (page: Page) => void;
}) {
  // Social icon component
  const SocialIcon = ({ platform }: { platform: string }) => {
    const letters: Record<string, string> = {
      'Instagram': 'IG',
      'Facebook': 'FB',
      'Twitter': 'TW',
      'Website': 'W',
      'TikTok': 'TT',
      'Etsy': 'ET',
      'LinkedIn': 'LI',
      'Pinterest': 'PI',
    };
    
    return (
      <div className="w-8 h-8 rounded-full border-2 border-teal-700 flex items-center justify-center text-teal-700 hover:bg-teal-50 cursor-pointer transition-colors">
        <span className="text-[9px] font-bold">{letters[platform] || platform.slice(0, 2).toUpperCase()}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {COMPANIES.map((companyName) => {
        const company = COMPANY_DATA[companyName];
        const clients = MOCK_CLIENTS.filter(c => c.company === companyName).slice(0, 4);
        const products = companyName === 'Mairé' ? MOCK_PRODUCTS.slice(0, 6) : [];
        const items = companyName === 'Mairé' ? products : clients;
        
        // Calculate progress
        const completedTasks = 0; // Mock data
        const totalTasks = 1;
        const progress = Math.round((completedTasks / totalTasks) * 100) || 45; // Mock 45%

        // Get company-specific chip colors
        const chipColors: Record<string, string> = {
          'Prose Florals': 'bg-lime-50 text-lime-900 border-lime-200',
          'Backstage': 'bg-teal-100 text-teal-900 border-teal-300',
          'Mairé': 'bg-emerald-50 text-emerald-900 border-emerald-200',
        };

        return (
          <Card
            key={companyName}
            className="border-2 border-teal-100 hover:border-teal-200 transition-colors"
            onClick={() => onCompanyClick(companyName)}
          >
            <div className="space-y-4">
              {/* Top row: Logo/Name, Progress Bar, Software, Social */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center flex-shrink-0">
                    <svg viewBox="0 0 200 150" className="w-7 h-7 opacity-60">
                      <path d="M0,150 L50,80 L100,100 L150,40 L200,150 Z" fill="#0F766E"/>
                      <circle cx="160" cy="40" r="15" fill="#0F766E"/>
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold">{companyName}</h3>
                </div>
                
                <div className="flex items-center gap-4">
                  {/* Progress bar */}
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-32 rounded-full bg-teal-100 overflow-hidden">
                      <div className="h-full bg-teal-600" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-xs text-neutral-500 w-10">{progress}%</span>
                  </div>
                  
                  {/* Software chips */}
                  <div className="flex gap-2">
                    {company.software_links.map((link, i) => (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className={`text-xs px-3 py-1 rounded-full border ${chipColors[companyName]} hover:opacity-80 transition-opacity`}
                      >
                        {link.name}
                      </a>
                    ))}
                  </div>
                  
                  {/* Social icons */}
                  <div className="flex gap-2">
                    {company.social_links.map((link, i) => (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <SocialIcon platform={link.platform} />
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              {/* Client/Product grid */}
              <div className="grid grid-cols-12 gap-2">
                {items.map((item: any) => (
                  <div
                    key={item.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      companyName === 'Mairé' ? onProductClick(item) : onClientClick(item);
                    }}
                    className={`relative rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity ${
                      companyName === 'Mairé' ? 'aspect-[3/4]' : 'aspect-[4/3]'
                    }`}
                    style={{
                      backgroundImage: `linear-gradient(135deg, #CDEDE6 0%, #B8E0D9 100%)`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    {/* Mountain placeholder icon */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg viewBox="0 0 200 150" className="w-3/4 h-3/4 opacity-30">
                        <path d="M0,150 L50,80 L100,100 L150,40 L200,150 Z" fill="#0F766E"/>
                        <circle cx="160" cy="40" r="15" fill="#0F766E"/>
                      </svg>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <p className="text-white text-xs font-medium truncate">{item.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Other Pages (simplified)
   ────────────────────────────────────────────────────────────────── */
function MyTeamPage({ tasks }: { tasks: DBTask[] }) {
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  
  const teamMembers = TEAMMATES.map(name => {
    const memberTasks = tasks.filter(t => t.assignee_name === name);
    const completed = memberTasks.filter(t => t.status === 'completed');
    const level = Math.floor(completed.length * 5 / LEVEL_XP_THRESHOLD) + 1;
    const xp = (completed.length * 5) % LEVEL_XP_THRESHOLD;
    
    return { name, level, xp, completedTasks: completed, totalTasks: memberTasks.length };
  });

  const selectedMemberData = teamMembers.find(m => m.name === selectedMember);

  return (
    <>
      <Card title="My Team" subtitle="Levels & task completion">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {teamMembers.map((m) => (
            <div
              key={m.name}
              onClick={() => setSelectedMember(m.name)}
              className="rounded-2xl border p-4 bg-white cursor-pointer hover:border-teal-300 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Avatar name={m.name} size={40} />
                  <div>
                    <div className="font-semibold">{m.name}</div>
                    <div className="text-xs text-neutral-500">{m.totalTasks} tasks</div>
                  </div>
                </div>
                <LevelRing level={m.level} value={m.xp} max={LEVEL_XP_THRESHOLD} showStats={false} size={60} stroke={8} />
              </div>
              <div className="flex gap-2">
                <Chip>{m.completedTasks.length} completed</Chip>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Modal
        isOpen={!!selectedMember}
        onClose={() => setSelectedMember(null)}
        title={`${selectedMember}'s Completed Tasks`}
        size="large"
      >
        {selectedMemberData && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name={selectedMemberData.name} size={60} />
              <div className="flex-1">
                <h3 className="text-xl font-semibold">{selectedMemberData.name}</h3>
                <p className="text-sm text-neutral-600">
                  Level {selectedMemberData.level} • {selectedMemberData.completedTasks.length} tasks completed
                </p>
              </div>
              <LevelRing
                level={selectedMemberData.level}
                value={selectedMemberData.xp}
                max={LEVEL_XP_THRESHOLD}
                size={100}
                stroke={12}
              />
            </div>
            
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Completed Tasks</h4>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {selectedMemberData.completedTasks.map((task) => (
                  <div key={task.id} className="rounded-xl border p-3 bg-neutral-50">
                    <div className="font-medium text-sm">{task.title}</div>
                    <div className="text-xs text-neutral-500 mt-1">
                      {task.company_name} • {task.impact} impact • {XP_BY_IMPACT[task.impact]} XP
                    </div>
                  </div>
                ))}
                {selectedMemberData.completedTasks.length === 0 && (
                  <div className="text-sm text-neutral-500 text-center py-8">
                    No completed tasks yet
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function MeetingsPage() {
  const [agenda, setAgenda] = useState("");

  return (
    <div className="space-y-6">
      <Card title="Upcoming Meetings" subtitle="Next 7 days">
        <div className="space-y-2">
          <div className="rounded-xl border p-3 bg-white flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Ops Standup</div>
              <div className="text-xs text-neutral-500">Tue 11:30 AM • Backstage</div>
            </div>
            <button className="text-xs rounded-xl border px-2 py-1 hover:border-teal-300">
              Open agenda
            </button>
          </div>
          <div className="rounded-xl border p-3 bg-white flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Client Onboarding</div>
              <div className="text-xs text-neutral-500">Thu 2:00 PM • Prose Florals</div>
            </div>
            <button className="text-xs rounded-xl border px-2 py-1 hover:border-teal-300">
              Checklist
            </button>
          </div>
        </div>
      </Card>

      <Card title="Meeting Agenda & Notes">
        <textarea
          className="w-full min-h-[200px] rounded-xl border p-3 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
          placeholder="Add meeting notes and agenda items here...

• Topic 1
• Topic 2
• Action items"
          value={agenda}
          onChange={(e) => setAgenda(e.target.value)}
        />
        <button className="mt-3 bg-teal-600 text-white rounded-xl px-4 py-2 hover:bg-teal-700 text-sm font-medium">
          Save to Google Doc
        </button>
      </Card>
    </div>
  );
}

function SettingsPage({ userName }: { userName: string }) {
  return (
    <div className="space-y-6">
      <Card title="Account Settings">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-neutral-700">Display Name</label>
            <input
              type="text"
              defaultValue={userName}
              className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700">Email</label>
            <input
              type="email"
              defaultValue="sierra@backstageop.com"
              className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
            />
          </div>
          <button className="bg-teal-600 text-white rounded-xl px-4 py-2 hover:bg-teal-700 text-sm font-medium">
            Save Changes
          </button>
        </div>
      </Card>

      <Card title="Notifications">
        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input type="checkbox" defaultChecked className="w-4 h-4 accent-teal-600" />
            <span className="text-sm">Email notifications for task assignments</span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" defaultChecked className="w-4 h-4 accent-teal-600" />
            <span className="text-sm">Daily digest of team activity</span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" className="w-4 h-4 accent-teal-600" />
            <span className="text-sm">Browser notifications for new messages</span>
          </label>
        </div>
      </Card>

      <Card title="Danger Zone">
        <button className="text-red-600 border border-red-200 rounded-xl px-4 py-2 hover:bg-red-50 text-sm font-medium">
          Sign Out
        </button>
      </Card>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Accomplishments Modal (NEW!)
   ────────────────────────────────────────────────────────────────── */
function AddAccomplishmentModal({ isOpen, onClose, userName, onAdd }: {
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
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Shipped Q3 client presentation..."
            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm min-h-[100px] focus:ring-2 focus:ring-teal-200 outline-none"
          />
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={postToTeam}
            onChange={(e) => setPostToTeam(e.target.checked)}
            className="w-4 h-4 accent-teal-600"
          />
          <span className="text-sm text-neutral-700">Post to Team Chat</span>
        </label>

        <div className="flex gap-3 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-xl hover:bg-neutral-50 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!text.trim()}
            className="flex-1 bg-teal-600 text-white rounded-xl px-4 py-2 hover:bg-teal-700 font-medium text-sm disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Kudos Modal (NEW!)
   ────────────────────────────────────────────────────────────────── */
function KudosModal({ isOpen, onClose, task, onSend }: {
  isOpen: boolean;
  onClose: () => void;
  task: DBTask | null;
  onSend: (message: string) => void;
}) {
  const [kudosText, setKudosText] = useState("");

  function handleSend() {
    onSend(kudosText);
    setKudosText("");
    onClose();
  }

  if (!task) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Task Approved! ✓" size="medium">
      <div className="space-y-4">
        <div className="bg-teal-50 rounded-xl p-4 border border-teal-200">
          <div className="text-sm font-medium text-teal-900">
            {task.title}
          </div>
          <div className="text-xs text-teal-700 mt-1">
            Completed by {task.assignee_name}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700 block mb-2">
            Send kudos to {task.assignee_name}? (Optional)
          </label>
          <textarea
            value={kudosText}
            onChange={(e) => setKudosText(e.target.value)}
            placeholder="Great work on... (this will be sent as a direct message)"
            className="w-full rounded-xl border px-3 py-2 text-sm min-h-[100px] focus:ring-2 focus:ring-teal-200 outline-none"
          />
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button
            onClick={() => {
              onSend("");
              onClose();
            }}
            className="px-4 py-2 border rounded-xl hover:bg-neutral-50 text-sm"
          >
            Skip
          </button>
          <button
            onClick={handleSend}
            className="flex-1 bg-teal-600 text-white rounded-xl px-4 py-2 hover:bg-teal-700 font-medium text-sm"
          >
            {kudosText ? "Send Kudos & Approve" : "Approve Without Message"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Main App Component
   ────────────────────────────────────────────────────────────────── */
export default function DashboardApp() {
  const session = useSession();
  const { profile } = useProfile();
  const { tasks, loading: tasksLoading, refetch } = useTasks({ status: ['focus', 'active', 'submitted'] });
  
  const [celebrate, setCelebrate] = useState(false);
  const [page, setPage] = useState<Page>("Today");
  const [selectedTask, setSelectedTask] = useState<DBTask | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showKudosModal, setShowKudosModal] = useState(false);
  const [kudosTask, setKudosTask] = useState<DBTask | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [showAddAccomplishment, setShowAddAccomplishment] = useState(false);
  const [accomplishments, setAccomplishments] = useState<Accomplishment[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [taskFilters, setTaskFilters] = useState({
    company: "all",
    impact: "all",
    priority: "all",
    status: "all",
    assignee: "all",
  });
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const role: Role = profile?.role ? fromDbToUi[profile.role as AppRole] : "Founder";
  const level = profile?.level || 1;
  const xp = profile?.xp || 0;
  const userName = session?.user?.user_metadata?.full_name ?? 
                   session?.user?.email?.split("@")[0] ?? 
                   "Sierra";

  const completedThisWeek = tasks.filter(t => t.status === 'completed').length;

  const filteredTasks = tasks.filter(t => {
    // Search filter
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Company filter
    const matchesCompany = taskFilters.company === "all" || t.company_name === taskFilters.company;
    
    // Impact filter
    const matchesImpact = taskFilters.impact === "all" || t.impact === taskFilters.impact;
    
    // Priority filter
    const matchesPriority = taskFilters.priority === "all" || t.priority === taskFilters.priority;
    
    // Status filter
    const matchesStatus = taskFilters.status === "all" || t.status === taskFilters.status;
    
    // Assignee filter (only for founders)
    const matchesAssignee = taskFilters.assignee === "all" || t.assignee_name === taskFilters.assignee;
    
    return matchesSearch && matchesCompany && matchesImpact && matchesPriority && matchesStatus && matchesAssignee;
  });

  const focusTasks = filteredTasks.filter(t => t.status === 'focus');
  const activeTasks = filteredTasks.filter(t => t.status === 'active');
  const submittedTasks = filteredTasks.filter(t => t.status === 'submitted');
  const allActiveTasks = [...focusTasks, ...activeTasks];

  async function handleComplete(task: DBTask) {
    const success = await dbCompleteTask(task.id);
    if (success) {
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 1500);
      refetch();
    }
  }

  async function handleApprove(task: DBTask) {
    setKudosTask(task);
    setShowKudosModal(true);
  }

  function handleSendKudos(kudosText: string) {
    if (!kudosTask) return;
    
    // Complete the task
    dbUpdateTask(kudosTask.id, { status: 'completed' });
    
    // Send kudos as DM if provided
    if (kudosText) {
      const kudosMessage: Message = {
        id: Date.now().toString(),
        from: userName,
        to: kudosTask.assignee_name || undefined,
        content: kudosText,
        timestamp: Date.now(),
        type: 'dm',
        read: false,
        isKudos: true,
        taskLink: kudosTask.id,
      };
      setMessages([...messages, kudosMessage]);
      setHasUnreadMessages(true);
    }
    
    refetch();
    setKudosTask(null);
  }

  function handleAddAccomplishment(text: string, postToTeam: boolean) {
    const accomplishment: Accomplishment = {
      id: Date.now().toString(),
      user: userName,
      text,
      timestamp: Date.now(),
      postedToTeam: postToTeam,
    };
    
    setAccomplishments([...accomplishments, accomplishment]);
    
    // If posting to team, add message and show notification
    if (postToTeam) {
      const teamMsg: Message = {
        id: Date.now().toString() + '-team',
        from: userName,
        content: `🎉 ${text}`,
        timestamp: Date.now(),
        type: 'team',
        read: false,
      };
      setMessages([...messages, teamMsg]);
      setHasUnreadMessages(true);
    }
  }

  function handleSendMessage(content: string, to?: string) {
    const messageType: 'dm' | 'team' = to ? 'dm' : 'team';
    const msg: Message = {
      id: Date.now().toString(),
      from: userName,
      to,
      content,
      timestamp: Date.now(),
      type: messageType,
      read: false,
    };
    setMessages([...messages, msg]);
    if (to) {
      setHasUnreadMessages(true);
    }
  }

  function openTaskModal(task: DBTask) {
    setSelectedTask(task);
    setShowTaskModal(true);
  }

  function handleCompanyClick(companyName: string) {
    setSelectedCompany(companyName);
    if (page !== "Companies") {
      setPage("Companies" as Page);
      setTimeout(() => setSelectedCompany(companyName), 100);
    }
  }

  const equalCardH = "h-[360px]";

  function TodayFounder() {
    return (
      <>
        <div className="grid grid-cols-12 gap-4 items-stretch">
          <div className="col-span-12 md:col-span-4">
            <WelcomeCard
              name={userName}
              doneThisWeek={completedThisWeek}
              level={level}
              levelXP={xp}
              levelMax={LEVEL_XP_THRESHOLD}
              className="h-full"
            />
          </div>
          <div className="col-span-12 md:col-span-8">
            <Card title="Notes" variant="compact" className="h-full flex flex-col">
              <div className="flex-1">
                <textarea
                  className="w-full h-full min-h-[80px] rounded-xl border p-3 text-sm resize-none"
                  placeholder="Quick note…"
                />
              </div>
              <div className="mt-3 flex justify-end">
                <button className="rounded-full bg-teal-600 text-white px-4 py-1.5 hover:bg-teal-700 text-sm font-medium">
                  Save to Google Doc
                </button>
              </div>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-6">
            <section
              className="rounded-2xl p-4 md:p-5 shadow-sm border-2 bg-[#ECF7F3]"
              style={{ borderColor: "#0F766E" }}
            >
              <header className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-[15px] font-semibold leading-tight">Today's Focus</h2>
                  <p className="text-xs text-neutral-600">Smartly chosen by due date, priority & quick wins</p>
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="rounded-full border-2 border-teal-600 bg-white text-teal-600 px-3 py-1 hover:bg-teal-50 text-xs font-medium"
                >
                  NEW
                </button>
              </header>
              <div className="relative h-[300px] overflow-y-auto pr-1">
                <TaskList tasks={focusTasks} onTaskClick={openTaskModal} />
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[#ECF7F3] to-transparent" />
              </div>
            </section>
          </div>

          <div className="col-span-12 md:col-span-6">
            <Card title="Submitted for Approval" subtitle="Approve or return with notes" className={`${equalCardH} flex flex-col`}>
              <div className="relative flex-1 overflow-y-auto pr-1">
                <div className="space-y-2">
                  {submittedTasks.length === 0 && (
                    <div className="text-xs text-neutral-500">Nothing pending.</div>
                  )}
                  {submittedTasks.map((t) => (
                    <div
                      key={t.id}
                      className="rounded-xl border p-3 flex items-center justify-between gap-3 bg-white"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer" onClick={() => openTaskModal(t)}>
                        <Avatar name={t.assignee_name || "Unassigned"} size={22} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{t.title}</div>
                          <div className="text-xs text-neutral-500">
                            {t.company_name} {t.assignee_name ? `• @${t.assignee_name}` : ""}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs flex gap-2">
                        <button
                          className="rounded-xl border px-2 py-1 hover:border-teal-300"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApprove(t);
                          }}
                        >
                          Approve
                        </button>
                        <button
                          className="rounded-xl border px-2 py-1 hover:border-teal-300"
                          onClick={(e) => {
                            e.stopPropagation();
                            const note = prompt("Add a note:", "Please revise and resubmit");
                            if (note) {
                              dbUpdateTask(t.id, { 
                                status: 'active',
                                description: `${t.description}\n\nReturned: ${note}`
                              });
                              refetch();
                            }
                          }}
                        >
                          Re-assign
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-4">
            <div className={equalCardH}>
              <BrandSnapshot allTasks={allActiveTasks} onCompanyClick={handleCompanyClick} />
            </div>
          </div>
          <div className="col-span-12 md:col-span-4">
            <Card title="Company Goals" subtitle="Company & Role" className={equalCardH}>
              <div className="space-y-3">
                {[
                  { label: "Q1 MRR", value: 62 },
                  { label: "Ops SLAs", value: 78 },
                  { label: "VA playbook", value: 40 },
                ].map((g) => (
                  <div key={g.label} className="rounded-xl border p-4 hover:border-teal-200 transition-colors bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">{g.label}</div>
                      <div className="text-xs text-neutral-500">{g.value}%</div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-teal-100 overflow-hidden">
                      <div className="h-full bg-teal-600" style={{ width: `${g.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <div className="col-span-12 md:col-span-4">
            <Card className={`${equalCardH} flex flex-col`}>
              <div className="flex items-center justify-between mb-3 flex-shrink-0 relative z-20">
                <div>
                  <h2 className="text-[14px] md:text-[15px] font-semibold leading-tight">Accomplishments</h2>
                  <p className="text-xs md:text-[13px] text-neutral-500">Celebrate wins</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowAddAccomplishment(true); }}
                  className="rounded-full bg-teal-600 relative z-30 cursor-pointer pointer-events-auto text-white px-3 py-1 hover:bg-teal-700 text-xs font-medium"
                >
                  Add
                </button>
              </div>
              <div className="space-y-3 overflow-y-auto flex-1">
                {accomplishments.slice(-5).reverse().map((acc) => (
                  <div key={acc.id} className="rounded-xl border p-3 bg-white">
                    <div className="text-sm font-medium">{acc.text}</div>
                    <div className="text-xs text-neutral-500 mt-1">
                      {acc.user} • {new Date(acc.timestamp).toLocaleDateString()}
                      {acc.postedToTeam && " • Posted to team"}
                    </div>
                  </div>
                ))}
                {accomplishments.length === 0 && (
                  <div className="rounded-xl border p-3 bg-white">
                    <div className="text-sm text-neutral-500 text-center py-4">
                      No accomplishments yet - add your first one!
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </>
    );
  }

  function TodayTeam() {
    const myTasks = filteredTasks.filter(t => t.assignee_name === userName);
    
    return (
      <>
        <div className="grid grid-cols-12 gap-4 items-stretch">
          <div className="col-span-12 md:col-span-4">
            <WelcomeCard
              name={userName}
              doneThisWeek={completedThisWeek}
              level={level}
              levelXP={xp}
              levelMax={LEVEL_XP_THRESHOLD}
              className="h-full"
            />
          </div>
          <div className="col-span-12 md:col-span-8">
            <Card title="Notes" variant="compact" className="h-full flex flex-col">
              <div className="flex-1">
                <textarea
                  className="w-full h-full min-h-[80px] rounded-xl border p-3 text-sm resize-none"
                  placeholder="Quick note…"
                />
              </div>
              <div className="mt-3 flex justify-end">
                <button className="rounded-full bg-teal-600 text-white px-4 py-1.5 hover:bg-teal-700 text-sm font-medium">
                  Save to Google Doc
                </button>
              </div>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-6">
            <section
              className="rounded-2xl p-4 md:p-5 shadow-sm border-2 bg-[#ECF7F3]"
              style={{ borderColor: "#0F766E" }}
            >
              <header className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-[15px] font-semibold leading-tight">Today's Focus</h2>
                  <p className="text-xs text-neutral-600">Your top priorities</p>
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="rounded-full border-2 border-teal-600 bg-white text-teal-600 px-3 py-1 hover:bg-teal-50 text-xs font-medium"
                >
                  NEW
                </button>
              </header>
              <div className="relative h-[300px] overflow-y-auto pr-1">
                <TaskList tasks={focusTasks.filter(t => t.assignee_name === userName)} onTaskClick={openTaskModal} />
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[#ECF7F3] to-transparent" />
              </div>
            </section>
          </div>

          <div className="col-span-12 md:col-span-6">
            <Card title="Full Task List" subtitle="Everything on your plate" className={`${equalCardH} flex flex-col`}>
              <div className="mb-3">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="text-xs bg-teal-600 text-white rounded-xl px-3 py-1.5 hover:bg-teal-700 font-medium"
                >
                  ➕ Add Task
                </button>
              </div>
              <div className="relative flex-1 overflow-y-auto pr-1">
                <TaskList tasks={myTasks} onTaskClick={openTaskModal} />
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white to-transparent" />
              </div>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-4">
            <Card title="Submitted for Approval" subtitle="Waiting on founder" className={`${equalCardH} flex flex-col`}>
              <div className="relative flex-1 overflow-y-auto pr-1">
                <div className="space-y-2">
                  {submittedTasks.filter(t => t.assignee_name === userName).length === 0 && (
                    <div className="text-xs text-neutral-500">You have no pending submissions.</div>
                  )}
                  {submittedTasks.filter(t => t.assignee_name === userName).map((t) => (
                    <div
                      key={t.id}
                      onClick={() => openTaskModal(t)}
                      className="rounded-xl border p-3 flex items-center justify-between gap-3 bg-white cursor-pointer hover:border-teal-300"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar name={t.assignee_name || "You"} size={22} />
                        <div>
                          <div className="text-sm font-medium">{t.title}</div>
                          <div className="text-xs text-neutral-500">{t.company_name} • Pending</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
          <div className="col-span-12 md:col-span-4">
            <Card title="Company Goals" subtitle="Company & Role" className={equalCardH}>
              <div className="space-y-3">
                {[
                  { label: "Q1 MRR", value: 62 },
                  { label: "Ops SLAs", value: 78 },
                  { label: "VA playbook", value: 40 },
                ].map((g) => (
                  <div key={g.label} className="rounded-xl border p-4 hover:border-teal-200 transition-colors bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">{g.label}</div>
                      <div className="text-xs text-neutral-500">{g.value}%</div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-teal-100 overflow-hidden">
                      <div className="h-full bg-teal-600" style={{ width: `${g.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <div className="col-span-12 md:col-span-4">
            <Card className={`${equalCardH} flex flex-col`}>
              <div className="flex items-center justify-between mb-3 flex-shrink-0 relative z-20">
                <div>
                  <h2 className="text-[14px] md:text-[15px] font-semibold leading-tight">Accomplishments</h2>
                  <p className="text-xs md:text-[13px] text-neutral-500">Celebrate wins</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowAddAccomplishment(true); }}
                  className="rounded-full bg-teal-600 relative z-30 cursor-pointer pointer-events-auto text-white px-3 py-1 hover:bg-teal-700 text-xs font-medium"
                >
                  Add
                </button>
              </div>
              <div className="space-y-3 overflow-y-auto flex-1">
                {accomplishments.slice(-5).reverse().map((acc) => (
                  <div key={acc.id} className="rounded-xl border p-3 bg-white">
                    <div className="text-sm font-medium">{acc.text}</div>
                    <div className="text-xs text-neutral-500 mt-1">
                      {new Date(acc.timestamp).toLocaleDateString()}
                      {acc.postedToTeam && " • Posted to team"}
                    </div>
                  </div>
                ))}
                {accomplishments.length === 0 && (
                  <div className="rounded-xl border p-3 bg-white">
                    <div className="text-sm text-neutral-500 text-center py-4">
                      No accomplishments yet - add your first one!
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </>
    );
  }

  if (tasksLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-neutral-500">Loading your workspace...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 relative text-[15px]">
      <Confetti fire={celebrate} />
      <div className="flex">
        <Sidebar role={role} active={page} onSelect={setPage as any} userName={userName} />
        <main className="flex-1 p-4 md:p-6 lg:p-8 pt-0 space-y-6">
          <TopHeader
            name={userName}
            levelXP={xp}
            levelMax={LEVEL_XP_THRESHOLD}
            onSearch={setSearchQuery}
            onOpenChat={() => {
              setShowChat(true);
              setHasUnreadMessages(false);
            }}
            unreadCount={hasUnreadMessages ? 1 : 0}
          />

          {page === "Today" && (isFounder(role) ? <TodayFounder /> : <TodayTeam />)}
          {page === "Meetings" && isFounder(role) && <MeetingsPage />}
          {page === "Tasks" && (
            <div className="space-y-4">
              <Card title="Filters">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <select
                    value={taskFilters.company}
                    onChange={(e) => setTaskFilters({...taskFilters, company: e.target.value})}
                    className="rounded-xl border px-3 py-2 text-sm"
                  >
                    <option value="all">All Companies</option>
                    {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  
                  <select
                    value={taskFilters.impact}
                    onChange={(e) => setTaskFilters({...taskFilters, impact: e.target.value})}
                    className="rounded-xl border px-3 py-2 text-sm"
                  >
                    <option value="all">All Levels</option>
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                  
                  <select
                    value={taskFilters.priority}
                    onChange={(e) => setTaskFilters({...taskFilters, priority: e.target.value})}
                    className="rounded-xl border px-3 py-2 text-sm"
                  >
                    <option value="all">All Priorities</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                  
                  <select
                    value={taskFilters.status}
                    onChange={(e) => setTaskFilters({...taskFilters, status: e.target.value})}
                    className="rounded-xl border px-3 py-2 text-sm"
                  >
                    <option value="all">All Statuses</option>
                    <option value="focus">Focus</option>
                    <option value="active">Active</option>
                    <option value="submitted">Submitted</option>
                    <option value="completed">Completed</option>
                  </select>
                  
                  {isFounder(role) && (
                    <select
                      value={taskFilters.assignee}
                      onChange={(e) => setTaskFilters({...taskFilters, assignee: e.target.value})}
                      className="rounded-xl border px-3 py-2 text-sm"
                    >
                      <option value="all">All Team Members</option>
                      {TEAMMATES.map(t => <option key={t} value={t}>{t}</option>)}
                      <option value="">Unassigned</option>
                    </select>
                  )}
                </div>
                
                <button
                  onClick={() => setTaskFilters({
                    company: "all",
                    impact: "all",
                    priority: "all",
                    status: "all",
                    assignee: "all",
                  })}
                  className="mt-3 text-xs text-teal-600 hover:text-teal-700 underline"
                >
                  Clear all filters
                </button>
              </Card>

              <Card title="All Tasks">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mb-4 rounded-full border-2 border-teal-600 bg-white text-teal-600 px-4 py-2 hover:bg-teal-50 text-sm font-medium"
                >
                  NEW
                </button>
                <TaskList tasks={filteredTasks} onTaskClick={openTaskModal} />
              </Card>
            </div>
          )}
          {page === "Companies" && (
            <CompaniesPage
              onCompanyClick={setSelectedCompany}
              onClientClick={setSelectedClient}
              onProductClick={setSelectedProduct}
              navigateTo={setPage as any}
            />
          )}
          {page === "My Team" && isFounder(role) && <MyTeamPage tasks={tasks} />}
          {page === "Settings" && <SettingsPage userName={userName} />}
          {page === "Career Path" && !isFounder(role) && (
            <Card title="Career Path" subtitle="Your progress">
              <LevelRing level={level} value={xp} max={LEVEL_XP_THRESHOLD} />
            </Card>
          )}
          {page === "Playbook" && (
            <Card title="Playbook" subtitle="SOPs and guides">
              <div className="text-sm text-neutral-500">Coming soon with database integration</div>
            </Card>
          )}
        </main>
      </div>

      <TaskModal
        task={selectedTask}
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        onComplete={() => selectedTask && handleComplete(selectedTask)}
        role={role}
      />

      <TaskCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={refetch}
        role={role}
        userName={userName}
      />

      <CompanyModal
        companyName={selectedCompany}
        isOpen={!!selectedCompany}
        onClose={() => setSelectedCompany(null)}
        onClientClick={setSelectedClient}
        onProductClick={setSelectedProduct}
      />

      <ClientModal
        client={selectedClient}
        isOpen={!!selectedClient}
        onClose={() => setSelectedClient(null)}
      />

      <ProductModal
        product={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />

      <AnimatePresence>
        {showAddAccomplishment && (
          <AddAccomplishmentModal
            isOpen={showAddAccomplishment}
            onClose={() => setShowAddAccomplishment(false)}
            userName={userName}
            onAdd={handleAddAccomplishment}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showKudosModal && (
          <KudosModal
            isOpen={showKudosModal}
            onClose={() => setShowKudosModal(false)}
            task={kudosTask}
            onSend={handleSendKudos}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showChat && (
          <ChatPanel
            userName={userName}
            isOpen={showChat}
            onClose={() => setShowChat(false)}
            messages={messages}
            onSendMessage={handleSendMessage}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
