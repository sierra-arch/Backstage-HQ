// types.ts
// Shared types/constants extracted from DashboardApp.tsx (modularized)

export type AppRole = "founder" | "team";
export type Role = "Founder" | "Team";
export const fromDbToUi: Record<AppRole, Role> = { founder: "Founder", team: "Team" };
export const isFounder = (r: Role) => r === "Founder";

export const COMPANIES = ["Prose Florals", "Backstage", "Mairé"] as const;
export type CompanyName = (typeof COMPANIES)[number];

export const XP_BY_IMPACT = { small: 5, medium: 10, large: 20 } as const;
export const LEVEL_XP_THRESHOLD = 200;
export const TIME_BY_LEVEL = { small: 20, medium: 45, large: 90 } as const;

export type DBTask = {
  id: string;
  title: string;
  description: string | null;
  company_id: string | null;
  assigned_to: string | null;
  status: "focus" | "active" | "submitted" | "completed" | "archived";
  priority: "low" | "medium" | "high";
  impact: "small" | "medium" | "large";
  estimate_minutes: number;
  company_name?: string;
  assignee_name?: string;
  due_date?: string | null;
  photo_url?: string | null;
};

export type Client = {
  id: string;
  company_id?: string | null;
  name: string;
  photo_url?: string | null;
  description?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  scope?: string | null;
  quick_links?: { name: string; url: string }[] | null;
  deadline?: string | null;
  client_status?: "active" | "completed" | "archived";
  // allow extra DB fields without breaking compile
  [k: string]: any;
};

export type Product = {
  id: string;
  company_id?: string | null;
  name: string;
  photo_url?: string;
  description?: string;
  etsy_link?: string;
  sku?: string;
  date_added?: string;
  months_active?: number;
  [k: string]: any;
};

export type CompanyData = {
  id?: string;
  name: string;
  logo_url?: string;
  description?: string;
  color?: string;
  social_links?: { platform: string; url: string }[];
  software_links?: { name: string; url: string }[];
  // allow additional columns from Supabase
  [k: string]: any;
};

export type Message = {
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

export type FounderPage =
  | "Today"
  | "Meetings"
  | "Tasks"
  | "Companies"
  | "Playbook"
  | "My Team"
  | "Settings";
export type TeamPage =
  | "Today"
  | "Tasks"
  | "Companies"
  | "Playbook"
  | "Career Path"
  | "Settings";
export type Page = FounderPage | TeamPage;

// Task weight used for company progress
export const TASK_WEIGHT: Record<DBTask["impact"], number> = {
  small: 1,
  medium: 2,
  large: 3,
};

export type Accomplishment = {
  id: string;
  user: string;
  text: string;
  timestamp: number;
  postedToTeam: boolean;
};
