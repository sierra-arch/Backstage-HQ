// DashboardApp.tsx - COMPLETE MULTI-BRAND VERSION
// ✨ Full client/product management, cover photos, smart navigation
import "./styles.css";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "./supabase";
import {
  useTasks,
  useProfile,
  useTeamMembers,
  useCompanies,
  useClients,
  useProducts,
  useSOPs,
  usePendingApprovals,
  useMessages,
  createTask as dbCreateTask,
  updateTask as dbUpdateTask,
  completeTask as dbCompleteTask,
  getCompanyByName,
  saveClient,
  saveProduct,
  saveSOP,
  syncProductWithEtsy,
  sendMessage,
  markMessagesFromUserAsRead,
  approvePendingChange,
  rejectPendingChange,
  resolveProfileIdByName,
  useProjects,
  createProject,
  updateProject,
  type Project,
  useBrandKit,
  saveBrandKit,
  fetchDocumentTemplates,
  createProposal,
  markProposalSent,
  useProposals,
  fetchPaymentScheduleForProposal,
  fetchDeliverablesForProject,
  createDeliverable,
  markDeliverableDelivered,
  setDeliverableVisibility,
  fetchComments,
  postTeamComment,
  type DocumentTemplate,
  type PaymentInstallment,
  type ProposalWithDocument,
  type Company,
  type Deliverable,
  type Comment,
} from "./useDatabase";
import { OnboardingWizard } from "./OnboardingWizard";
import {
  computeDocumentTotals,
  getDesignBriefSection,
  getLineItemSections,
} from "../api/_lib/proposalEngine";
import { AssistantChat } from "./AssistantChat";

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
const XP_BY_IMPACT = { small: 5, medium: 10, large: 20 } as const;
const LEVEL_XP_THRESHOLD = 200;

// Auto-calculate time estimates from level
const TIME_BY_LEVEL = { small: 20, medium: 45, large: 90 } as const;

type DBTask = {
  id: string;
  title: string;
  description: string | null;
  company_id: string | null;
  client_id?: string | null;
  client_visible?: boolean;
  assigned_to: string | null;
  status: "focus" | "active" | "submitted" | "completed" | "archived";
  priority: "low" | "medium" | "high";
  impact: "small" | "medium" | "large";
  estimate_minutes: number;
  company_name?: string;
  assignee_name?: string;
  due_date?: string | null;
  photo_url?: string | null;
  completed_at?: string | null;
  metadata?: { auto_created?: boolean; trigger?: string } | null;
  // recurring?: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly'; // TODO: Add to DB schema
};

type Client = {
  id: string;
  company: string;
  company_id: string | null;
  name: string;
  photo_url: string;
  description: string;
  contact: string;
  scope: string;
  quick_links: string[];
  deadline?: string;
  added_date: string;
  stage: "lead" | "proposal_sent" | "active" | "delivered" | "archived";
  track: "freelancer" | "founder_mini" | "founder_full" | "ceo" | null;
};

type Product = {
  id: string;
  name: string;
  photo_url: string;
  description: string;
  price: number | null;
  status: string | null;
  quick_links: string[] | null;
  launch_date: string | null;
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
  from_user_id: string;
  to_user_id: string | null;
  content: string;
  message_type: "team" | "dm" | "kudos";
  is_kudos: boolean;
  related_task_id: string | null;
  is_read: boolean;
  created_at: string;
  from_name?: string;
  to_name?: string;
};

type Accomplishment = {
  id: string;
  user: string;
  text: string;
  timestamp: number;
  postedToTeam: boolean;
};

// Mock data - will be replaced with database
const COMPANY_DATA: Record<string, CompanyData> = {
  "Prose Florals": {
    name: "Prose Florals",
    logo_url: "🌸",
    description: "High-touch creative floral design for weddings and events",
    color: "#84cc16",
    social_links: [
      { platform: "Instagram", url: "https://instagram.com/proseflorals" },
      { platform: "Website", url: "https://proseflorals.com" },
    ],
    software_links: [
      { name: "Honeybook", url: "https://honeybook.com" },
      { name: "Canva", url: "https://canva.com" },
    ],
  },
  Backstage: {
    name: "Backstage",
    logo_url: "🎯",
    description: "Business operations systems and strategic consulting",
    color: "#14b8a6",
    social_links: [
      { platform: "LinkedIn", url: "https://linkedin.com/company/backstage" },
      { platform: "Website", url: "https://backstageop.com" },
    ],
    software_links: [
      { name: "Notion", url: "https://notion.so" },
      { name: "Airtable", url: "https://airtable.com" },
    ],
  },
  Mairé: {
    name: "Mairé",
    logo_url: "✨",
    description: "Handcrafted botanical products and pressed flower art",
    color: "#10b981",
    social_links: [
      { platform: "Etsy", url: "https://etsy.com/shop/maire" },
      { platform: "TikTok", url: "https://tiktok.com/@maire" },
    ],
    software_links: [
      { name: "Etsy Seller", url: "https://etsy.com/seller" },
      { name: "Shipstation", url: "https://shipstation.com" },
    ],
  },
};

/* ──────────────────────────────────────────────────────────────────
   Confetti
   ────────────────────────────────────────────────────────────────── */
function Confetti({ fire }: { fire: boolean }) {
  if (!fire) return null;
  return (
    <div
      style={{ pointerEvents: "none", position: "fixed", inset: 0, zIndex: 60 }}
    >
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
      className={`rounded-3xl border border-neutral-200/80 bg-white ${
        variant === "compact" ? "p-4 md:p-5" : "p-5 md:p-6"
      } shadow-sm ${className} ${
        onClick ? "cursor-pointer hover:border-teal-300 transition-colors" : ""
      }`}
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
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        stroke="#CDEDE6"
        fill="none"
      />
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
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize={Math.max(12, Math.round(size * 0.18))}
        fill="#0F172A"
      >
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

function CompanyChip({
  name,
  showLogo = true,
}: {
  name: string;
  showLogo?: boolean;
}) {
  const map: any = {
    "Prose Florals": {
      bg: "bg-lime-50",
      text: "text-lime-900/80",
      border: "border-lime-200",
      logo: "🌸",
    },
    Backstage: {
      bg: "bg-teal-100",
      text: "text-teal-900/90",
      border: "border-teal-300",
      logo: "🎯",
    },
    Mairé: {
      bg: "bg-emerald-50",
      text: "text-emerald-900/80",
      border: "border-emerald-200",
      logo: "✨",
    },
  };
  const s = map[name] || {
    bg: "bg-neutral-50",
    text: "text-neutral-800",
    border: "border-neutral-200",
    logo: "📦",
  };
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full border ${s.bg} ${s.text} ${s.border} inline-flex items-center gap-1`}
    >
      {showLogo && <span>{s.logo}</span>}
      {name}
    </span>
  );
}

function Avatar({
  name,
  size = 24,
  photoUrl,
}: {
  name: string;
  size?: number;
  photoUrl?: string;
}) {
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

  const initials = name
    .split(" ")
    .map((s) => s[0]?.toUpperCase())
    .join("")
    .slice(0, 2);
  const palette = ["#0F766E", "#166534", "#065F46", "#064E3B", "#0B4D4B"];
  const color =
    palette[
      (name.charCodeAt(0) + name.charCodeAt(name.length - 1)) % palette.length
    ];
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
function Modal({
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
function TaskCommentThread({ task, profileId }: { task: DBTask; profileId?: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  const load = () => {
    fetchComments({ taskId: task.id }).then(setComments);
  };

  useEffect(() => {
    load();
  }, [task.id]);

  async function handlePost() {
    if (!body.trim() || !profileId || !task.client_id) return;
    setPosting(true);
    await postTeamComment({ clientId: task.client_id, taskId: task.id, authorProfileId: profileId, body: body.trim() });
    setBody("");
    setPosting(false);
    load();
  }

  return (
    <div className="border-t pt-4">
      <label className="text-sm font-medium text-neutral-700">Client Comments</label>
      <div className="space-y-2 mt-2">
        {comments.length === 0 && <p className="text-sm text-neutral-400">No comments yet.</p>}
        {comments.map((c) => (
          <div
            key={c.id}
            className={`rounded-2xl p-3 text-sm ${
              c.author_type === "client" ? "bg-teal-50 text-teal-900" : "bg-neutral-100 text-neutral-700"
            }`}
          >
            <p className="text-xs font-medium mb-1 opacity-70">{c.author_type === "client" ? "Client" : "Team"}</p>
            {c.body}
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Reply to the client…"
          className="flex-1 rounded-full border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
        />
        <button
          onClick={handlePost}
          disabled={!body.trim() || posting}
          className="rounded-full bg-teal-600 text-white px-4 py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}

function TaskModal({
  task,
  isOpen,
  onClose,
  onComplete,
  role,
  profileId,
}: {
  task: DBTask | null;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  role: Role;
  profileId?: string;
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

        {task.client_id && <TaskCommentThread task={task} profileId={profileId} />}

        <div className="flex gap-3 pt-4 border-t">
          <button
            onClick={() => {
              onComplete();
              onClose();
            }}
            className="flex-1 bg-teal-600 text-white rounded-full px-4 py-2 hover:bg-teal-700 font-medium"
          >
            {buttonText}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-full hover:bg-neutral-50"
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
function TaskCreateModal({
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
  const [projectId, setProjectId] = useState("");
  const { projects } = useProjects();

  async function handleCreate() {
    const companyData = await getCompanyByName(company);

    // Auto-calculate estimate from level
    const estimate = TIME_BY_LEVEL[level];

    const assignedTo = assignee ? await resolveProfileIdByName(assignee) : null;

    await dbCreateTask({
      title,
      description,
      company_id: companyData?.id,
      assigned_to: assignedTo,
      project_id: projectId || null,
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
    setProjectId("");

    onCreated();
    onClose();
  }

  // Team members can only assign to self or Founder
  const teamMemberNames = teamMembers.map(tm => tm.display_name || "Unknown");
  const assignOptions = isFounder(role)
    ? ["", ...teamMemberNames]
    : [userName, "Founder"];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Task"
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
            className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
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
            className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm min-h-[100px] focus:ring-2 focus:ring-teal-200 outline-none"
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
              onChange={(e) => setCompany(e.target.value)}
              className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
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
              className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
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
              className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
            >
              <option value="small">Small (~{TIME_BY_LEVEL.small} min)</option>
              <option value="medium">
                Medium (~{TIME_BY_LEVEL.medium} min)
              </option>
              <option value="large">Large (~{TIME_BY_LEVEL.large} min)</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700">
              Recurring
            </label>
            <select
              value={recurring}
              onChange={(e) => setRecurring(e.target.value as any)}
              className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
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
          <label className="text-sm font-medium text-neutral-700">
            Deadline (Optional)
          </label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700">
            Project (Optional)
          </label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700">
            Photo (Optional)
          </label>
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
            className="flex-1 bg-teal-600 text-white rounded-full px-4 py-2 hover:bg-teal-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Task
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-full hover:bg-neutral-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}


/* ──────────────────────────────────────────────────────────────────
   Create Client / Product (Founder only)
   ────────────────────────────────────────────────────────────────── */
function CreateClientModal({
  isOpen,
  onClose,
  companyName,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  companyName: string | null;
  onCreated: () => void;
}) {
  const [name, setName] = React.useState("");
  const [contactEmail, setContactEmail] = React.useState("");
  const [contactPhone, setContactPhone] = React.useState("");
  const [photoUrl, setPhotoUrl] = React.useState("");
  const [description, setDescription] = React.useState("");

  useEffect(() => {
    if (isOpen) {
      setName("");
      setContactEmail("");
      setContactPhone("");
      setPhotoUrl("");
      setDescription("");
    }
  }, [isOpen]);

  async function handleCreate() {
    if (!companyName || !name.trim()) return;

    const company = await getCompanyByName(companyName);
    const payload: any = {
      company_id: company?.id ?? null,
      name: name.trim(),
      contact_email: contactEmail || null,
      contact_phone: contactPhone || null,
      photo_url: photoUrl || null,
      description: description || null,
    };

    const { error } = await supabase.from("clients").insert(payload);
    if (error) {
      console.error("Create client error:", error);
      alert(error.message);
      return;
    }

    onCreated();
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Client / Project"
      subtitle={companyName ? `for ${companyName}` : undefined}
      size="medium"
    >
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-neutral-700">Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
            placeholder="e.g. Sarah Wedding"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-neutral-700">Email</label>
            <input
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
              placeholder="email@client.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700">Phone</label>
            <input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
              placeholder="(555) 555-5555"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700">Photo URL</label>
          <input
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
            placeholder="https://..."
          />
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none resize-none"
            placeholder="Optional notes…"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-full border px-4 py-2 text-sm font-medium hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!companyName || !name.trim()}
            className="flex-1 rounded-full bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Add
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CreateProductModal({
  isOpen,
  onClose,
  companyName,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  companyName: string | null;
  onCreated: () => void;
}) {
  const [name, setName] = React.useState("");
  const [photoUrl, setPhotoUrl] = React.useState("");
  const [description, setDescription] = React.useState("");

  useEffect(() => {
    if (isOpen) {
      setName("");
      setPhotoUrl("");
      setDescription("");
    }
  }, [isOpen]);

  async function handleCreate() {
    if (!companyName || !name.trim()) return;

    const company = await getCompanyByName(companyName);
    const payload: any = {
      company_id: company?.id ?? null,
      name: name.trim(),
      photo_url: photoUrl || null,
      description: description || null,
    };

    const { error } = await supabase.from("products").insert(payload);
    if (error) {
      console.error("Create product error:", error);
      alert(error.message);
      return;
    }

    onCreated();
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Product"
      subtitle={companyName ? `for ${companyName}` : undefined}
      size="medium"
    >
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-neutral-700">Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
            placeholder="e.g. Pressed Bouquet Frame"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700">Photo URL</label>
          <input
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
            placeholder="https://..."
          />
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none resize-none"
            placeholder="Optional notes…"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-full border px-4 py-2 text-sm font-medium hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!companyName || !name.trim()}
            className="flex-1 rounded-full bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Add
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Client/Product Modals
   ────────────────────────────────────────────────────────────────── */
function CreateProjectModal({
  isOpen,
  onClose,
  clientId,
  companyId,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  companyId: string | null;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [targetDate, setTargetDate] = useState("");

  useEffect(() => {
    if (isOpen) {
      setName("");
      setTargetDate("");
    }
  }, [isOpen]);

  async function handleCreate() {
    if (!name.trim()) return;
    await createProject({
      client_id: clientId,
      company_id: companyId,
      name: name.trim(),
      status: "active",
      target_delivery_date: targetDate || null,
    });
    onCreated();
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Project" size="small">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-neutral-700">Project Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
            placeholder="e.g. Sarah & James Wedding"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700">Target Delivery Date</label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-full border px-4 py-2 text-sm font-medium hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="flex-1 rounded-full bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Create
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ProjectModal({
  project,
  isOpen,
  onClose,
  onUpdated,
}: {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [linkedTasks, setLinkedTasks] = useState<{ id: string; title: string; status: string }[]>([]);
  const [linkableTasks, setLinkableTasks] = useState<{ id: string; title: string }[]>([]);
  const [taskToLink, setTaskToLink] = useState("");
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [newDeliverableTitle, setNewDeliverableTitle] = useState("");
  const [newDeliverableDesc, setNewDeliverableDesc] = useState("");
  const [addingDeliverable, setAddingDeliverable] = useState(false);

  const loadDeliverables = useCallback(async () => {
    if (!project) return;
    setDeliverables(await fetchDeliverablesForProject(project.id));
  }, [project]);

  useEffect(() => {
    if (isOpen) loadDeliverables();
  }, [isOpen, loadDeliverables]);

  async function handleAddDeliverable() {
    if (!newDeliverableTitle.trim() || !project) return;
    setAddingDeliverable(true);
    await createDeliverable({ projectId: project.id, title: newDeliverableTitle.trim(), description: newDeliverableDesc.trim() });
    setNewDeliverableTitle("");
    setNewDeliverableDesc("");
    setAddingDeliverable(false);
    loadDeliverables();
  }

  const loadTasks = useCallback(async () => {
    if (!project) return;
    const { data: linked } = await supabase
      .from("tasks")
      .select("id, title, status")
      .eq("project_id", project.id);
    setLinkedTasks(linked || []);

    let linkableQuery = supabase
      .from("tasks")
      .select("id, title")
      .is("project_id", null);
    if (project.company_id) {
      linkableQuery = linkableQuery.eq("company_id", project.company_id);
    }
    const { data: linkable } = await linkableQuery;
    setLinkableTasks(linkable || []);
  }, [project]);

  useEffect(() => {
    if (isOpen) {
      setTaskToLink("");
      loadTasks();
    }
  }, [isOpen, loadTasks]);

  if (!project) return null;

  async function handleStatusChange(status: string) {
    if (!project) return;
    await updateProject(project.id, { status: status as Project["status"] });
    onUpdated();
  }

  async function handleDateChange(date: string) {
    if (!project) return;
    await updateProject(project.id, { target_delivery_date: date || null });
    onUpdated();
  }

  async function handleLinkTask() {
    if (!taskToLink || !project) return;
    await dbUpdateTask(taskToLink, { project_id: project.id });
    setTaskToLink("");
    loadTasks();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={project.name} size="medium">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-700">Status</label>
            <select
              value={project.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
            >
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700">Target Delivery Date</label>
            <input
              type="date"
              value={project.target_delivery_date || ""}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
            />
          </div>
        </div>

        <div className="border-t pt-4">
          <label className="text-sm font-medium text-neutral-700">Deliverables</label>
          <div className="space-y-2 mt-2">
            {deliverables.length === 0 && (
              <div className="text-sm text-neutral-400 text-center py-4">No deliverables yet</div>
            )}
            {deliverables.map((d) => (
              <div key={d.id} className="rounded-2xl border p-3 bg-neutral-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-neutral-700">{d.title}</span>
                  <span className="text-xs px-2 py-1 rounded-full bg-neutral-200 text-neutral-600 capitalize">
                    {d.status.replace("_", " ")}
                  </span>
                </div>
                {d.description && <p className="text-xs text-neutral-500">{d.description}</p>}
                {d.status === "revision_requested" && d.revision_note && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1">
                    Client requested changes: {d.revision_note}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs text-neutral-500">
                    <input
                      type="checkbox"
                      checked={d.client_visible}
                      onChange={async (e) => {
                        await setDeliverableVisibility(d.id, e.target.checked);
                        loadDeliverables();
                      }}
                    />
                    Client-visible
                  </label>
                  {d.status === "pending" && (
                    <button
                      onClick={async () => {
                        await markDeliverableDelivered(d.id);
                        loadDeliverables();
                      }}
                      className="text-xs font-medium text-teal-700 hover:underline"
                    >
                      Mark Delivered
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 mt-3">
            <input
              value={newDeliverableTitle}
              onChange={(e) => setNewDeliverableTitle(e.target.value)}
              placeholder="New deliverable title"
              className="rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
            />
            <div className="flex gap-2">
              <input
                value={newDeliverableDesc}
                onChange={(e) => setNewDeliverableDesc(e.target.value)}
                placeholder="Description (optional)"
                className="flex-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
              />
              <button
                onClick={handleAddDeliverable}
                disabled={!newDeliverableTitle.trim() || addingDeliverable}
                className="rounded-full bg-teal-600 text-white px-4 py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-50 whitespace-nowrap"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <label className="text-sm font-medium text-neutral-700">Linked Tasks</label>
          <div className="space-y-2 mt-2">
            {linkedTasks.length === 0 && (
              <div className="text-sm text-neutral-400 text-center py-4">
                No tasks linked yet
              </div>
            )}
            {linkedTasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-2xl border p-3 bg-neutral-50">
                <span className="text-sm text-neutral-700">{t.title}</span>
                <span className="text-xs px-2 py-1 rounded-full bg-neutral-200 text-neutral-600">
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t pt-4">
          <label className="text-sm font-medium text-neutral-700">Link an Existing Task</label>
          <div className="flex gap-2 mt-2">
            <select
              value={taskToLink}
              onChange={(e) => setTaskToLink(e.target.value)}
              className="flex-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
            >
              <option value="">Select a task…</option>
              {linkableTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <button
              onClick={handleLinkTask}
              disabled={!taskToLink}
              className="rounded-full bg-teal-600 text-white px-4 py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
            >
              Link
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function CreateProposalModal({
  isOpen,
  onClose,
  clientId,
  companyId,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  companyId: string | null;
  onCreated: () => void;
}) {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [authored, setAuthored] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !companyId) return;
    setError(null);
    setEventDate("");
    setAuthored({});
    fetchDocumentTemplates(companyId, "proposal").then((rows) => {
      setTemplates(rows);
      const defaultTemplate = rows.find((t) => t.is_default) || rows[0];
      setTemplateId(defaultTemplate?.id || "");
    });
  }, [isOpen, companyId]);

  const selectedTemplate = templates.find((t) => t.id === templateId);
  const designBrief = selectedTemplate ? getDesignBriefSection(selectedTemplate.structure) : undefined;

  async function handleCreate() {
    if (!templateId || !companyId) return;
    setSaving(true);
    setError(null);
    const result = await createProposal({
      templateId,
      clientId,
      companyId,
      eventDate: eventDate || null,
      authored,
    });
    setSaving(false);
    if (!result) {
      setError("Something went wrong creating the proposal — please try again.");
      return;
    }
    onCreated();
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Proposal" size="medium">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-neutral-700">Template</label>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
          >
            {templates.length === 0 && <option value="">No proposal templates yet</option>}
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700">Event Date</label>
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
          />
          <p className="text-xs text-neutral-400 mt-1">
            Needed to schedule the payment plan — the balance is due 4 weeks before this date.
          </p>
        </div>

        {designBrief && (
          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-medium text-neutral-700">{designBrief.title}</p>
            {designBrief.fields.map((field) => (
              <div key={field.key}>
                <label className="text-xs font-medium text-neutral-500">{field.label}</label>
                {field.kind === "textarea" ? (
                  <textarea
                    value={authored[field.key] || ""}
                    onChange={(e) => setAuthored((a) => ({ ...a, [field.key]: e.target.value }))}
                    rows={3}
                    className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
                  />
                ) : (
                  <input
                    value={authored[field.key] || ""}
                    onChange={(e) => setAuthored((a) => ({ ...a, [field.key]: e.target.value }))}
                    className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-full border px-4 py-2 text-sm font-medium hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!templateId || saving}
            className="flex-1 rounded-full bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Creating…" : "Create Proposal"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed by client",
  accepted: "Accepted",
  declined: "Declined",
};

function ProposalDetailModal({
  proposal,
  isOpen,
  onClose,
  onUpdated,
}: {
  proposal: ProposalWithDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [template, setTemplate] = useState<DocumentTemplate | null>(null);
  const [installments, setInstallments] = useState<PaymentInstallment[]>([]);
  const [agreement, setAgreement] = useState<{ status: string; signed_name: string | null; signed_at: string | null } | null>(null);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    if (!isOpen || !proposal?.generated_documents) return;
    supabase
      .from("document_templates")
      .select("*")
      .eq("id", proposal.generated_documents.template_id)
      .single()
      .then(({ data }) => setTemplate(data));

    if (proposal.status === "accepted") {
      fetchPaymentScheduleForProposal(proposal.id).then((result) => {
        setInstallments(result?.installments || []);
      });
      supabase
        .from("agreements")
        .select("status, signed_name, signed_at")
        .eq("proposal_id", proposal.id)
        .maybeSingle()
        .then(({ data }) => setAgreement(data));
    } else {
      setInstallments([]);
      setAgreement(null);
    }
  }, [isOpen, proposal]);

  if (!proposal) return null;

  const totals = template
    ? computeDocumentTotals(template.structure, proposal.generated_documents?.field_values.selections || {})
    : null;

  async function handleMarkSent() {
    if (!proposal?.generated_documents) return;
    setMarking(true);
    await markProposalSent(proposal.generated_documents.id, proposal.id);
    setMarking(false);
    onUpdated();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Proposal" size="medium">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs px-3 py-1 rounded-full font-medium bg-neutral-100 text-neutral-700">
            {PROPOSAL_STATUS_LABELS[proposal.status] || proposal.status}
          </span>
          {proposal.status === "draft" && (
            <button
              onClick={handleMarkSent}
              disabled={marking}
              className="rounded-full bg-teal-600 text-white px-4 py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
            >
              {marking ? "Sending…" : "Mark as Sent"}
            </button>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700">Event Date</label>
          <p className="text-sm text-neutral-600 mt-1">
            {proposal.event_date ? new Date(proposal.event_date + "T00:00:00").toLocaleDateString() : "Not set"}
          </p>
        </div>

        {totals && (
          <div className="border-t pt-4">
            <label className="text-sm font-medium text-neutral-700">Current Total (at authored defaults)</label>
            <p className="text-2xl font-semibold text-teal-700 mt-1">${totals.grand_total.toLocaleString()}</p>
            <div className="space-y-1 mt-3">
              {totals.sections.map((s) => (
                <div key={s.key} className="flex justify-between text-sm text-neutral-600">
                  <span>{s.name}</span>
                  <span>${s.subtotal.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {proposal.status === "accepted" && (
          <div className="border-t pt-4">
            <label className="text-sm font-medium text-neutral-700">Agreement</label>
            <div className="rounded-2xl border border-neutral-200/70 p-3 bg-neutral-50 mt-2">
              {agreement?.status === "signed" ? (
                <>
                  <p className="text-sm text-neutral-700">
                    Signed by <span className="font-medium">{agreement.signed_name}</span>
                  </p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {agreement.signed_at ? new Date(agreement.signed_at).toLocaleString() : ""}
                  </p>
                </>
              ) : (
                <p className="text-sm text-neutral-600">
                  Sent to client — awaiting their signature in the portal
                </p>
              )}
            </div>
          </div>
        )}

        {proposal.status === "accepted" && installments.length > 0 && (
          <div className="border-t pt-4">
            <label className="text-sm font-medium text-neutral-700">Payment Schedule</label>
            <div className="space-y-2 mt-2">
              {installments.map((inst) => (
                <div key={inst.id} className="flex items-center justify-between rounded-2xl border p-3 bg-neutral-50">
                  <div>
                    <p className="text-sm font-medium">${inst.amount.toLocaleString()}</p>
                    <p className="text-xs text-neutral-400">
                      Due {inst.due_date ? new Date(inst.due_date + "T00:00:00").toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-neutral-200 text-neutral-600 capitalize">
                    {inst.status}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-neutral-400 mt-2">Clients pay each installment directly from their portal via Stripe.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function ClientModal({
  client,
  isOpen,
  onClose,
}: {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [inviting, setInviting] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const { projects, refetch: refetchProjects } = useProjects(client?.id);
  const [savingStage, setSavingStage] = useState(false);
  const [showCreateProposalModal, setShowCreateProposalModal] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<ProposalWithDocument | null>(null);
  const { proposals, refetch: refetchProposals } = useProposals(client?.id);

  if (!client) return null;

  async function handleStageChange(stage: string) {
    setSavingStage(true);
    await saveClient({ id: client!.id, stage: stage as Client["stage"] });
    setSavingStage(false);
  }

  async function handleTrackChange(track: string) {
    setSavingStage(true);
    await saveClient({ id: client!.id, track: (track || null) as Client["track"] });
    setSavingStage(false);
  }

  async function inviteToPortal() {
    if (!client) return;
    setInviting(true);
    setInviteStatus(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setInviteStatus("Your session expired — please refresh the page.");
        return;
      }
      const res = await fetch("/api/invite-client", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ client_id: client.id }),
      });
      const data = await res.json();
      setInviteStatus(res.ok ? `Invite sent to ${data.email}` : data.error || "Failed to send invite");
    } catch {
      setInviteStatus("Failed to send invite — try again.");
    } finally {
      setInviting(false);
    }
  }

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={client.name}
      size="large"
      coverImage={client.photo_url}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={inviteToPortal}
            disabled={inviting}
            className="rounded-full bg-teal-600 text-white px-4 py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
          >
            {inviting ? "Sending…" : "Invite to Portal"}
          </button>
          {inviteStatus && <span className="text-sm text-neutral-600">{inviteStatus}</span>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-700">Stage</label>
            <select
              value={client.stage}
              onChange={(e) => handleStageChange(e.target.value)}
              disabled={savingStage}
              className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
            >
              <option value="lead">Lead</option>
              <option value="proposal_sent">Proposal Sent</option>
              <option value="active">Active</option>
              <option value="delivered">Delivered</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700">Track</label>
            <select
              value={client.track || ""}
              onChange={(e) => handleTrackChange(e.target.value)}
              disabled={savingStage}
              className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
            >
              <option value="">Not set</option>
              <option value="freelancer">Freelancer</option>
              <option value="founder_mini">Founder Mini</option>
              <option value="founder_full">Founder Full</option>
              <option value="ceo">CEO</option>
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-neutral-700">Proposals</label>
            <button
              onClick={() => setShowCreateProposalModal(true)}
              className="text-xs rounded-full border-2 border-teal-600 text-teal-600 px-3 py-1 hover:bg-teal-50 font-medium"
            >
              Create Proposal
            </button>
          </div>
          <div className="space-y-2">
            {proposals.length === 0 && (
              <div className="text-sm text-neutral-400 text-center py-4 border rounded-2xl">
                No proposals yet
              </div>
            )}
            {proposals.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProposal(p)}
                className="w-full flex items-center justify-between rounded-2xl border p-3 hover:border-teal-300 transition-colors text-left"
              >
                <span className="text-sm font-medium">
                  {p.event_date ? new Date(p.event_date + "T00:00:00").toLocaleDateString() : "No event date"}
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-neutral-100 text-neutral-600 capitalize">
                  {PROPOSAL_STATUS_LABELS[p.status] || p.status}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-neutral-700">Projects</label>
            <button
              onClick={() => setShowCreateProjectModal(true)}
              className="text-xs rounded-full border-2 border-teal-600 text-teal-600 px-3 py-1 hover:bg-teal-50 font-medium"
            >
              New Project
            </button>
          </div>
          <div className="space-y-2">
            {projects.length === 0 && (
              <div className="text-sm text-neutral-400 text-center py-4 border rounded-2xl">
                No projects yet
              </div>
            )}
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProject(p)}
                className="w-full flex items-center justify-between rounded-2xl border p-3 hover:border-teal-300 transition-colors text-left"
              >
                <span className="text-sm font-medium">{p.name}</span>
                <span className="text-xs px-2 py-1 rounded-full bg-neutral-100 text-neutral-600 capitalize">
                  {p.status.replace("_", " ")}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700">
            Description
          </label>
          <p className="text-sm text-neutral-600 mt-1">{client.description}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-700">
              Contact
            </label>
            <p className="text-sm text-neutral-600 mt-1">{client.contact}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700">
              Scope
            </label>
            <p className="text-sm text-neutral-600 mt-1">{client.scope}</p>
          </div>
        </div>

        {client.quick_links && client.quick_links.length > 0 && (
        <div>
          <label className="text-sm font-medium text-neutral-700">
            Quick Links
          </label>
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
        )}
      </div>
    </Modal>

    <CreateProjectModal
      isOpen={showCreateProjectModal}
      onClose={() => setShowCreateProjectModal(false)}
      clientId={client.id}
      companyId={client.company_id}
      onCreated={refetchProjects}
    />

    <CreateProposalModal
      isOpen={showCreateProposalModal}
      onClose={() => setShowCreateProposalModal(false)}
      clientId={client.id}
      companyId={client.company_id}
      onCreated={refetchProposals}
    />

    <ProposalDetailModal
      proposal={selectedProposal}
      isOpen={!!selectedProposal}
      onClose={() => setSelectedProposal(null)}
      onUpdated={refetchProposals}
    />

    <ProjectModal
      project={selectedProject}
      isOpen={!!selectedProject}
      onClose={() => setSelectedProject(null)}
      onUpdated={refetchProjects}
    />
    </>
  );
}

function ProductModal({
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={product.name}
      size="large"
      coverImage={product.photo_url}
    >
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-neutral-700">
            Description
          </label>
          <p className="text-sm text-neutral-600 mt-1">{product.description}</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-700">Price</label>
            <p className="text-sm text-neutral-600 mt-1">
              {product.price != null ? `$${product.price.toFixed(2)}` : "—"}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700">
              Status
            </label>
            <p className="text-sm text-neutral-600 mt-1">{product.status || "—"}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700">
              Launch Date
            </label>
            <p className="text-sm text-neutral-600 mt-1">
              {product.launch_date
                ? new Date(product.launch_date).toLocaleDateString()
                : "—"}
            </p>
          </div>
        </div>

        {product.quick_links && product.quick_links.length > 0 && (
          <div>
            <label className="text-sm font-medium text-neutral-700">
              Quick Links
            </label>
            <div className="flex gap-2 mt-2">
              {product.quick_links.map((link, i) => (
                <a
                  key={i}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs bg-teal-50 text-teal-700 px-3 py-1.5 rounded-lg hover:bg-teal-100"
                >
                  {link}
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
   Company Modal
   ────────────────────────────────────────────────────────────────── */
function BrandKitEditModal({
  isOpen,
  onClose,
  companyId,
  companyName,
}: {
  isOpen: boolean;
  onClose: () => void;
  companyId: string | null;
  companyName: string;
}) {
  const { brandKit, loading, refetch } = useBrandKit(companyId);
  const [logoVariants, setLogoVariants] = useState<Record<string, string>>({});
  const [colorPrimary, setColorPrimary] = useState("#0F766E");
  const [colorSecondary, setColorSecondary] = useState("#0F766E");
  const [colorAccent, setColorAccent] = useState("#0F766E");
  const [fontHeading, setFontHeading] = useState("");
  const [fontBody, setFontBody] = useState("");
  const [brandDescription, setBrandDescription] = useState("");
  const [toneNotes, setToneNotes] = useState("");
  const [policyDefaults, setPolicyDefaults] = useState<Record<string, string>>({});
  const [cashflowBands, setCashflowBands] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [shareSlug, setShareSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLogoVariants(brandKit?.logo_variants || {});
    setColorPrimary(brandKit?.color_primary || "#0F766E");
    setColorSecondary(brandKit?.color_secondary || "#0F766E");
    setColorAccent(brandKit?.color_accent || "#0F766E");
    setFontHeading(brandKit?.font_heading || "");
    setFontBody(brandKit?.font_body || "");
    setBrandDescription(brandKit?.brand_description || "");
    setToneNotes(brandKit?.tone_notes || "");
    setPolicyDefaults(brandKit?.policy_defaults || {});
    setCashflowBands(
      Object.fromEntries(
        Object.entries(brandKit?.cashflow_bands || {}).map(([k, v]) => [k, String(v)])
      )
    );
    setShareSlug(brandKit?.share_slug || null);
  }, [isOpen, brandKit]);

  if (!companyId) return null;

  async function handleSave() {
    setSaving(true);
    const saved = await saveBrandKit(companyId!, {
      logo_variants: logoVariants,
      color_primary: colorPrimary,
      color_secondary: colorSecondary,
      color_accent: colorAccent,
      font_heading: fontHeading || null,
      font_body: fontBody || null,
      brand_description: brandDescription || null,
      tone_notes: toneNotes || null,
      policy_defaults: policyDefaults,
      cashflow_bands: Object.fromEntries(
        Object.entries(cashflowBands).map(([k, v]) => [k, parseFloat(v) || 0])
      ),
    });
    setSaving(false);
    if (saved) {
      setShareSlug(saved.share_slug);
      refetch();
    }
  }

  const logoFields: { key: string; label: string }[] = [
    { key: "primary", label: "Primary Logo URL" },
    { key: "mark_only", label: "Mark-Only Logo URL" },
    { key: "light", label: "Light Version URL" },
    { key: "dark", label: "Dark Version URL" },
  ];
  const policyFields: { key: string; label: string; placeholder: string }[] = [
    { key: "payment_terms", label: "Payment Terms", placeholder: "e.g. 50% deposit, balance due 30 days before" },
    { key: "cancellation_window", label: "Cancellation Window", placeholder: "e.g. 30 days notice" },
    { key: "communication_hours", label: "Communication Hours", placeholder: "e.g. Mon–Fri, 9am–5pm" },
    { key: "revision_limits", label: "Revision Limits", placeholder: "e.g. 2 rounds included" },
  ];
  const cashflowFields: { key: string; label: string }[] = [
    { key: "profit", label: "Profit %" },
    { key: "expenses", label: "Expenses %" },
    { key: "labor", label: "Labor %" },
    { key: "taxes", label: "Taxes %" },
    { key: "charity", label: "Charity %" },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${companyName} Brand Kit`} size="large">
      {loading ? (
        <div className="text-sm text-neutral-500 text-center py-8">Loading…</div>
      ) : (
        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
          {shareSlug && (
            <div className="rounded-2xl bg-teal-50 border border-teal-200 p-3 text-sm text-teal-900">
              Share link: <span className="font-mono">/brand/{shareSlug}</span>
            </div>
          )}

          <div>
            <label className="text-sm font-semibold text-neutral-700 block mb-2">Logo Variants</label>
            <div className="grid grid-cols-2 gap-3">
              {logoFields.map((f) => (
                <div key={f.key}>
                  <label className="text-xs text-neutral-600">{f.label}</label>
                  <input
                    value={logoVariants[f.key] || ""}
                    onChange={(e) => setLogoVariants({ ...logoVariants, [f.key]: e.target.value })}
                    className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
                    placeholder="https://..."
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-neutral-700 block mb-2">Colors</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Primary", value: colorPrimary, set: setColorPrimary },
                { label: "Secondary", value: colorSecondary, set: setColorSecondary },
                { label: "Accent", value: colorAccent, set: setColorAccent },
              ].map((c) => (
                <div key={c.label}>
                  <label className="text-xs text-neutral-600">{c.label}</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="color"
                      value={c.value}
                      onChange={(e) => c.set(e.target.value)}
                      className="w-9 h-9 rounded border cursor-pointer"
                    />
                    <input
                      value={c.value}
                      onChange={(e) => c.set(e.target.value)}
                      className="flex-1 rounded-2xl border px-2 py-2 text-sm font-mono focus:ring-2 focus:ring-teal-200 outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-neutral-700">Heading Font</label>
              <input
                value={fontHeading}
                onChange={(e) => setFontHeading(e.target.value)}
                className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
                placeholder="e.g. Playfair Display"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-700">Body Font</label>
              <input
                value={fontBody}
                onChange={(e) => setFontBody(e.target.value)}
                className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
                placeholder="e.g. Inter"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700">Brand Description</label>
            <textarea
              value={brandDescription}
              onChange={(e) => setBrandDescription(e.target.value)}
              rows={3}
              className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none resize-none"
              placeholder="Who this brand is..."
            />
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700">Tone Notes</label>
            <textarea
              value={toneNotes}
              onChange={(e) => setToneNotes(e.target.value)}
              rows={3}
              className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none resize-none"
              placeholder="Voice and imagery guidelines..."
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-neutral-700 block mb-2">Policy Defaults</label>
            <div className="grid grid-cols-2 gap-3">
              {policyFields.map((f) => (
                <div key={f.key}>
                  <label className="text-xs text-neutral-600">{f.label}</label>
                  <input
                    value={policyDefaults[f.key] || ""}
                    onChange={(e) => setPolicyDefaults({ ...policyDefaults, [f.key]: e.target.value })}
                    className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
                    placeholder={f.placeholder}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-neutral-700 block mb-2">Cashflow Bands</label>
            <div className="grid grid-cols-5 gap-2">
              {cashflowFields.map((f) => (
                <div key={f.key}>
                  <label className="text-xs text-neutral-600">{f.label}</label>
                  <input
                    type="number"
                    value={cashflowBands[f.key] || ""}
                    onChange={(e) => setCashflowBands({ ...cashflowBands, [f.key]: e.target.value })}
                    className="w-full mt-1 rounded-2xl border px-2 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t">
            <button
              onClick={onClose}
              className="flex-1 rounded-full border px-4 py-2 text-sm font-medium hover:bg-neutral-50 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-full bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Save Brand Kit"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function CompanyModal({
  companyName,
  isOpen,
  onClose,
  onClientClick,
  onProductClick,
  dbClients,
  dbProducts,
  role,
  onAddClient,
  onAddProduct,
}: {
  companyName: string | null;
  isOpen: boolean;
  onClose: () => void;
  onClientClick: (client: Client) => void;
  onProductClick: (product: Product) => void;

  dbClients: Client[];
  dbProducts: Product[];
  role: Role;

  onAddClient: (companyName: string) => void;
  onAddProduct: (companyName: string) => void;
}) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [showBrandKitModal, setShowBrandKitModal] = useState(false);

  useEffect(() => {
    if (!companyName) {
      setCompanyId(null);
      return;
    }
    let mounted = true;
    getCompanyByName(companyName).then((c) => {
      if (mounted) setCompanyId(c?.id ?? null);
    });
    return () => {
      mounted = false;
    };
  }, [companyName]);

  if (!companyName) return null;

  const company = COMPANY_DATA[companyName];

  const clients = dbClients.filter((c: any) => c.company_id && c.company_id === companyId);
  const products = dbProducts.filter((p: any) => p.company_id && p.company_id === companyId);

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title={companyName} size="large">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="text-6xl">{company.logo_url}</div>
          <div className="flex-1">
            <p className="text-sm text-neutral-600">{company.description}</p>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700 block mb-2">
            Social Links
          </label>
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
          <label className="text-sm font-medium text-neutral-700 block mb-2">
            Software
          </label>
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


        <div className="flex gap-2">
          <button
            onClick={() => setShowBrandKitModal(true)}
            className="rounded-full border-2 border-teal-600 text-teal-600 px-3 py-2 text-sm font-medium hover:bg-teal-50 transition-colors"
          >
            Brand Kit
          </button>
        </div>

{isFounder(role) && (
  <div className="flex gap-2">
    <button
      onClick={() => onAddClient(companyName)}
      className="rounded-full border px-3 py-2 text-sm font-medium hover:bg-neutral-50 transition-colors"
    >
      + Add Client / Project
    </button>
    <button
      onClick={() => onAddProduct(companyName)}
      className="rounded-full border px-3 py-2 text-sm font-medium hover:bg-neutral-50 transition-colors"
    >
      + Add Product
    </button>
  </div>
)}

        <div>
          <label className="text-sm font-medium text-neutral-700 block mb-3">
            {companyName === "Mairé"
              ? "All Products"
              : "All Clients & Projects"}
          </label>
          <div className="grid grid-cols-12 gap-2">
            {clients.map((client) => (
              <div
                key={client.id}
                onClick={() => {
                  onClientClick(client);
                  onClose();
                }}
                className="relative aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                style={{
                  backgroundImage: `url(${client.photo_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <p className="text-white text-xs font-medium truncate">
                    {client.name}
                  </p>
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
                className="relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                style={{
                  backgroundImage: `url(${product.photo_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <p className="text-white text-xs font-medium truncate">
                    {product.name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>

    <BrandKitEditModal
      isOpen={showBrandKitModal}
      onClose={() => setShowBrandKitModal(false)}
      companyId={companyId}
      companyName={companyName}
    />
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Chat System - FIXED FOR DATABASE MESSAGES
   ────────────────────────────────────────────────────────────────── */
function ChatPanel({
  userName,
  isOpen,
  onClose,
  messages,
  onSendMessage,
  teamMembers = [],
}: {
  userName: string;
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  onSendMessage: (content: string, to?: string) => void;
  teamMembers?: { id: string; display_name: string | null }[];
}) {
  const { profile } = useProfile(); // Get current user profile
  const currentUserId = profile?.id;

  const [newMessage, setNewMessage] = useState("");
  const [activeChannel, setActiveChannel] = useState<"team" | string>("team");

  function sendMessage() {
    if (!newMessage.trim()) return;
    // If DM channel (not 'team'), send to that person
    const recipient = activeChannel !== "team" ? activeChannel : undefined;
    onSendMessage(newMessage, recipient);
    setNewMessage("");
  }

  // Filter messages based on active channel
  const filteredMessages = messages.filter((msg) => {
    if (activeChannel === "team") {
      // Show team messages only (not DMs, not kudos)
      return msg.message_type === "team" && !msg.is_kudos;
    } else {
      // DM channel - show messages between user and selected person
      const otherUser = teamMembers.find(tm => tm.display_name === activeChannel);
      const otherUserId = otherUser?.id;
      
      return (
        (msg.from_user_id === otherUserId && msg.to_user_id === currentUserId) ||
        (msg.from_user_id === currentUserId && msg.to_user_id === otherUserId)
      );
    }
  });

  // Get list of teammates for DMs
  const teammates = teamMembers
    .map(tm => tm.display_name)
    .filter((name): name is string => name !== null && name !== userName);

  // Check for unread DMs per person
  const hasUnreadDM = (person: string) => {
    const otherUser = teamMembers.find(tm => tm.display_name === person);
    if (!otherUser) return false;
    
    return messages.some(
      (msg) => 
        msg.from_user_id === otherUser.id && 
        msg.to_user_id === currentUserId && 
        !msg.is_read
    );
  };

  // Mark messages as read when switching to a DM channel
  function switchChannel(channel: string) {
    setActiveChannel(channel);
    if (channel !== "team") {
      const otherUser = teamMembers.find(tm => tm.display_name === channel);
      if (otherUser) {
        markMessagesFromUserAsRead(otherUser.id);
      }
    }
  }

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ x: 400 }}
      animate={{ x: 0 }}
      exit={{ x: 400 }}
      className="fixed right-0 top-0 bottom-0 w-[600px] bg-white border-l shadow-2xl z-40 flex"
    >
      {/* Sidebar */}
      <div className="w-48 bg-neutral-50 border-r flex flex-col">
        <div className="border-b px-3 py-3 bg-teal-50">
          <h3 className="font-semibold text-sm">Inbox</h3>
        </div>

        {/* Channels */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-2 py-2">
            <p className="text-xs font-semibold text-neutral-500 px-2 mb-1">
              CHANNELS
            </p>

            <button
              onClick={() => switchChannel("team")}
              className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 ${
                activeChannel === "team"
                  ? "bg-teal-100 text-teal-900 font-medium"
                  : "hover:bg-neutral-100"
              }`}
            >
              Team Chat
            </button>
          </div>

          {/* Direct Messages */}
          <div className="px-2 py-2 border-t">
            <p className="text-xs font-semibold text-neutral-500 px-2 mb-1">
              DIRECT MESSAGES
            </p>
            {teammates.map((person) => (
              <button
                key={person}
                onClick={() => switchChannel(person)}
                className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 ${
                  activeChannel === person
                    ? "bg-teal-100 text-teal-900 font-medium"
                    : "hover:bg-neutral-100"
                }`}
              >
                <Avatar name={person} size={16} />
                <span className="flex-1 truncate">{person}</span>
                {hasUnreadDM(person) && (
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {activeChannel !== "team" && (
              <Avatar name={activeChannel} size={24} />
            )}
            <h3 className="font-semibold">
              {activeChannel === "team" ? "Team Chat" : activeChannel}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-900 text-xl"
          >
            ×
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredMessages.length === 0 ? (
            <div className="text-center text-neutral-400 text-sm mt-8">
              No messages yet. Start the conversation!
            </div>
          ) : (
            filteredMessages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-2xl p-3 ${
                  msg.is_kudos
                    ? "bg-yellow-50 border border-yellow-200"
                    : "bg-neutral-50"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Avatar name={msg.from_name || "Unknown"} size={20} />
                  <span className="text-xs font-medium">{msg.from_name || "Unknown"}</span>
                  {msg.is_kudos && (
                    <span className="text-xs text-yellow-600 font-medium">
                      Task Highlight
                    </span>
                  )}
                  <span className="text-xs text-neutral-400 ml-auto">
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-sm text-neutral-700">{msg.content}</p>
                {msg.related_task_id && (
                  <a
                    href="#"
                    className="text-xs text-teal-600 underline mt-1 block"
                  >
                    View completed task →
                  </a>
                )}
              </div>
            ))
          )}
        </div>

        {/* Input Area */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              placeholder={
                activeChannel === "team"
                  ? "Message team..."
                  : `Message ${activeChannel}...`
              }
              className="flex-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
            />
            <button
              onClick={sendMessage}
              className="bg-teal-600 text-white rounded-full px-4 py-2 hover:bg-teal-700 text-sm font-medium"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Sidebar
   ────────────────────────────────────────────────────────────────── */
type FounderPage =
  | "Today"
  | "Meetings"
  | "Tasks"
  | "Companies"
  | "Playbook"
  | "My Team"
  | "Settings";
type TeamPage =
  | "Today"
  | "Tasks"
  | "Companies"
  | "Playbook"
  | "Career Path"
  | "Settings";
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
  const founderNav: FounderPage[] = [
    "Today",
    "Meetings",
    "Tasks",
    "Companies",
    "Playbook",
    "My Team",
  ];
  const teamNav: TeamPage[] = [
    "Today",
    "Tasks",
    "Companies",
    "Playbook",
    "Career Path",
  ];
  const nav = isFounder(role) ? founderNav : teamNav;

  return (
    <aside className="w-72 shrink-0 border-r border-neutral-200/70 bg-white sticky top-0 h-screen p-4 flex flex-col">
      <div className="text-[24px] font-semibold leading-none mb-6 tracking-tight px-1">
        Backstage Headquarters
      </div>
      <nav className="space-y-1.5 text-[15px]">
        {nav.map((item) => {
          const isActive = active === item;
          return (
            <button
              key={item}
              onClick={() => onSelect(item)}
              className={`w-full text-left flex items-center justify-between rounded-2xl px-3.5 py-2.5 transition-colors ${
                isActive
                  ? "bg-sage-100 text-teal-800 font-semibold"
                  : "text-neutral-600 hover:bg-sage-50"
              }`}
            >
              <span>{item}</span>
              {item === "Today" && isActive && (
                <span className="text-[10px] rounded-full bg-white text-teal-700 px-2 py-0.5 font-medium">
                  Now
                </span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="mt-auto pt-6">
        <div className="text-xs uppercase tracking-wide text-neutral-400 mb-1 px-1">
          Signed in
        </div>
        <button
          onClick={() => onSelect("Settings" as Page)}
          className="text-sm font-medium hover:text-teal-700 transition-colors text-left px-1"
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
      <div className="h-14 md:h-16 bg-white flex items-center justify-between px-3 md:px-4 border-b border-neutral-200/70">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="text-[13px] md:text-[14px] text-neutral-900 font-medium">
            Welcome, {name}
          </div>
          <div className="hidden md:block w-[180px] h-1.5 rounded-full bg-sage-100 overflow-hidden">
            <div className="h-full bg-teal-600 rounded-full" style={{ width: `${pct}%` }} />
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
              className="w-full rounded-full border border-neutral-200 bg-neutral-50 px-4 py-1.5 text-[12px] outline-none focus:ring-2 focus:ring-teal-200 focus:bg-white transition-colors"
            />
          </div>
          <button
            onClick={onOpenChat}
            className="relative rounded-full border border-teal-200 bg-sage-50 px-4 py-2 text-sm hover:bg-sage-100 transition-colors font-medium text-teal-900"
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
      className="group flex items-center gap-3 rounded-2xl border p-3 hover:border-teal-200 transition-colors bg-white cursor-pointer"
    >
      {task.photo_url && (
        <div
          className="w-12 h-12 rounded-lg bg-cover bg-center flex-shrink-0"
          style={{ backgroundImage: `url(${task.photo_url})` }}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] md:text-[14px] font-medium truncate">
          {task.title}
        </div>
        <div className="text-xs text-neutral-500 truncate">
          {task.description || "No description"}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <CompanyChip name={task.company_name || "Unknown"} />
          <span className="text-[10px] px-2 py-0.5 rounded-full border bg-teal-50 text-teal-900/80">
            {task.impact}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full border bg-neutral-50 inline-flex items-center gap-1">
            <Avatar name={task.assignee_name || "Unassigned"} size={14} />
            {task.assignee_name || "Unassigned"}
          </span>
          {task.metadata?.auto_created && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-800 inline-flex items-center gap-1"
              title="Created automatically by Backstage"
            >
              ⚡ Automated
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function TaskList({
  tasks,
  onTaskClick,
}: {
  tasks: DBTask[];
  onTaskClick: (task: DBTask) => void;
}) {
  return (
    <div className="space-y-2">
      {tasks.length === 0 && (
        <div className="text-sm text-neutral-500 text-center py-8">
          No tasks yet
        </div>
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
            <div
              className={`${getNameFontSize()} font-semibold tracking-tight leading-tight`}
            >
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

  companyTasks.forEach((task) => {
    const points = weights[task.impact];
    totalPoints += points;
    if (task.status === "completed") {
      completedPoints += points;
    }
  });

  return totalPoints > 0
    ? Math.round((completedPoints / totalPoints) * 100)
    : 0;
}

// Business Snapshot — replaces the old hardcoded "Company Goals" card
// (Q1 MRR / Ops SLAs / VA playbook were fake numbers that never moved).
// Per the Dashboard Guardrail (claude/backstage-os-philosophy.md): plain
// counts, no scores, no colored progress bars, no judgment language —
// orientation, not evaluation. Every number here comes straight from the
// database.
function BusinessSnapshot({
  stats,
}: {
  stats: { icon: string; label: string; value: number | string }[];
}) {
  return (
    <Card title="Business Snapshot" subtitle="Here's what's present today">
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border p-3 bg-white flex items-center gap-3"
          >
            <div className="text-xl leading-none">{s.icon}</div>
            <div className="min-w-0">
              <div className="text-lg font-semibold leading-tight">{s.value}</div>
              <div className="text-xs text-neutral-500 leading-snug">{s.label}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function BrandSnapshot({
  allTasks,
  onCompanyClick,
}: {
  allTasks: DBTask[];
  onCompanyClick: (company: string) => void;
}) {
  const buckets = COMPANIES.map((c) => {
    const companyTasks = allTasks.filter((t) => t.company_name === c);
    const open = companyTasks.filter((t) => t.status !== "completed").length;
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
                    <path
                      d="M0,150 L50,80 L100,100 L150,40 L200,150 Z"
                      fill="#0F766E"
                    />
                    <circle cx="160" cy="40" r="15" fill="#0F766E" />
                  </svg>
                </div>
                {b.name}
              </div>
              <div className="text-xs text-neutral-600">{b.open} open</div>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-teal-100 overflow-hidden">
              <div
                className="h-full bg-teal-600"
                style={{ width: `${b.progress}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CompaniesPage({
  onCompanyClick,
  onClientClick,
  onProductClick,
  navigateTo,
  dbClients,
  dbProducts,
}: {
  onCompanyClick: (company: string) => void;
  onClientClick: (client: Client) => void;
  onProductClick: (product: Product) => void;
  navigateTo: (page: Page) => void;
  dbClients: Client[];
  dbProducts: Product[];
}) {
  const { companies } = useCompanies();
  const companyIdByName: Record<string, string> = {};
  companies.forEach((c) => {
    companyIdByName[c.name] = c.id;
  });

  // Social icon component
  const SocialIcon = ({ platform }: { platform: string }) => {
    const letters: Record<string, string> = {
      Instagram: "IG",
      Facebook: "FB",
      Twitter: "TW",
      Website: "W",
      TikTok: "TT",
      Etsy: "ET",
      LinkedIn: "LI",
      Pinterest: "PI",
    };

    return (
      <div className="w-8 h-8 rounded-full border-2 border-teal-700 flex items-center justify-center text-teal-700 hover:bg-teal-50 cursor-pointer transition-colors">
        <span className="text-[9px] font-bold">
          {letters[platform] || platform.slice(0, 2).toUpperCase()}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {COMPANIES.map((companyName) => {
        const company = COMPANY_DATA[companyName];
        const companyId = companyIdByName[companyName];
        const clients = dbClients
          .filter((c: any) => c.company_id && c.company_id === companyId)
          .slice(0, 4);

        const products = dbProducts
          .filter((p: any) => p.company_id && p.company_id === companyId)
          .slice(0, 6);

        const items = companyName === "Mairé" ? products : clients;

        // Calculate progress
        const completedTasks = 0; // Mock data
        const totalTasks = 1;
        const progress = Math.round((completedTasks / totalTasks) * 100) || 45; // Mock 45%

        // Get company-specific chip colors
        const chipColors: Record<string, string> = {
          "Prose Florals": "bg-lime-50 text-lime-900 border-lime-200",
          Backstage: "bg-teal-100 text-teal-900 border-teal-300",
          Mairé: "bg-emerald-50 text-emerald-900 border-emerald-200",
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
                      <path
                        d="M0,150 L50,80 L100,100 L150,40 L200,150 Z"
                        fill="#0F766E"
                      />
                      <circle cx="160" cy="40" r="15" fill="#0F766E" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold">{companyName}</h3>
                </div>

                <div className="flex items-center gap-4">
                  {/* Progress bar */}
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-32 rounded-full bg-teal-100 overflow-hidden">
                      <div
                        className="h-full bg-teal-600"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-neutral-500 w-10">
                      {progress}%
                    </span>
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
                      companyName === "Mairé"
                        ? onProductClick(item)
                        : onClientClick(item);
                    }}
                    className={`relative rounded-2xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity ${
                      companyName === "Mairé" ? "aspect-[3/4]" : "aspect-[4/3]"
                    }`}
                    style={{
                      backgroundImage: `linear-gradient(135deg, #CDEDE6 0%, #B8E0D9 100%)`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    {/* Mountain placeholder icon */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg
                        viewBox="0 0 200 150"
                        className="w-3/4 h-3/4 opacity-30"
                      >
                        <path
                          d="M0,150 L50,80 L100,100 L150,40 L200,150 Z"
                          fill="#0F766E"
                        />
                        <circle cx="160" cy="40" r="15" fill="#0F766E" />
                      </svg>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <p className="text-white text-xs font-medium truncate">
                        {item.name}
                      </p>
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
function MyTeamPage({ 
  tasks, 
  completedTasks = [],
  teamMembers = [] 
}: { 
  tasks: DBTask[];
  completedTasks?: DBTask[];
  teamMembers?: { id: string; display_name: string | null; xp?: number; level?: number }[];
}) {
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  const teamMemberStats = teamMembers.map((member) => {
    const name = member.display_name || "Unknown";
    const activeTasks = tasks.filter((t) => t.assignee_name === name);
    const completed = completedTasks.filter((t) => t.assignee_name === name);
    // Real xp/level now come straight from profiles.xp/level, which
    // useDatabase.ts's awardPoints keeps in sync on every task completion
    // — not recomputed from a task count on the fly.
    const level = member.level ?? 1;
    const xp = member.xp ?? 0;

    return {
      name,
      level,
      xp,
      completedTasks: completed,
      totalTasks: activeTasks.length + completed.length,
    };
  });

  const selectedMemberData = teamMemberStats.find((m) => m.name === selectedMember);

  return (
    <>
      <Card title="My Team" subtitle="Levels & task completion">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {teamMemberStats.map((m) => (
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
                    <div className="text-xs text-neutral-500">
                      {m.totalTasks} tasks
                    </div>
                  </div>
                </div>
                <LevelRing
                  level={m.level}
                  value={m.xp}
                  max={LEVEL_XP_THRESHOLD}
                  showStats={false}
                  size={60}
                  stroke={8}
                />
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
                <h3 className="text-xl font-semibold">
                  {selectedMemberData.name}
                </h3>
                <p className="text-sm text-neutral-600">
                  Level {selectedMemberData.level} •{" "}
                  {selectedMemberData.completedTasks.length} tasks completed
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
                  <div
                    key={task.id}
                    className="rounded-2xl border p-3 bg-neutral-50"
                  >
                    <div className="font-medium text-sm">{task.title}</div>
                    <div className="text-xs text-neutral-500 mt-1">
                      {task.company_name} • {task.impact} impact •{" "}
                      {XP_BY_IMPACT[task.impact]} XP
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
          <div className="rounded-2xl border p-3 bg-white flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Ops Standup</div>
              <div className="text-xs text-neutral-500">
                Tue 11:30 AM • Backstage
              </div>
            </div>
            <button className="text-xs rounded-full border px-2 py-1 hover:border-teal-300">
              Open agenda
            </button>
          </div>
          <div className="rounded-2xl border p-3 bg-white flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Client Onboarding</div>
              <div className="text-xs text-neutral-500">
                Thu 2:00 PM • Prose Florals
              </div>
            </div>
            <button className="text-xs rounded-full border px-2 py-1 hover:border-teal-300">
              Checklist
            </button>
          </div>
        </div>
      </Card>

      <Card title="Meeting Agenda & Notes">
        <textarea
          className="w-full min-h-[200px] rounded-2xl border p-3 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
          placeholder="Add meeting notes and agenda items here...

• Topic 1
• Topic 2
• Action items"
          value={agenda}
          onChange={(e) => setAgenda(e.target.value)}
        />
        <button className="mt-3 bg-teal-600 text-white rounded-full px-4 py-2 hover:bg-teal-700 text-sm font-medium">
          Save to Google Doc
        </button>
      </Card>
    </div>
  );
}

function SettingsPage({
  userName,
  email,
  companies,
  onReplayWizard,
}: {
  userName: string;
  email: string;
  companies: Company[];
  onReplayWizard: (company: Company) => void;
}) {
  const [replayCompanyId, setReplayCompanyId] = useState(companies[0]?.id ?? "");
  const [confirmingReplay, setConfirmingReplay] = useState(false);

  return (
    <div className="space-y-6">
      <Card
        title="Getting Started Wizard"
        subtitle="The founder-heart questions, brand basics, and first-automation walkthrough"
      >
        <div className="space-y-3">
          <p className="text-sm text-neutral-500">
            Replaying this will add a real client to the company you choose
            below and run the real kickoff automation against it (a project +
            starter tasks, one already checked off). It isn't a sandbox —
            pick a company you're comfortable adding a test client to.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={replayCompanyId}
              onChange={(e) => setReplayCompanyId(e.target.value)}
              className="rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-200"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setConfirmingReplay(true)}
              disabled={!replayCompanyId}
              className="bg-teal-600 text-white rounded-full px-4 py-2 hover:bg-teal-700 text-sm font-medium disabled:opacity-50"
            >
              Replay Getting Started Wizard
            </button>
          </div>
          {confirmingReplay && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 space-y-3">
              <div>
                This will create a new real client (and its automated
                project + tasks) under{" "}
                <strong>{companies.find((c) => c.id === replayCompanyId)?.name}</strong>.
                Continue?
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const company = companies.find((c) => c.id === replayCompanyId);
                    if (company) onReplayWizard(company);
                    setConfirmingReplay(false);
                  }}
                  className="bg-amber-600 text-white rounded-full px-4 py-1.5 text-sm font-medium hover:bg-amber-700"
                >
                  Yes, replay it
                </button>
                <button
                  onClick={() => setConfirmingReplay(false)}
                  className="text-amber-800 px-4 py-1.5 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card title="Account Settings">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-neutral-700">
              Display Name
            </label>
            <input
              type="text"
              defaultValue={userName}
              className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700">
              Email
            </label>
            <input
              type="email"
              defaultValue={email}
              className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
            />
          </div>
          <button className="bg-teal-600 text-white rounded-full px-4 py-2 hover:bg-teal-700 text-sm font-medium">
            Save Changes
          </button>
        </div>
      </Card>

      <Card title="Notifications">
        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              defaultChecked
              className="w-4 h-4 accent-teal-600"
            />
            <span className="text-sm">
              Email notifications for task assignments
            </span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              defaultChecked
              className="w-4 h-4 accent-teal-600"
            />
            <span className="text-sm">Daily digest of team activity</span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" className="w-4 h-4 accent-teal-600" />
            <span className="text-sm">
              Browser notifications for new messages
            </span>
          </label>
        </div>
      </Card>

      <Card title="Danger Zone">
        <button className="text-red-600 border border-red-200 rounded-full px-4 py-2 hover:bg-red-50 text-sm font-medium">
          Sign Out
        </button>
      </Card>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Accomplishments Modal (NEW!)
   ────────────────────────────────────────────────────────────────── */
function AddAccomplishmentModal({
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Accomplishment"
      size="small"
    >
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-neutral-700">
            What did you accomplish?
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Shipped Q3 client presentation..."
            className="w-full mt-1 rounded-2xl border px-3 py-2 text-sm min-h-[100px] focus:ring-2 focus:ring-teal-200 outline-none"
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
            className="px-4 py-2 border rounded-full hover:bg-neutral-50 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!text.trim()}
            className="flex-1 bg-teal-600 text-white rounded-full px-4 py-2 hover:bg-teal-700 font-medium text-sm disabled:opacity-50"
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
function KudosModal({
  isOpen,
  onClose,
  task,
  onSend,
}: {
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Task Approved! ✓"
      size="medium"
    >
      <div className="space-y-4">
        <div className="bg-sage-100 rounded-2xl p-4 border border-teal-200">
          <div className="text-sm font-medium text-teal-900">{task.title}</div>
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
            className="w-full rounded-2xl border px-3 py-2 text-sm min-h-[100px] focus:ring-2 focus:ring-teal-200 outline-none"
          />
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button
            onClick={() => {
              onSend("");
              onClose();
            }}
            className="px-4 py-2 border rounded-full hover:bg-neutral-50 text-sm"
          >
            Skip
          </button>
          <button
            onClick={handleSend}
            className="flex-1 bg-teal-600 text-white rounded-full px-4 py-2 hover:bg-teal-700 font-medium text-sm"
          >
            {kudosText ? "Send Kudos & Approve" : "Approve Without Message"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Career Path — real gamification: points_log-backed XP/level (via
   awardPoints in useDatabase.ts), a daily streak computed from completed
   tasks, and kudos received pulled from the existing messages table.
   Scoped to this page only, per the "keep Today calm" rule.
   ────────────────────────────────────────────────────────────────── */
function computeStreak(dates: Date[]): number {
  if (dates.length === 0) return 0;
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const daySet = new Set(dates.map(dayKey));

  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  // A streak isn't broken just because you haven't finished anything *yet*
  // today — if today has nothing logged, start counting from yesterday.
  if (!daySet.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (daySet.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function CareerPathPage({
  level,
  xp,
  tasks,
  messages,
  userName,
  userId,
}: {
  level: number;
  xp: number;
  tasks: DBTask[];
  messages: Message[];
  userName: string;
  userId?: string;
}) {
  const myCompleted = tasks.filter(
    (t) => t.status === "completed" && (t.assigned_to === userId || t.assignee_name === userName)
  );

  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const completedThisWeek = myCompleted.filter(
    (t) => t.completed_at && new Date(t.completed_at) >= startOfWeek
  );
  const completedThisMonth = myCompleted.filter(
    (t) => t.completed_at && new Date(t.completed_at) >= startOfMonth
  );
  const totalXPEarned = myCompleted.reduce((sum, t) => sum + (XP_BY_IMPACT[t.impact] ?? 0), 0);
  const pct = Math.min(100, Math.round((xp / LEVEL_XP_THRESHOLD) * 100));

  const streak = computeStreak(
    myCompleted.filter((t) => t.completed_at).map((t) => new Date(t.completed_at as string))
  );

  const kudosReceived = messages
    .filter((m) => m.is_kudos && (m.to_user_id === userId || !m.to_user_id))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <Card title="Career Path" subtitle="Your progress">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <LevelRing level={level} value={xp} max={LEVEL_XP_THRESHOLD} />
          <div className="flex-1 space-y-3">
            <div>
              <div className="text-sm text-neutral-600">
                {xp} / {LEVEL_XP_THRESHOLD} pts &nbsp;·&nbsp; {LEVEL_XP_THRESHOLD - xp} pts to Level {level + 1}
              </div>
              <div className="mt-2 h-2.5 w-full max-w-xs rounded-full bg-teal-100 overflow-hidden">
                <div className="h-full bg-teal-600 transition-all rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[11px] px-2 py-1 rounded-full bg-cream-50 border border-teal-200 text-teal-800 whitespace-nowrap">Small = 5 pts</span>
              <span className="text-[11px] px-2 py-1 rounded-full bg-cream-50 border border-teal-200 text-teal-800 whitespace-nowrap">Medium = 10 pts</span>
              <span className="text-[11px] px-2 py-1 rounded-full bg-cream-50 border border-teal-200 text-teal-800 whitespace-nowrap">Large = 20 pts</span>
            </div>
          </div>
          <div className="flex-shrink-0 rounded-2xl bg-forest-900 text-cream-50 px-5 py-4 text-center min-w-[110px]">
            <div className="text-3xl font-bold">{streak}</div>
            <div className="text-xs mt-0.5 opacity-80">day streak {streak > 0 ? "\ud83d\udd25" : ""}</div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "This Week", value: completedThisWeek.length, sub: "completed" },
          { label: "This Month", value: completedThisMonth.length, sub: "completed" },
          { label: "All Time", value: myCompleted.length, sub: "completed" },
          { label: "Total Points", value: totalXPEarned, sub: "earned" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-white border border-cream-200 p-4 text-center">
            <div className="text-2xl font-bold text-teal-700">{s.value}</div>
            <div className="text-xs font-medium text-neutral-700 mt-0.5">{s.label}</div>
            <div className="text-[11px] text-neutral-400">{s.sub}</div>
          </div>
        ))}
      </div>

      <Card title="Kudos received" subtitle="Shoutouts from the team">
        <div className="space-y-2">
          {kudosReceived.length === 0 && (
            <div className="text-sm text-neutral-400 text-center py-4">
              No kudos yet — they'll show up here when teammates cheer you on.
            </div>
          )}
          {kudosReceived.map((m) => (
            <div key={m.id} className="rounded-2xl bg-cream-50 border border-cream-200 p-3">
              <div className="text-sm text-neutral-800">{m.content}</div>
              <div className="text-xs text-neutral-400 mt-1">
                {m.from_name ?? "A teammate"} · {new Date(m.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div>
        <h3 className="text-sm font-semibold text-neutral-700 mb-3">
          Completed Tasks <span className="font-normal text-neutral-400">({myCompleted.length})</span>
        </h3>
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {myCompleted.length === 0 && (
            <div className="rounded-2xl bg-white border border-cream-200 p-6 text-sm text-neutral-400 text-center">
              No completed tasks yet — finish your first one to earn points!
            </div>
          )}
          {[...myCompleted]
            .sort((a, b) => {
              const da = a.completed_at ? new Date(a.completed_at).getTime() : 0;
              const db = b.completed_at ? new Date(b.completed_at).getTime() : 0;
              return db - da;
            })
            .map((t) => (
              <div key={t.id} className="rounded-2xl bg-white border border-cream-200 p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  <div className="text-xs text-neutral-500 mt-0.5 flex items-center gap-2">
                    <span>{t.company_name ?? "\u2014"}</span>
                    {t.completed_at && (
                      <>
                        <span className="text-neutral-300">·</span>
                        <span>{new Date(t.completed_at).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                      </>
                    )}
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 flex-shrink-0 font-medium">
                  +{XP_BY_IMPACT[t.impact] ?? 0} pts
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Main App Component
   ────────────────────────────────────────────────────────────────── */
export default function DashboardApp() {
  const session = useSession();
  const { profile } = useProfile();
  const { teamMembers, loading: loadingTeam } = useTeamMembers();
  const {
    tasks,
    loading: tasksLoading,
    refetch,
  } = useTasks({ status: ["focus", "active", "submitted"] });
  // Separate fetch for completed tasks — the active-only query above never
  // includes them, so Career Path (and any future "completed history" view)
  // needs its own source rather than silently showing zero data.
  const { tasks: completedTasks, refetch: refetchCompletedTasks } = useTasks({
    status: "completed",
  });


// Clients & Products (real DB data)
// NOTE: useDatabase hook return shapes can differ; this normalizes safely.
const clientsHook: any = useClients();
const productsHook: any = useProducts();

const dbClients: Client[] =
  (clientsHook?.clients ?? clientsHook?.data ?? clientsHook ?? []) as Client[];
const dbProducts: Product[] =
  (productsHook?.products ?? productsHook?.data ?? productsHook ?? []) as Product[];


  // NEW: Messages from database with real-time sync
  const { messages, unreadCount, refetch: refetchMessages } = useMessages();
  const hasUnreadMessages = unreadCount > 0;

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
  const [searchQuery, setSearchQuery] = useState("");
  const [taskFilters, setTaskFilters] = useState({
    company: "all",
    impact: "all",
    priority: "all",
    status: "all",
    assignee: "all",
  });
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
const [showCreateClientModal, setShowCreateClientModal] = useState(false);
const [showCreateProductModal, setShowCreateProductModal] = useState(false);
const [prefillCompanyForCreate, setPrefillCompanyForCreate] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // NEW: Edit task modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<DBTask | null>(null);

  // NEW: Client management
  const [showClientModal, setShowClientModal] = useState(false);
  const [selectedClientForEdit, setSelectedClientForEdit] = useState<Client | null>(null);

  // NEW: Product management
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<Product | null>(null);

  // NEW: SOP management
  const [showSOPModal, setShowSOPModal] = useState(false);
  const [selectedSOPForEdit, setSelectedSOPForEdit] = useState<SOP | null>(null);

  // NEW: Approval queue (founders only)
  const [showApprovalQueue, setShowApprovalQueue] = useState(false);

  // Getting Started wizard (claude/backstage-os-philosophy.md — Onboarding
  // Philosophy). Auto-shows once for any company that hasn't completed it;
  // can also be replayed manually from Settings.
  const { companies: allCompanies, loading: companiesLoading, refetch: refetchCompanies } = useCompanies();
  const [wizardCompany, setWizardCompany] = useState<Company | null>(null);
  const [wizardIsManualReplay, setWizardIsManualReplay] = useState(false);
  const [autoWizardDismissed, setAutoWizardDismissed] = useState(false);

  useEffect(() => {
    if (companiesLoading || autoWizardDismissed || wizardCompany) return;
    const needsOnboarding = allCompanies.find((c) => !c.onboarding_completed_at);
    if (needsOnboarding) setWizardCompany(needsOnboarding);
  }, [allCompanies, companiesLoading, autoWizardDismissed, wizardCompany]);

  const role: Role = profile?.role
    ? fromDbToUi[profile.role as AppRole]
    : "Founder";
  const level = profile?.level || 1;
  const xp = profile?.xp || 0;
  const userName =
    session?.user?.user_metadata?.full_name ??
    session?.user?.email?.split("@")[0] ??
    "Sierra";

  const completedThisWeek = tasks.filter(
    (t) => t.status === "completed"
  ).length;

  const filteredTasks = tasks.filter((t) => {
    // Search filter
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase());

    // Company filter
    const matchesCompany =
      taskFilters.company === "all" || t.company_name === taskFilters.company;

    // Impact filter
    const matchesImpact =
      taskFilters.impact === "all" || t.impact === taskFilters.impact;

    // Priority filter
    const matchesPriority =
      taskFilters.priority === "all" || t.priority === taskFilters.priority;

    // Status filter
    const matchesStatus =
      taskFilters.status === "all" || t.status === taskFilters.status;

    // Assignee filter (only for founders)
    const matchesAssignee =
      taskFilters.assignee === "all" ||
      t.assignee_name === taskFilters.assignee;

    return (
      matchesSearch &&
      matchesCompany &&
      matchesImpact &&
      matchesPriority &&
      matchesStatus &&
      matchesAssignee
    );
  });

  const focusTasks = filteredTasks.filter((t) => t.status === "focus");
  const activeTasks = filteredTasks.filter((t) => t.status === "active");
  const submittedTasks = filteredTasks.filter((t) => t.status === "submitted");
  const allActiveTasks = [...focusTasks, ...activeTasks];

  async function handleComplete(task: DBTask) {
    const success = await dbCompleteTask(task.id);
    if (success) {
      // Send kudos message to team
      await sendMessage(
        `🎉 ${userName} completed: ${task.title}`,
        undefined, // No recipient = team message
        true, // is kudos
        task.id // related task
      );
      
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 1500);
      refetch();
    }
  }

  async function handleApprove(task: DBTask) {
    setKudosTask(task);
    setShowKudosModal(true);
  }

  async function handleSendKudos(kudosText: string) {
    if (!kudosTask) return;

    // Complete the task through the shared completion path so points get
    // awarded (points_log insert + profiles.xp/level bump) the same way
    // self-completion does.
    await dbCompleteTask(kudosTask.id);

    // Send kudos message if provided
    if (kudosText && kudosTask.assigned_to) {
      await sendMessage(
        kudosText,
        kudosTask.assigned_to, // Send to assignee
        true, // is kudos
        kudosTask.id // related task
      );
    }

    refetch();
    setShowKudosModal(false);
    setKudosTask(null);
  }

  async function handleAddAccomplishment(text: string, postToTeam: boolean) {
    const accomplishment: Accomplishment = {
      id: Date.now().toString(),
      user: userName,
      text,
      timestamp: Date.now(),
      postedToTeam: postToTeam,
    };

    setAccomplishments([...accomplishments, accomplishment]);

    // If posting to team, send message to database
    if (postToTeam) {
      await sendMessage(
        `🎉 ${text}`,
        undefined, // team message
        false, // not kudos
        undefined // no related task
      );
    }
  }

  async function handleSendMessage(content: string, to?: string) {
    // Find the recipient's user ID if it's a DM
    let toUserId: string | undefined;
    if (to) {
      const recipient = teamMembers.find(tm => tm.display_name === to);
      toUserId = recipient?.id;
    }
    
    await sendMessage(content, toUserId);
    // Real-time subscription will update messages automatically
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
            <Card
              title="Ask Claude"
              variant="compact"
              className="h-full flex flex-col"
            >
              <AssistantChat />
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
                  <h2 className="text-[15px] font-semibold leading-tight">
                    Today's Focus
                  </h2>
                  <p className="text-xs text-neutral-600">
                    Smartly chosen by due date, priority & quick wins
                  </p>
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
            <Card
              title="Submitted for Approval"
              subtitle="Approve or return with notes"
              className={`${equalCardH} flex flex-col`}
            >
              <div className="relative flex-1 overflow-y-auto pr-1">
                <div className="space-y-2">
                  {submittedTasks.length === 0 && (
                    <div className="text-xs text-neutral-500">
                      Nothing pending.
                    </div>
                  )}
                  {submittedTasks.map((t) => (
                    <div
                      key={t.id}
                      className="rounded-2xl border p-3 flex items-center justify-between gap-3 bg-white"
                    >
                      <div
                        className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                        onClick={() => openTaskModal(t)}
                      >
                        <Avatar
                          name={t.assignee_name || "Unassigned"}
                          size={22}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">
                            {t.title}
                          </div>
                          <div className="text-xs text-neutral-500">
                            {t.company_name}{" "}
                            {t.assignee_name ? `• @${t.assignee_name}` : ""}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs flex gap-2">
                        <button
                          className="rounded-full border px-2 py-1 hover:border-teal-300"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApprove(t);
                          }}
                        >
                          Approve
                        </button>
                        <button
                          className="rounded-full border px-2 py-1 hover:border-teal-300"
                          onClick={(e) => {
                            e.stopPropagation();
                            const note = prompt(
                              "Add a note:",
                              "Please revise and resubmit"
                            );
                            if (note) {
                              dbUpdateTask(t.id, {
                                status: "active",
                                description: `${t.description}\n\nReturned: ${note}`,
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
              <BrandSnapshot
                allTasks={allActiveTasks}
                onCompanyClick={handleCompanyClick}
              />
            </div>
          </div>
          <div className="col-span-12 md:col-span-4">
            <div className={equalCardH}>
              <BusinessSnapshot
                stats={[
                  {
                    icon: "\uD83C\uDFE2",
                    label: allCompanies.length === 1 ? "Company" : "Companies",
                    value: allCompanies.length,
                  },
                  {
                    icon: "\uD83E\uDD1D",
                    label: "Active clients",
                    value: dbClients.filter((c) => c.stage === "active").length,
                  },
                  {
                    icon: "\uD83D\uDCCB",
                    label: "Tasks in motion",
                    value: allActiveTasks.length,
                  },
                  {
                    icon: "\u2705",
                    label: "Completed this week",
                    value: completedTasks.filter((t) => {
                      if (!t.completed_at) return false;
                      const days =
                        (Date.now() - new Date(t.completed_at).getTime()) /
                        86400000;
                      return days <= 7;
                    }).length,
                  },
                ]}
              />
            </div>
          </div>
          <div className="col-span-12 md:col-span-4">
            <Card className={`${equalCardH} flex flex-col`}>
              <div className="flex items-center justify-between mb-3 flex-shrink-0 relative z-20">
                <div>
                  <h2 className="text-[14px] md:text-[15px] font-semibold leading-tight">
                    Accomplishments
                  </h2>
                  <p className="text-xs md:text-[13px] text-neutral-500">
                    Celebrate wins
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setShowAddAccomplishment(true);
                  }}
                  className="rounded-full bg-teal-600 relative z-30 cursor-pointer pointer-events-auto text-white px-3 py-1 hover:bg-teal-700 text-xs font-medium"
                >
                  Add
                </button>
              </div>
              <div className="space-y-3 overflow-y-auto flex-1">
                {accomplishments
                  .slice(-5)
                  .reverse()
                  .map((acc) => (
                    <div
                      key={acc.id}
                      className="rounded-2xl border p-3 bg-white"
                    >
                      <div className="text-sm font-medium">{acc.text}</div>
                      <div className="text-xs text-neutral-500 mt-1">
                        {acc.user} •{" "}
                        {new Date(acc.timestamp).toLocaleDateString()}
                        {acc.postedToTeam && " • Posted to team"}
                      </div>
                    </div>
                  ))}
                {accomplishments.length === 0 && (
                  <div className="rounded-2xl border p-3 bg-white">
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
    const myTasks = filteredTasks.filter((t) => t.assignee_name === userName);

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
            <Card
              title="Ask Claude"
              variant="compact"
              className="h-full flex flex-col"
            >
              <AssistantChat />
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
                  <h2 className="text-[15px] font-semibold leading-tight">
                    Today's Focus
                  </h2>
                  <p className="text-xs text-neutral-600">
                    Your top priorities
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="rounded-full border-2 border-teal-600 bg-white text-teal-600 px-3 py-1 hover:bg-teal-50 text-xs font-medium"
                >
                  NEW
                </button>
              </header>
              <div className="relative h-[300px] overflow-y-auto pr-1">
                <TaskList
                  tasks={focusTasks.filter((t) => t.assignee_name === userName)}
                  onTaskClick={openTaskModal}
                />
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[#ECF7F3] to-transparent" />
              </div>
            </section>
          </div>

          <div className="col-span-12 md:col-span-6">
            <Card
              title="Full Task List"
              subtitle="Everything on your plate"
              className={`${equalCardH} flex flex-col`}
            >
              <div className="mb-3">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="text-xs bg-teal-600 text-white rounded-full px-3 py-1.5 hover:bg-teal-700 font-medium"
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
            <Card
              title="Submitted for Approval"
              subtitle="Waiting on founder"
              className={`${equalCardH} flex flex-col`}
            >
              <div className="relative flex-1 overflow-y-auto pr-1">
                <div className="space-y-2">
                  {submittedTasks.filter((t) => t.assignee_name === userName)
                    .length === 0 && (
                    <div className="text-xs text-neutral-500">
                      You have no pending submissions.
                    </div>
                  )}
                  {submittedTasks
                    .filter((t) => t.assignee_name === userName)
                    .map((t) => (
                      <div
                        key={t.id}
                        onClick={() => openTaskModal(t)}
                        className="rounded-2xl border p-3 flex items-center justify-between gap-3 bg-white cursor-pointer hover:border-teal-300"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar name={t.assignee_name || "You"} size={22} />
                          <div>
                            <div className="text-sm font-medium">{t.title}</div>
                            <div className="text-xs text-neutral-500">
                              {t.company_name} • Pending
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </Card>
          </div>
          <div className="col-span-12 md:col-span-4">
            <div className={equalCardH}>
              <BusinessSnapshot
                stats={[
                  {
                    icon: "📋",
                    label: "My tasks in motion",
                    value: myTasks.length,
                  },
                  {
                    icon: "⏳",
                    label: "Waiting on founder",
                    value: submittedTasks.filter((t) => t.assignee_name === userName).length,
                  },
                  {
                    icon: "🏢",
                    label: "Companies you touch",
                    value: new Set(myTasks.map((t) => t.company_name)).size,
                  },
                  {
                    icon: "✅",
                    label: "Completed this week",
                    value: completedTasks.filter((t) => {
                      if (t.assignee_name !== userName || !t.completed_at) return false;
                      const days =
                        (Date.now() - new Date(t.completed_at).getTime()) /
                        86400000;
                      return days <= 7;
                    }).length,
                  },
                ]}
              />
            </div>
          </div>
          <div className="col-span-12 md:col-span-4">
            <Card className={`${equalCardH} flex flex-col`}>
              <div className="flex items-center justify-between mb-3 flex-shrink-0 relative z-20">
                <div>
                  <h2 className="text-[14px] md:text-[15px] font-semibold leading-tight">
                    Accomplishments
                  </h2>
                  <p className="text-xs md:text-[13px] text-neutral-500">
                    Celebrate wins
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setShowAddAccomplishment(true);
                  }}
                  className="rounded-full bg-teal-600 relative z-30 cursor-pointer pointer-events-auto text-white px-3 py-1 hover:bg-teal-700 text-xs font-medium"
                >
                  Add
                </button>
              </div>
              <div className="space-y-3 overflow-y-auto flex-1">
                {accomplishments
                  .slice(-5)
                  .reverse()
                  .map((acc) => (
                    <div
                      key={acc.id}
                      className="rounded-2xl border p-3 bg-white"
                    >
                      <div className="text-sm font-medium">{acc.text}</div>
                      <div className="text-xs text-neutral-500 mt-1">
                        {new Date(acc.timestamp).toLocaleDateString()}
                        {acc.postedToTeam && " • Posted to team"}
                      </div>
                    </div>
                  ))}
                {accomplishments.length === 0 && (
                  <div className="rounded-2xl border p-3 bg-white">
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
      {wizardCompany && (
        <OnboardingWizard
          company={wizardCompany}
          onSkip={() => {
            setWizardCompany(null);
            setWizardIsManualReplay(false);
            if (!wizardIsManualReplay) setAutoWizardDismissed(true);
          }}
          onComplete={() => {
            setWizardCompany(null);
            setWizardIsManualReplay(false);
            refetchCompanies();
            (clientsHook as any)?.refetch?.();
            refetch();
          }}
        />
      )}
      <div className="flex">
        <Sidebar
          role={role}
          active={page}
          onSelect={setPage as any}
          userName={userName}
        />
        <main className="flex-1 p-4 md:p-6 lg:p-8 pt-0 space-y-6">
          <TopHeader
            name={userName}
            levelXP={xp}
            levelMax={LEVEL_XP_THRESHOLD}
            onSearch={setSearchQuery}
            onOpenChat={() => {
              setShowChat(true);
              // Unread messages handled by useMessages hook
            }}
            unreadCount={unreadCount}
          />

          {page === "Today" &&
            (isFounder(role) ? <TodayFounder /> : <TodayTeam />)}
          {page === "Meetings" && isFounder(role) && <MeetingsPage />}
          {page === "Tasks" && (
            <div className="space-y-4">
              <Card title="Filters">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <select
                    value={taskFilters.company}
                    onChange={(e) =>
                      setTaskFilters({
                        ...taskFilters,
                        company: e.target.value,
                      })
                    }
                    className="rounded-2xl border px-3 py-2 text-sm"
                  >
                    <option value="all">All Companies</option>
                    {COMPANIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  <select
                    value={taskFilters.impact}
                    onChange={(e) =>
                      setTaskFilters({ ...taskFilters, impact: e.target.value })
                    }
                    className="rounded-2xl border px-3 py-2 text-sm"
                  >
                    <option value="all">All Levels</option>
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>

                  <select
                    value={taskFilters.priority}
                    onChange={(e) =>
                      setTaskFilters({
                        ...taskFilters,
                        priority: e.target.value,
                      })
                    }
                    className="rounded-2xl border px-3 py-2 text-sm"
                  >
                    <option value="all">All Priorities</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>

                  <select
                    value={taskFilters.status}
                    onChange={(e) =>
                      setTaskFilters({ ...taskFilters, status: e.target.value })
                    }
                    className="rounded-2xl border px-3 py-2 text-sm"
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
                      onChange={(e) =>
                        setTaskFilters({
                          ...taskFilters,
                          assignee: e.target.value,
                        })
                      }
                      className="rounded-2xl border px-3 py-2 text-sm"
                    >
                      <option value="all">All Team Members</option>
                      {teamMembers.map((tm) => (
                        <option key={tm.id} value={tm.display_name || ""}>
                          {tm.display_name || "Unknown"}
                        </option>
                      ))}
                      <option value="">Unassigned</option>
                    </select>
                  )}
                </div>

                <button
                  onClick={() =>
                    setTaskFilters({
                      company: "all",
                      impact: "all",
                      priority: "all",
                      status: "all",
                      assignee: "all",
                    })
                  }
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
              dbClients={dbClients}
              dbProducts={dbProducts}
            />
          )}
          {page === "My Team" && isFounder(role) && (
            <MyTeamPage tasks={tasks} completedTasks={completedTasks} teamMembers={teamMembers} />
          )}
          {page === "Settings" && (
            <SettingsPage
              userName={userName}
              email={session?.user?.email ?? ""}
              companies={allCompanies}
              onReplayWizard={(c) => {
                setWizardIsManualReplay(true);
                setWizardCompany(c);
              }}
            />
          )}
          {page === "Career Path" && !isFounder(role) && (
            <CareerPathPage
              level={level}
              xp={xp}
              tasks={completedTasks}
              messages={messages}
              userName={userName}
              userId={profile?.id}
            />
          )}
          {page === "Playbook" && (
            <Card title="Playbook" subtitle="SOPs and guides">
              <div className="text-sm text-neutral-500">
                Coming soon with database integration
              </div>
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
        profileId={profile?.id}
      />

      <TaskCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={refetch}
        role={role}
        userName={userName}
        teamMembers={teamMembers}
      />

      <CompanyModal
        companyName={selectedCompany}
        isOpen={!!selectedCompany}
        onClose={() => setSelectedCompany(null)}
        onClientClick={setSelectedClient}
        onProductClick={setSelectedProduct}
        dbClients={dbClients}
        dbProducts={dbProducts}
        role={role}
        onAddClient={(companyName) => {
          setPrefillCompanyForCreate(companyName);
          setShowCreateClientModal(true);
        }}
        onAddProduct={(companyName) => {
          setPrefillCompanyForCreate(companyName);
          setShowCreateProductModal(true);
        }}
      />

<CreateClientModal
  isOpen={showCreateClientModal}
  onClose={() => setShowCreateClientModal(false)}
  companyName={prefillCompanyForCreate}
  onCreated={() => {
    (clientsHook as any)?.refetch?.();
  }}
/>

<CreateProductModal
  isOpen={showCreateProductModal}
  onClose={() => setShowCreateProductModal(false)}
  companyName={prefillCompanyForCreate}
  onCreated={() => {
    (productsHook as any)?.refetch?.();
  }}
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
            teamMembers={teamMembers}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
