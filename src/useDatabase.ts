// =====================================================
// SUPABASE DATABASE HOOKS
// React hooks for interacting with your database
// =====================================================

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "./supabase";
import type { TemplateSection, Selections } from "../api/_lib/proposalEngine";

// =====================================================
// TYPES
// =====================================================

export type AppRole = "founder" | "team";

export interface Profile {
  id: string;
  display_name: string | null;
  role: AppRole | null;
  avatar_url: string | null;
  xp: number;
  level: number;
  created_at: string;
  updated_at: string;
  // Per-person UI preference (migration 0030) driving the global company
  // switcher and whole-app stage theming -- falls back to the first
  // company in the list when null.
  active_company_id: string | null;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color_scheme: {
    bg: string;
    text: string;
    border: string;
  } | null;
  is_active: boolean;
  plan: "starter" | "growth" | "pro";
  custom_domain: string | null;
  current_stage: "one" | "two" | "three";
  created_at: string;
  updated_at: string;
  onboarding_completed_at?: string | null;
  purpose?: string | null;
  who_they_serve?: string | null;
  how_they_serve?: string | null;
  boundaries?: string | null;
  vision?: string | null;
  witness_statement?: string | null;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  company_id: string | null;
  assigned_to: string | null;
  created_by: string | null;
  project_id: string | null;
  client_id: string | null;
  client_visible: boolean;
  status: "focus" | "active" | "submitted" | "completed" | "archived";
  priority: "low" | "medium" | "high";
  impact: "small" | "medium" | "large";
  estimate_minutes: number;
  due_date: string | null;
  completed_at: string | null;
  sort_order: number;
  tags: string[] | null;
  metadata: any;
  created_at: string;
  updated_at: string;
  company_name?: string;
  company_slug?: string;
  assignee_name?: string;
}

export interface Client {
  id: string;
  company_id: string | null;
  name: string;
  photo_url: string | null;
  description: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  scope: string | null;
  quick_links: { name: string; url: string }[] | null;
  deadline: string | null;
  stage: "lead" | "proposal_sent" | "active" | "delivered" | "archived";
  track: "freelancer" | "founder_mini" | "founder_full" | "ceo" | null;
  source: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  company_id: string | null;
  name: string;
  photo_url: string | null;
  description: string | null;
  price: number | null;
  status: string | null;
  quick_links: string[] | null;
  launch_date: string | null;
  created_at: string;
}

export interface SOP {
  id: string;
  company_id: string | null;
  title: string;
  short_description: string | null;
  full_description: string | null;
  instructions: { step: number; text: string }[] | null;
  role_context: string | null;
  task_count: number;
  tags: string[] | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PendingApproval {
  id: string;
  submitted_by: string;
  entity_type: "company" | "client" | "product" | "sop" | "task";
  entity_id: string | null;
  action_type: "create" | "update" | "delete";
  change_data: any;
  approval_status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export interface Message {
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
}

// =====================================================
// PROFILE HOOKS
// =====================================================

export async function ensureProfile(
  seedRole: AppRole = "team"
): Promise<Profile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const founderEmails = new Set([
    "sierrabettis@proseflorals.com",
  ]);

  const role: AppRole = founderEmails.has(user.email ?? "")
    ? "founder"
    : seedRole;

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        display_name:
          (user.user_metadata?.full_name as string | undefined) ||
          user.email?.split("@")[0] ||
          "User",
        role,
      },
      { onConflict: "id" }
    )
    .select()
    .single();

  if (error) {
    console.error("Error ensuring profile:", error);
    return null;
  }

  return data;
}

export async function fetchProfile(): Promise<Profile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Error fetching profile:", error);
    return null;
  }

  return data;
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // See useTasks/useProjects for why this needs a unique topic per
  // hook instance rather than a shared hardcoded channel name.
  const channelTopicRef = useRef(
    `profile-changes-${Math.random().toString(36).slice(2)}`
  );

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        const data = await fetchProfile();
        if (mounted) {
          setProfile(data);
          setError(null);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    const subscription = supabase
      .channel(channelTopicRef.current)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${profile?.id}`,
        },
        (payload) => {
          if (mounted && payload.new) {
            setProfile(payload.new as Profile);
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { profile, loading, error };
}

// Backs the global company switcher (Stage System Buildout) -- writing
// this is enough to update the UI everywhere, since useProfile() above
// already subscribes to postgres_changes filtered to the caller's own
// profile row.
export async function updateActiveCompany(profileId: string, companyId: string): Promise<boolean> {
  const { error } = await supabase.from("profiles").update({ active_company_id: companyId }).eq("id", profileId);
  if (error) {
    console.error("Error updating active company:", error);
    return false;
  }
  return true;
}

export async function fetchAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("display_name", { ascending: true });

  if (error) {
    console.error("Error fetching all profiles:", error);
    return [];
  }

  return data || [];
}

export async function resolveProfileIdByName(displayName: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .ilike("display_name", displayName)
    .maybeSingle();

  if (error) {
    console.error("Error resolving profile by name:", error);
    return null;
  }

  return data?.id ?? null;
}

export function useTeamMembers() {
  const [teamMembers, setTeamMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Each hook instance needs its own realtime channel topic -- see the
  // useTasks channelTopicRef comment above for the failure mode this avoids.
  const channelTopicRef = useRef(
    `team-member-changes-${Math.random().toString(36).slice(2)}`
  );

  useEffect(() => {
    let mounted = true;

    async function loadTeamMembers() {
      const data = await fetchAllProfiles();
      if (mounted) {
        setTeamMembers(data);
        setLoading(false);
      }
    }

    loadTeamMembers();

    const subscription = supabase
      .channel(channelTopicRef.current)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
        },
        () => {
          if (mounted) {
            loadTeamMembers();
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { teamMembers, loading };
}

// =====================================================
// COMPANY HOOKS
// =====================================================

export async function fetchCompanies(): Promise<Company[]> {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching companies:", error);
    return [];
  }

  return data || [];
}

export function useCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCompanies = useCallback(async () => {
    const data = await fetchCompanies();
    setCompanies(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const data = await fetchCompanies();
      if (mounted) {
        setCompanies(data);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return { companies, loading, refetch: loadCompanies };
}

export async function getCompanyByName(name: string): Promise<Company | null> {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("name", name)
    .single();

  if (error) {
    console.error("Error fetching company:", error);
    return null;
  }

  return data;
}

// =====================================================
// TASK HOOKS
// =====================================================

export async function fetchTasks(filters?: {
  status?: Task["status"] | Task["status"][];
  assignedTo?: string;
  companyId?: string;
}): Promise<Task[]> {
  let query = supabase
    .from("tasks")
    .select(
      `
      *,
      company:companies(name, slug),
      assignee:profiles!assigned_to(display_name)
    `
    )
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query = query.in("status", filters.status);
    } else {
      query = query.eq("status", filters.status);
    }
  }

  if (filters?.assignedTo) {
    query = query.eq("assigned_to", filters.assignedTo);
  }

  if (filters?.companyId) {
    query = query.eq("company_id", filters.companyId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching tasks:", error);
    return [];
  }

  return (data || []).map((task: any) => ({
    ...task,
    company_name: task.company?.name,
    company_slug: task.company?.slug,
    assignee_name: task.assignee?.display_name,
  }));
}

export function useTasks(filters?: {
  status?: Task["status"] | Task["status"][];
  assignedTo?: string;
  companyId?: string;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTasks = useCallback(async () => {
    const data = await fetchTasks(filters);
    setTasks(data);
    setLoading(false);
  }, [filters?.status, filters?.assignedTo, filters?.companyId]);

  // Each hook instance needs its own realtime channel topic. Supabase's
  // client dedupes channels by topic name and reuses the same channel
  // object when the same topic is requested again -- if two components
  // both call useTasks() with a shared hardcoded topic (e.g. "task-changes"),
  // the second .channel(topic).on(...) call attaches a listener to a
  // channel the first instance already subscribed, which throws
  // "cannot add postgres_changes callbacks ... after subscribe()". That
  // throw is uncaught and (with no error boundary) unmounts the whole
  // React tree, producing a blank screen. A unique topic per instance
  // avoids the collision entirely.
  const channelTopicRef = useRef(
    `task-changes-${Math.random().toString(36).slice(2)}`
  );

  useEffect(() => {
    let mounted = true;

    if (mounted) {
      loadTasks();
    }

    const subscription = supabase
      .channel(channelTopicRef.current)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
        },
        () => {
          if (mounted) {
            loadTasks();
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadTasks]);

  return { tasks, loading, refetch: loadTasks };
}

export async function createTask(task: Partial<Task>): Promise<Task | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      ...task,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating task:", error);
    return null;
  }

  return data;
}

export async function updateTask(
  taskId: string,
  updates: Partial<Task>
): Promise<Task | null> {
  const { data, error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", taskId)
    .select()
    .single();

  if (error) {
    console.error("Error updating task:", error);
    return null;
  }

  return data;
}

// Points awarded per task impact level — mirrors the Career Path XP scale
// (small = 5, medium = 10, large = 20). Level rolls over every 200 pts.
export const XP_BY_IMPACT: Record<string, number> = { small: 5, medium: 10, large: 20 };
export const LEVEL_XP_THRESHOLD = 200;

// Logs a points_log row for the task and bumps the assignee's profiles.xp/
// level, rolling over into new levels as the threshold is crossed. Safe to
// call multiple times for the same task in principle, but callers should
// only invoke this once per completion (see completeTask's status guard).
export async function awardPoints(
  userId: string,
  taskId: string,
  impact: string
): Promise<void> {
  const points = XP_BY_IMPACT[impact] ?? 0;
  if (points <= 0) return;

  const { error: logError } = await supabase.from("points_log").insert({
    user_id: userId,
    task_id: taskId,
    impact,
    points,
  });
  if (logError) {
    console.error("Error logging points:", logError);
    // Still try to update the profile total even if the log insert failed —
    // the log is an audit trail, not the source of truth for current xp.
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("xp, level")
    .eq("id", userId)
    .single();
  if (profileError || !profile) {
    console.error("Error fetching profile for xp update:", profileError);
    return;
  }

  let newXp = (profile.xp || 0) + points;
  let newLevel = profile.level || 1;
  while (newXp >= LEVEL_XP_THRESHOLD) {
    newXp -= LEVEL_XP_THRESHOLD;
    newLevel += 1;
  }

  const { error: updateProfileError } = await supabase
    .from("profiles")
    .update({ xp: newXp, level: newLevel })
    .eq("id", userId);
  if (updateProfileError) {
    console.error("Error updating profile xp/level:", updateProfileError);
  }
}

export async function completeTask(taskId: string): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: task, error: fetchError } = await supabase
    .from("tasks")
    .select("status, impact, estimate_minutes, assigned_to")
    .eq("id", taskId)
    .single();

  if (fetchError || !task) {
    console.error("Error fetching task:", fetchError);
    return false;
  }

  // Idempotency guard — don't re-award points if this task was already
  // marked completed (e.g. a duplicate click or race between two handlers).
  const alreadyCompleted = task.status === "completed";

  const { error: updateError } = await supabase
    .from("tasks")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (updateError) {
    console.error("Error completing task:", updateError);
    return false;
  }

  if (!alreadyCompleted && task.assigned_to) {
    await awardPoints(task.assigned_to, taskId, task.impact);
  }

  return true;
}

// =====================================================
// CLIENT FUNCTIONS
// =====================================================

export async function fetchClients(companyId?: string): Promise<Client[]> {
  let query = supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching clients:", error);
    return [];
  }

  return data || [];
}

export async function saveClient(
  client: Partial<Client>,
  requiresApproval: boolean = false
): Promise<Client | PendingApproval | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isFounder = profile?.role === "founder";

  if (isFounder || !requiresApproval) {
    if (client.id) {
      const { data, error } = await supabase
        .from("clients")
        .update(client)
        .eq("id", client.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating client:", error);
        return null;
      }
      return data;
    } else {
      const { data, error } = await supabase
        .from("clients")
        .insert({ ...client, created_by: user.id })
        .select()
        .single();

      if (error) {
        console.error("Error creating client:", error);
        return null;
      }
      return data;
    }
  }

  const { data, error } = await supabase
    .from("pending_approvals")
    .insert({
      submitted_by: user.id,
      entity_type: "client",
      entity_id: client.id || null,
      action_type: client.id ? "update" : "create",
      change_data: client,
      approval_status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating approval:", error);
    return null;
  }

  return data;
}

export function useClients(companyId?: string) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const loadClients = useCallback(async () => {
    const data = await fetchClients(companyId);
    setClients(data);
    setLoading(false);
  }, [companyId]);

  // Each hook instance needs its own realtime channel topic -- see the
  // useTasks channelTopicRef comment above for the failure mode this avoids.
  const channelTopicRef = useRef(
    `client-changes-${Math.random().toString(36).slice(2)}`
  );

  useEffect(() => {
    let mounted = true;

    if (mounted) {
      loadClients();
    }

    const subscription = supabase
      .channel(channelTopicRef.current)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "clients",
        },
        () => {
          if (mounted) {
            loadClients();
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadClients]);

  return { clients, loading, refetch: loadClients };
}

// =====================================================
// PROJECT FUNCTIONS
// =====================================================

export interface Project {
  id: string;
  client_id: string;
  company_id: string | null;
  name: string;
  status: "active" | "on_hold" | "completed" | "archived";
  start_date: string | null;
  target_delivery_date: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchProjects(clientId?: string): Promise<Project[]> {
  let query = supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching projects:", error);
    return [];
  }

  return data || [];
}

export async function createProject(project: Partial<Project>): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .insert(project)
    .select()
    .single();

  if (error) {
    console.error("Error creating project:", error);
    return null;
  }

  return data;
}

export async function updateProject(
  id: string,
  updates: Partial<Project>
): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating project:", error);
    return null;
  }

  return data;
}

export function useProjects(clientId?: string) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  // Multiple components can mount this hook at once (e.g. TaskCreateModal
  // and ClientModal are both always in the tree); Supabase realtime channel
  // names must be unique per subscription, so each hook instance needs its
  // own channel name rather than a shared fixed string.
  const channelNameRef = useRef(`project-changes-${Math.random().toString(36).slice(2)}`);

  const loadProjects = useCallback(async () => {
    const data = await fetchProjects(clientId);
    setProjects(data);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    let mounted = true;

    if (mounted) {
      loadProjects();
    }

    const subscription = supabase
      .channel(channelNameRef.current)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "projects",
        },
        () => {
          if (mounted) {
            loadProjects();
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProjects]);

  return { projects, loading, refetch: loadProjects };
}

// =====================================================
// AUTOMATION WEB FUNCTIONS (migration 0028)
//
// The `automations` table (Phase 1, migration 0012) was deliberately left
// unused by hardcoded call sites until now -- see api/_lib/automationRuntime.ts
// for the runtime that actually reads these rows. These functions are the
// read/edit side: the visual canvas at src/features/automation-web/.
// =====================================================

export type AutomationTriggerType = "proposal_accepted" | "deliverable_approved" | "project_completed";
export type AutomationActionType = "create_project_and_tasks" | "notify_team" | "request_testimonial";
export type AutomationStatus = "active" | "waiting" | "paused"; // neutral, no red/yellow/green

export interface Automation {
  id: string;
  company_id: string;
  trigger_type: AutomationTriggerType;
  action_type: AutomationActionType;
  config: Record<string, unknown>;
  active: boolean;
  title: string | null;
  subtitle: string | null;
  icon: string | null;
  status: AutomationStatus;
  position_x: number;
  position_y: number;
  clearance_departments: string[];
  created_at: string;
  updated_at: string;
}

export interface AutomationEdge {
  id: string;
  company_id: string;
  source_automation_id: string;
  target_automation_id: string;
  created_at: string;
}

export async function fetchAutomations(companyId: string): Promise<Automation[]> {
  const { data, error } = await supabase.from("automations").select("*").eq("company_id", companyId).order("created_at", { ascending: true });
  if (error) {
    console.error("Error fetching automations:", error);
    return [];
  }
  return data || [];
}

export async function fetchAutomationEdges(companyId: string): Promise<AutomationEdge[]> {
  const { data, error } = await supabase.from("automation_edges").select("*").eq("company_id", companyId);
  if (error) {
    console.error("Error fetching automation edges:", error);
    return [];
  }
  return data || [];
}

// Repositioning is pure presentation (per the Automation Web spec's "no
// auto-save on drag" rule -- reposition is the one exception that IS
// immediate/local, since it doesn't change what the automation does).
export async function updateAutomationPosition(id: string, positionX: number, positionY: number): Promise<boolean> {
  const { error } = await supabase.from("automations").update({ position_x: positionX, position_y: positionY }).eq("id", id);
  if (error) {
    console.error("Error updating automation position:", error);
    return false;
  }
  return true;
}

// Anything that changes what a chain does (active/config/clearance) goes
// through this after the inline confirm step -- see
// src/features/automation-web/panel/ConfirmChainChange.tsx.
export async function updateAutomation(
  id: string,
  updates: Partial<Pick<Automation, "active" | "status" | "config" | "clearance_departments" | "title" | "subtitle">>
): Promise<boolean> {
  const { error } = await supabase.from("automations").update(updates).eq("id", id);
  if (error) {
    console.error("Error updating automation:", error);
    return false;
  }
  return true;
}

export async function createAutomationEdge(companyId: string, sourceId: string, targetId: string): Promise<boolean> {
  const { error } = await supabase
    .from("automation_edges")
    .insert({ company_id: companyId, source_automation_id: sourceId, target_automation_id: targetId });
  if (error) {
    console.error("Error creating automation edge:", error);
    return false;
  }
  return true;
}

export async function deleteAutomationEdge(id: string): Promise<boolean> {
  const { error } = await supabase.from("automation_edges").delete().eq("id", id);
  if (error) {
    console.error("Error deleting automation edge:", error);
    return false;
  }
  return true;
}

export function useAutomationWeb(companyId: string | null) {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [edges, setEdges] = useState<AutomationEdge[]>([]);
  const [loading, setLoading] = useState(true);
  // See useProjects's channelNameRef comment above -- every hook instance
  // needs its own realtime channel name, not a shared fixed string.
  const channelNameRef = useRef(`automation-web-changes-${Math.random().toString(36).slice(2)}`);

  const load = useCallback(async () => {
    if (!companyId) {
      setAutomations([]);
      setEdges([]);
      setLoading(false);
      return;
    }
    const [automationRows, edgeRows] = await Promise.all([fetchAutomations(companyId), fetchAutomationEdges(companyId)]);
    setAutomations(automationRows);
    setEdges(edgeRows);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    let mounted = true;

    if (mounted) {
      load();
    }

    const subscription = supabase
      .channel(channelNameRef.current)
      .on("postgres_changes", { event: "*", schema: "public", table: "automations" }, () => {
        if (mounted) load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "automation_edges" }, () => {
        if (mounted) load();
      })
      .subscribe();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [load]);

  return { automations, edges, loading, refetch: load };
}

// =====================================================
// BRAND KIT FUNCTIONS
// =====================================================

export interface BrandKit {
  id: string;
  company_id: string;
  logo_variants: {
    primary?: string;
    mark_only?: string;
    light?: string;
    dark?: string;
  };
  color_primary: string | null;
  color_secondary: string | null;
  color_accent: string | null;
  font_heading: string | null;
  font_body: string | null;
  brand_description: string | null;
  tone_notes: string | null;
  policy_defaults: Record<string, string>;
  cashflow_bands: Record<string, number>;
  share_slug: string;
  created_at: string;
  updated_at: string;
}

function generateShareSlug(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

export async function fetchBrandKit(companyId: string): Promise<BrandKit | null> {
  const { data, error } = await supabase
    .from("brand_kits")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching brand kit:", error);
    return null;
  }

  return data;
}

export async function fetchBrandKitBySlug(slug: string): Promise<BrandKit | null> {
  const { data, error } = await supabase
    .from("brand_kits")
    .select("*")
    .eq("share_slug", slug)
    .maybeSingle();

  if (error) {
    console.error("Error fetching brand kit by slug:", error);
    return null;
  }

  return data;
}

export async function saveBrandKit(
  companyId: string,
  updates: Partial<BrandKit>
): Promise<BrandKit | null> {
  const existing = await fetchBrandKit(companyId);

  if (existing) {
    const { data, error } = await supabase
      .from("brand_kits")
      .update(updates)
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating brand kit:", error);
      return null;
    }
    return data;
  }

  const { data, error } = await supabase
    .from("brand_kits")
    .insert({ company_id: companyId, share_slug: generateShareSlug(), ...updates })
    .select()
    .single();

  if (error) {
    console.error("Error creating brand kit:", error);
    return null;
  }
  return data;
}

export function useBrandKit(companyId: string | null) {
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
  const [loading, setLoading] = useState(true);

  const loadBrandKit = useCallback(async () => {
    if (!companyId) {
      setBrandKit(null);
      setLoading(false);
      return;
    }
    const data = await fetchBrandKit(companyId);
    setBrandKit(data);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    loadBrandKit();
  }, [loadBrandKit]);

  return { brandKit, loading, refetch: loadBrandKit };
}

// =====================================================
// PRODUCT FUNCTIONS
// =====================================================

export async function fetchProducts(companyId?: string): Promise<Product[]> {
  let query = supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching products:", error);
    return [];
  }

  return data || [];
}

export async function saveProduct(
  product: Partial<Product>,
  requiresApproval: boolean = false
): Promise<Product | PendingApproval | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isFounder = profile?.role === "founder";

  if (isFounder || !requiresApproval) {
    if (product.id) {
      const { data, error } = await supabase
        .from("products")
        .update(product)
        .eq("id", product.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating product:", error);
        return null;
      }
      return data;
    } else {
      const { data, error } = await supabase
        .from("products")
        .insert(product)
        .select()
        .single();

      if (error) {
        console.error("Error creating product:", error);
        return null;
      }
      return data;
    }
  }

  const { data, error } = await supabase
    .from("pending_approvals")
    .insert({
      submitted_by: user.id,
      entity_type: "product",
      entity_id: product.id || null,
      action_type: product.id ? "update" : "create",
      change_data: product,
      approval_status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating approval:", error);
    return null;
  }

  return data;
}

export async function syncProductWithEtsy(
  productId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("products")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", productId);

  if (error) {
    console.error("Error syncing with Etsy:", error);
    return false;
  }

  return true;
}

export function useProducts(companyId?: string) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProducts = useCallback(async () => {
    const data = await fetchProducts(companyId);
    setProducts(data);
    setLoading(false);
  }, [companyId]);

  // Each hook instance needs its own realtime channel topic -- see the
  // useTasks channelTopicRef comment above for the failure mode this avoids.
  const channelTopicRef = useRef(
    `product-changes-${Math.random().toString(36).slice(2)}`
  );

  useEffect(() => {
    let mounted = true;

    if (mounted) {
      loadProducts();
    }

    const subscription = supabase
      .channel(channelTopicRef.current)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
        },
        () => {
          if (mounted) {
            loadProducts();
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProducts]);

  return { products, loading, refetch: loadProducts };
}

// =====================================================
// SOP FUNCTIONS
// =====================================================

export async function fetchSOPs(companyId?: string): Promise<SOP[]> {
  let query = supabase
    .from("sops")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching SOPs:", error);
    return [];
  }

  return data || [];
}

export async function saveSOP(
  sop: Partial<SOP>,
  requiresApproval: boolean = false
): Promise<SOP | PendingApproval | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isFounder = profile?.role === "founder";

  if (isFounder || !requiresApproval) {
    if (sop.id) {
      const { data, error } = await supabase
        .from("sops")
        .update(sop)
        .eq("id", sop.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating SOP:", error);
        return null;
      }
      return data;
    } else {
      const { data, error } = await supabase
        .from("sops")
        .insert({ ...sop, created_by: user.id })
        .select()
        .single();

      if (error) {
        console.error("Error creating SOP:", error);
        return null;
      }
      return data;
    }
  }

  const { data, error } = await supabase
    .from("pending_approvals")
    .insert({
      submitted_by: user.id,
      entity_type: "sop",
      entity_id: sop.id || null,
      action_type: sop.id ? "update" : "create",
      change_data: sop,
      approval_status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating approval:", error);
    return null;
  }

  return data;
}

export function useSOPs(companyId?: string) {
  const [sops, setSOPs] = useState<SOP[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSOPs = useCallback(async () => {
    const data = await fetchSOPs(companyId);
    setSOPs(data);
    setLoading(false);
  }, [companyId]);

  // Each hook instance needs its own realtime channel topic -- see the
  // useTasks channelTopicRef comment above for the failure mode this avoids.
  const channelTopicRef = useRef(
    `sop-changes-${Math.random().toString(36).slice(2)}`
  );

  useEffect(() => {
    let mounted = true;

    if (mounted) {
      loadSOPs();
    }

    const subscription = supabase
      .channel(channelTopicRef.current)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sops",
        },
        () => {
          if (mounted) {
            loadSOPs();
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadSOPs]);

  return { sops, loading, refetch: loadSOPs };
}

// =====================================================
// PENDING APPROVALS FUNCTIONS
// =====================================================

export async function fetchPendingApprovals(): Promise<PendingApproval[]> {
  const { data, error } = await supabase
    .from("pending_approvals")
    .select("*")
    .eq("approval_status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching pending approvals:", error);
    return [];
  }

  return data || [];
}

export async function approvePendingChange(
  approvalId: string
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: approval, error: fetchError } = await supabase
    .from("pending_approvals")
    .select("*")
    .eq("id", approvalId)
    .single();

  if (fetchError || !approval) {
    console.error("Error fetching approval:", fetchError);
    return false;
  }

  const { entity_type, entity_id, action_type, change_data } = approval;

  if (action_type === "create") {
    await supabase.from(`${entity_type}s`).insert(change_data);
  } else if (action_type === "update") {
    await supabase.from(`${entity_type}s`).update(change_data).eq("id", entity_id);
  } else if (action_type === "delete") {
    await supabase.from(`${entity_type}s`).delete().eq("id", entity_id);
  }

  const { error: updateError } = await supabase
    .from("pending_approvals")
    .update({
      approval_status: "approved",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", approvalId);

  if (updateError) {
    console.error("Error approving change:", updateError);
    return false;
  }

  return true;
}

export async function rejectPendingChange(
  approvalId: string,
  reason?: string
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from("pending_approvals")
    .update({
      approval_status: "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason,
    })
    .eq("id", approvalId);

  if (error) {
    console.error("Error rejecting change:", error);
    return false;
  }

  return true;
}

export function usePendingApprovals() {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  // See useTasks/useProjects for why this needs a unique topic per
  // hook instance rather than a shared hardcoded channel name.
  const channelTopicRef = useRef(
    `approval-changes-${Math.random().toString(36).slice(2)}`
  );

  const loadApprovals = useCallback(async () => {
    const data = await fetchPendingApprovals();
    setApprovals(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;

    if (mounted) {
      loadApprovals();
    }

    const subscription = supabase
      .channel(channelTopicRef.current)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pending_approvals",
        },
        () => {
          if (mounted) {
            loadApprovals();
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadApprovals]);

  return { approvals, loading, refetch: loadApprovals };
}

// =====================================================
// MESSAGES FUNCTIONS - FIXED VERSION
// =====================================================

export async function fetchMessages(): Promise<Message[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id},to_user_id.is.null`)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching messages:", error);
    return [];
  }

  const messagesWithNames = await Promise.all(
    (data || []).map(async (msg: any) => {
      const { data: fromProfile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", msg.from_user_id)
        .single();
      
      let toName = null;
      if (msg.to_user_id) {
        const { data: toProfile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", msg.to_user_id)
          .single();
        toName = toProfile?.display_name;
      }

      return {
        ...msg,
        from_name: fromProfile?.display_name || "Unknown",
        to_name: toName,
      };
    })
  );

  return messagesWithNames;
}

export async function sendMessage(
  content: string,
  toUserId?: string,
  isKudos: boolean = false,
  relatedTaskId?: string
): Promise<Message | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const messageType = isKudos ? "kudos" : toUserId ? "dm" : "team";

  const { data, error } = await supabase
    .from("messages")
    .insert({
      from_user_id: user.id,
      to_user_id: toUserId || null,
      content,
      message_type: messageType,
      is_kudos: isKudos,
      related_task_id: relatedTaskId || null,
      is_read: false,
    })
    .select()
    .single();

  if (error) {
    console.error("Error sending message:", error);
    return null;
  }

  return data;
}

export async function markMessageAsRead(messageId: string): Promise<boolean> {
  const { error } = await supabase
    .from("messages")
    .update({ is_read: true })
    .eq("id", messageId);

  if (error) {
    console.error("Error marking message as read:", error);
    return false;
  }

  return true;
}

export async function markMessagesFromUserAsRead(
  fromUserId: string
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from("messages")
    .update({ is_read: true })
    .eq("from_user_id", fromUserId)
    .eq("to_user_id", user.id)
    .eq("is_read", false);

  if (error) {
    console.error("Error marking messages as read:", error);
    return false;
  }

  return true;
}

export async function getUnreadMessageCount(): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("to_user_id", user.id)
    .eq("is_read", false);

  if (error) {
    console.error("Error getting unread count:", error);
    return 0;
  }

  return count || 0;
}

export function useMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadMessages = useCallback(async () => {
    const data = await fetchMessages();
    setMessages(data);

    const count = await getUnreadMessageCount();
    setUnreadCount(count);

    setLoading(false);
  }, []);

  // Each hook instance needs its own realtime channel topic -- see the
  // useTasks channelTopicRef comment above for the failure mode this avoids.
  const channelTopicRef = useRef(
    `message-changes-${Math.random().toString(36).slice(2)}`
  );

  useEffect(() => {
    let mounted = true;

    if (mounted) {
      loadMessages();
    }

    const subscription = supabase
      .channel(channelTopicRef.current)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        () => {
          if (mounted) {
            loadMessages();
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadMessages]);

  return { 
    messages, 
    loading, 
    unreadCount,
    refetch: loadMessages 
  };
}

// =====================================================
// PROPOSAL ENGINE (document_templates / generated_documents /
// proposals / payment_schedules / payment_installments)
// =====================================================

export interface DocumentTemplate {
  id: string;
  company_id: string;
  type: string;
  name: string;
  structure: TemplateSection[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface GeneratedDocument {
  id: string;
  template_id: string;
  client_id: string | null;
  field_values: { authored: Record<string, unknown>; selections: Selections };
  status: "draft" | "finalized" | "sent" | "viewed";
  gdrive_file_id: string | null;
  gdrive_folder_id: string | null;
  last_synced_at: string | null;
  edit_locked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProposalRecord {
  id: string;
  client_id: string;
  status: "draft" | "sent" | "viewed" | "accepted" | "declined";
  generated_document_id: string | null;
  event_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentSchedule {
  id: string;
  proposal_id: string | null;
  client_id: string;
  total_amount: number;
  created_at: string;
}

export interface PaymentInstallment {
  id: string;
  payment_schedule_id: string;
  sequence_number: number;
  amount: number;
  due_rule_type: "on_signing" | "days_after_signing" | "days_before_event";
  due_rule_offset_days: number | null;
  due_date: string | null;
  invoice_id: string | null;
  status: "pending" | "invoiced" | "paid" | "overdue";
  created_at: string;
}

export async function createTemplate(params: {
  companyId: string;
  type: string;
  name: string;
}): Promise<DocumentTemplate | null> {
  const { data, error } = await supabase
    .from("document_templates")
    .insert({ company_id: params.companyId, type: params.type, name: params.name, structure: [] })
    .select()
    .single();
  if (error) {
    console.error("Error creating template:", error);
    return null;
  }
  return data;
}

export async function updateTemplate(
  id: string,
  updates: { name?: string; structure?: TemplateSection[]; is_default?: boolean }
): Promise<boolean> {
  const { error } = await supabase.from("document_templates").update(updates).eq("id", id);
  if (error) {
    console.error("Error updating template:", error);
    return false;
  }
  return true;
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const { error } = await supabase.from("document_templates").delete().eq("id", id);
  if (error) {
    console.error("Error deleting template:", error);
    return false;
  }
  return true;
}

export async function fetchDocumentTemplates(
  companyId: string,
  type?: string
): Promise<DocumentTemplate[]> {
  let query = supabase.from("document_templates").select("*").eq("company_id", companyId);
  if (type) query = query.eq("type", type);
  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching document templates:", error);
    return [];
  }
  return data || [];
}

// Creates a generated_documents row from a template plus a linked
// proposals row (needed so the payment engine has an event_date to work
// from). Both inserts happen for every proposal we create — a
// generated_document with no linked proposal row would have nowhere to
// hang its event date or accept/decline lifecycle.
export async function createProposal(params: {
  templateId: string;
  clientId: string;
  companyId: string;
  eventDate: string | null;
  authored: Record<string, unknown>;
}): Promise<{ generatedDocument: GeneratedDocument; proposal: ProposalRecord } | null> {
  const { data: doc, error: docError } = await supabase
    .from("generated_documents")
    .insert({
      template_id: params.templateId,
      client_id: params.clientId,
      field_values: { authored: params.authored, selections: {} },
      status: "draft",
    })
    .select()
    .single();

  if (docError || !doc) {
    console.error("Error creating generated document:", docError);
    return null;
  }

  const { data: proposal, error: proposalError } = await supabase
    .from("proposals")
    .insert({
      client_id: params.clientId,
      generated_document_id: doc.id,
      event_date: params.eventDate,
      status: "draft",
    })
    .select()
    .single();

  if (proposalError || !proposal) {
    console.error("Error creating proposal:", proposalError);
    // Clean up the orphaned document rather than leaving a
    // generated_document with no proposal wrapper around it.
    await supabase.from("generated_documents").delete().eq("id", doc.id);
    return null;
  }

  return { generatedDocument: doc, proposal };
}

export async function markProposalSent(generatedDocumentId: string, proposalId: string): Promise<boolean> {
  const { error: docErr } = await supabase
    .from("generated_documents")
    .update({ status: "sent" })
    .eq("id", generatedDocumentId);
  const { error: propErr } = await supabase
    .from("proposals")
    .update({ status: "sent" })
    .eq("id", proposalId);
  if (docErr || propErr) {
    console.error("Error marking proposal sent:", docErr || propErr);
    return false;
  }
  return true;
}

export type ProposalWithDocument = ProposalRecord & { generated_documents: GeneratedDocument | null };

export async function fetchProposalsForClient(clientId: string): Promise<ProposalWithDocument[]> {
  const { data, error } = await supabase
    .from("proposals")
    .select("*, generated_documents(*)")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching proposals:", error);
    return [];
  }
  return data || [];
}

export function useProposals(clientId?: string) {
  const [proposals, setProposals] = useState<ProposalWithDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProposals = useCallback(async () => {
    if (!clientId) {
      setProposals([]);
      setLoading(false);
      return;
    }
    const data = await fetchProposalsForClient(clientId);
    setProposals(data);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    let mounted = true;
    if (mounted) loadProposals();
    return () => {
      mounted = false;
    };
  }, [loadProposals]);

  return { proposals, loading, refetch: loadProposals };
}

export async function fetchPaymentScheduleForProposal(
  proposalId: string
): Promise<{ schedule: PaymentSchedule; installments: PaymentInstallment[] } | null> {
  const { data: schedule, error: scheduleError } = await supabase
    .from("payment_schedules")
    .select("*")
    .eq("proposal_id", proposalId)
    .maybeSingle();

  if (scheduleError || !schedule) return null;

  const { data: installments, error: installmentsError } = await supabase
    .from("payment_installments")
    .select("*")
    .eq("payment_schedule_id", schedule.id)
    .order("sequence_number", { ascending: true });

  if (installmentsError) {
    console.error("Error fetching payment installments:", installmentsError);
    return { schedule, installments: [] };
  }

  return { schedule, installments: installments || [] };
}

export interface Deliverable {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: "pending" | "delivered" | "approved" | "revision_requested";
  client_visible: boolean;
  gdrive_file_id: string | null;
  delivered_at: string | null;
  approved_at: string | null;
  revision_note: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export async function fetchDeliverablesForProject(projectId: string): Promise<Deliverable[]> {
  const { data, error } = await supabase
    .from("deliverables")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Error fetching deliverables:", error);
    return [];
  }
  return data || [];
}

export async function createDeliverable(params: {
  projectId: string;
  title: string;
  description: string;
}): Promise<Deliverable | null> {
  const { data, error } = await supabase
    .from("deliverables")
    .insert({ project_id: params.projectId, title: params.title, description: params.description || null })
    .select()
    .single();

  if (error) {
    console.error("Error creating deliverable:", error);
    return null;
  }
  return data;
}

export async function markDeliverableDelivered(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("deliverables")
    .update({ status: "delivered", delivered_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("Error marking deliverable delivered:", error);
    return false;
  }
  return true;
}

export async function setDeliverableVisibility(id: string, clientVisible: boolean): Promise<boolean> {
  const { error } = await supabase.from("deliverables").update({ client_visible: clientVisible }).eq("id", id);
  if (error) {
    console.error("Error updating deliverable visibility:", error);
    return false;
  }
  return true;
}

export interface Comment {
  id: string;
  client_id: string;
  task_id: string | null;
  deliverable_id: string | null;
  author_type: "team" | "client";
  author_profile_id: string | null;
  author_client_user_id: string | null;
  body: string;
  created_at: string;
}

// Comments have direct client-write RLS (unlike proposals/deliverables),
// so both the team and client sides post through the browser client under
// their own session -- no service-role endpoint needed here.
export async function fetchComments(params: { taskId?: string; deliverableId?: string }): Promise<Comment[]> {
  let query = supabase.from("comments").select("*").order("created_at", { ascending: true });
  if (params.taskId) query = query.eq("task_id", params.taskId);
  if (params.deliverableId) query = query.eq("deliverable_id", params.deliverableId);
  const { data, error } = await query;
  if (error) {
    console.error("Error fetching comments:", error);
    return [];
  }
  return data || [];
}

export interface CompanyMember {
  id: string;
  company_id: string;
  profile_id: string;
  role: "founder" | "team" | "contractor";
  // Additive to `role` (migration 0028), not a replacement -- department
  // tags scope which Automation Web nodes this member can edit
  // (clearance_departments overlap), they don't change founder/team/
  // contractor's existing nav-gating or power level. Empty by default.
  departments: string[];
  profiles: { display_name: string | null } | null;
}

// Fixed V1 default list, matching the department language already used in
// claude/backstage-os-philosophy.md -- a frontend constant, not a database
// table, since departments are a flat text[] tag (see 0028's migration
// comment on why that's the deliberate V1 choice).
export const DEPARTMENTS = [
  "Operations",
  "Sales",
  "Marketing",
  "Design/Branding",
  "Customer Service",
  "Administration",
  "Technology",
  "Production/Fulfillment",
  "Inventory Management",
  "Finance",
] as const;

export async function fetchCompanyMembers(companyId: string): Promise<CompanyMember[]> {
  const { data, error } = await supabase
    .from("company_members")
    .select("id, company_id, profile_id, role, departments, profiles(display_name)")
    .eq("company_id", companyId);
  if (error) {
    console.error("Error fetching company members:", error);
    return [];
  }
  return data as any;
}

export async function updateCompanyMemberRole(id: string, role: CompanyMember["role"]): Promise<boolean> {
  const { error } = await supabase.from("company_members").update({ role }).eq("id", id);
  if (error) {
    console.error("Error updating company member role:", error);
    return false;
  }
  return true;
}

export async function updateCompanyMemberDepartments(id: string, departments: string[]): Promise<boolean> {
  const { error } = await supabase.from("company_members").update({ departments }).eq("id", id);
  if (error) {
    console.error("Error updating company member departments:", error);
    return false;
  }
  return true;
}

// Founder-only in the UI; RLS already enforces this too (founders_manage_
// company_memberships is FOR ALL on company_members, migration 0027).
export async function removeCompanyMember(id: string): Promise<boolean> {
  const { error } = await supabase.from("company_members").delete().eq("id", id);
  if (error) {
    console.error("Error removing company member:", error);
    return false;
  }
  return true;
}

// Founder-only in the UI; the enforce_founder_only_transitions trigger
// (migration 0031/0032) rejects this transition server-side for anyone
// else, regardless of what the UI does.
export async function voidAgreement(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("agreements").update({ status: "voided" }).eq("id", id);
  if (error) {
    console.error("Error voiding agreement:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// A profile is "contractor-only" if every company_members row they hold is
// role='contractor' -- no founder/team role anywhere. Used to hide
// revenue/marketing-adjacent nav per the roles matrix (Contractor: no access
// to email marketing, automations, revenue reporting), without needing a full
// per-company context switcher -- this app's internal views are cross-
// company by default, so the only permission check that cleanly fits today
// is "does this person have any elevated role at all."
export async function fetchIsContractorOnly(profileId: string): Promise<boolean> {
  const { data, error } = await supabase.from("company_members").select("role").eq("profile_id", profileId);
  if (error || !data || data.length === 0) return false;
  return data.every((m) => m.role === "contractor");
}

export interface SocialPost {
  id: string;
  company_id: string;
  platform: "instagram" | "facebook" | "tiktok" | "pinterest" | "twitter" | "linkedin" | "other";
  content: string;
  image_url: string | null;
  scheduled_date: string | null;
  status: "draft" | "scheduled" | "posted";
  created_at: string;
  updated_at: string;
}

export async function fetchSocialPosts(companyId: string): Promise<SocialPost[]> {
  const { data, error } = await supabase.from("social_posts").select("*").eq("company_id", companyId).order("scheduled_date", { ascending: true });
  if (error) {
    console.error("Error fetching social posts:", error);
    return [];
  }
  return data || [];
}

export async function createSocialPost(params: {
  companyId: string;
  platform: SocialPost["platform"];
  content: string;
  scheduledDate: string | null;
}): Promise<SocialPost | null> {
  const { data, error } = await supabase
    .from("social_posts")
    .insert({
      company_id: params.companyId,
      platform: params.platform,
      content: params.content,
      scheduled_date: params.scheduledDate,
      status: params.scheduledDate ? "scheduled" : "draft",
    })
    .select()
    .single();
  if (error) {
    console.error("Error creating social post:", error);
    return null;
  }
  return data;
}

export async function updateSocialPost(id: string, updates: Partial<SocialPost>): Promise<boolean> {
  const { error } = await supabase.from("social_posts").update(updates).eq("id", id);
  if (error) {
    console.error("Error updating social post:", error);
    return false;
  }
  return true;
}

export async function deleteSocialPost(id: string): Promise<boolean> {
  const { error } = await supabase.from("social_posts").delete().eq("id", id);
  if (error) {
    console.error("Error deleting social post:", error);
    return false;
  }
  return true;
}

export interface EmailBroadcast {
  id: string;
  company_id: string;
  subject: string;
  body: string;
  recipient_filter: "all_clients" | "active_clients" | "leads";
  status: "draft" | "sent";
  sent_count: number;
  sent_at: string | null;
  created_at: string;
}

export async function fetchBroadcasts(companyId: string): Promise<EmailBroadcast[]> {
  const { data, error } = await supabase
    .from("email_broadcasts")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Error fetching broadcasts:", error);
    return [];
  }
  return data || [];
}

export async function createBroadcast(params: {
  companyId: string;
  subject: string;
  body: string;
  recipientFilter: EmailBroadcast["recipient_filter"];
}): Promise<EmailBroadcast | null> {
  const { data, error } = await supabase
    .from("email_broadcasts")
    .insert({ company_id: params.companyId, subject: params.subject, body: params.body, recipient_filter: params.recipientFilter })
    .select()
    .single();
  if (error) {
    console.error("Error creating broadcast:", error);
    return null;
  }
  return data;
}

export interface EmailSequence {
  id: string;
  company_id: string;
  name: string;
  active: boolean;
  created_at: string;
}

export interface EmailSequenceStep {
  id: string;
  sequence_id: string;
  step_order: number;
  delay_days: number;
  subject: string;
  body: string;
}

export async function fetchSequences(companyId: string): Promise<EmailSequence[]> {
  const { data, error } = await supabase.from("email_sequences").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
  if (error) {
    console.error("Error fetching sequences:", error);
    return [];
  }
  return data || [];
}

export async function createSequence(companyId: string, name: string): Promise<EmailSequence | null> {
  const { data, error } = await supabase.from("email_sequences").insert({ company_id: companyId, name }).select().single();
  if (error) {
    console.error("Error creating sequence:", error);
    return null;
  }
  return data;
}

export async function fetchSequenceSteps(sequenceId: string): Promise<EmailSequenceStep[]> {
  const { data, error } = await supabase
    .from("email_sequence_steps")
    .select("*")
    .eq("sequence_id", sequenceId)
    .order("step_order", { ascending: true });
  if (error) {
    console.error("Error fetching sequence steps:", error);
    return [];
  }
  return data || [];
}

export async function addSequenceStep(params: {
  sequenceId: string;
  stepOrder: number;
  delayDays: number;
  subject: string;
  body: string;
}): Promise<boolean> {
  const { error } = await supabase.from("email_sequence_steps").insert({
    sequence_id: params.sequenceId,
    step_order: params.stepOrder,
    delay_days: params.delayDays,
    subject: params.subject,
    body: params.body,
  });
  if (error) {
    console.error("Error adding sequence step:", error);
    return false;
  }
  return true;
}

export async function enrollInSequence(params: {
  sequenceId: string;
  email: string;
  leadId?: string;
  clientId?: string;
}): Promise<boolean> {
  const { error } = await supabase.from("email_sequence_enrollments").insert({
    sequence_id: params.sequenceId,
    email: params.email,
    lead_id: params.leadId ?? null,
    client_id: params.clientId ?? null,
  });
  if (error) {
    console.error("Error enrolling in sequence:", error);
    return false;
  }
  return true;
}

export interface SystemUnlock {
  id: string;
  company_id: string;
  system_name: string;
  template_type: string;
  stage: "one" | "two" | "three";
  status: "locked" | "available" | "in_progress" | "complete";
  unlocked_at: string | null;
  // The same template_type can now reappear at a later stage "in further
  // detail" (migration 0030) -- this carries the framing text for that
  // re-pass without needing a second table.
  depth_note: string | null;
}

export async function fetchSystemUnlocks(companyId: string): Promise<SystemUnlock[]> {
  const { data, error } = await supabase.from("system_unlocks").select("*").eq("company_id", companyId);
  if (error) {
    console.error("Error fetching system unlocks:", error);
    return [];
  }
  return data || [];
}

export interface StageTransition {
  id: string;
  company_id: string;
  from_stage: string;
  to_stage: string;
  offered_at: string;
  accepted_at: string | null;
}

export async function fetchPendingStageTransition(companyId: string): Promise<StageTransition | null> {
  const { data, error } = await supabase
    .from("stage_transitions")
    .select("*")
    .eq("company_id", companyId)
    .is("accepted_at", null)
    .order("offered_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("Error fetching pending stage transition:", error);
    return null;
  }
  return data;
}

// Marks a system's template complete and checks whether that finishes the
// company's current stage (which -- via check_stage_completion -- creates
// the offer to advance, but never advances the stage itself; that only
// happens when the founder explicitly accepts, per the Values Charter's
// "human agency before automation" rule).
export async function markSystemComplete(unlock: SystemUnlock): Promise<boolean> {
  const { error } = await supabase
    .from("system_unlocks")
    .update({ status: "complete", unlocked_at: new Date().toISOString() })
    .eq("id", unlock.id);
  if (error) {
    console.error("Error marking system complete:", error);
    return false;
  }
  // Keep the underlying template's completed_at in sync -- system_unlocks
  // is the source of truth for stage-gating, but the template itself
  // should reflect completion too (Phase 20's acceptance criteria).
  await supabase
    .from("document_templates")
    .update({ completed_at: new Date().toISOString() })
    .eq("company_id", unlock.company_id)
    .eq("type", unlock.template_type);
  await supabase.rpc("check_stage_completion", { p_company_id: unlock.company_id });
  return true;
}

export async function acceptStageTransition(transitionId: string): Promise<boolean> {
  const { error } = await supabase.rpc("accept_stage_transition", { p_transition_id: transitionId });
  if (error) {
    console.error("Error accepting stage transition:", error);
    return false;
  }
  return true;
}

export interface SafetyNetNudge {
  id: string;
  company_id: string;
  type: "cash_buffer" | "quiet_lead" | "seasonal_dip" | "stage_progress";
  message: string;
  created_at: string;
  dismissed_at: string | null;
  acted_at: string | null;
}

// At most one gentle suggested action at a time, per the Dashboard
// Guardrail -- the most recent undismissed/unacted nudge across every
// company this profile can see, not one per company.
export async function fetchActiveNudge(): Promise<SafetyNetNudge | null> {
  const { data, error } = await supabase
    .from("safety_net_nudges")
    .select("*")
    .is("dismissed_at", null)
    .is("acted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("Error fetching active nudge:", error);
    return null;
  }
  return data;
}

export async function dismissNudge(id: string): Promise<boolean> {
  const { error } = await supabase.from("safety_net_nudges").update({ dismissed_at: new Date().toISOString() }).eq("id", id);
  if (error) {
    console.error("Error dismissing nudge:", error);
    return false;
  }
  return true;
}

export async function markNudgeActed(id: string): Promise<boolean> {
  const { error } = await supabase.from("safety_net_nudges").update({ acted_at: new Date().toISOString() }).eq("id", id);
  if (error) {
    console.error("Error marking nudge acted:", error);
    return false;
  }
  return true;
}

export interface Lead {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  service_type: string | null;
  message: string | null;
  source: string | null;
  status: "new" | "contacted" | "proposal_sent" | "won" | "lost";
  converted_client_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchLeads(): Promise<Lead[]> {
  const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
  if (error) {
    console.error("Error fetching leads:", error);
    return [];
  }
  return data || [];
}

export async function createLead(params: { companyId: string; name: string; email: string; phone: string }): Promise<boolean> {
  const { error } = await supabase.from("leads").insert({
    company_id: params.companyId,
    name: params.name,
    email: params.email || null,
    phone: params.phone || null,
    source: "manual",
    status: "new",
  });
  if (error) {
    console.error("Error creating lead:", error);
    return false;
  }
  return true;
}

export async function updateLeadStatus(id: string, status: Lead["status"]): Promise<boolean> {
  const { error } = await supabase.from("leads").update({ status }).eq("id", id);
  if (error) {
    console.error("Error updating lead status:", error);
    return false;
  }
  return true;
}

// Converting a lead to a client is the pipeline's "Won" moment -- creates a
// real clients row (stage='lead', the first stage of the Client Journey)
// and marks the lead won + linked, rather than leaving two disconnected
// records once someone actually books.
export async function convertLeadToClient(lead: Lead): Promise<boolean> {
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      company_id: lead.company_id,
      name: lead.name,
      contact_email: lead.email,
      contact_phone: lead.phone,
      stage: "lead",
      source: lead.source,
    })
    .select("id")
    .single();

  if (clientError || !client) {
    console.error("Error converting lead to client:", clientError);
    return false;
  }

  const { error: updateError } = await supabase
    .from("leads")
    .update({ status: "won", converted_client_id: client.id })
    .eq("id", lead.id);

  if (updateError) {
    console.error("Error marking lead converted:", updateError);
    return false;
  }
  return true;
}

// Automation engine (hardcoded triggers, not a generic builder -- per
// Client Portal Expansion Phase 10). Notifies every founder of a company via
// the existing messages/unread-badge system, since a broadcast
// (to_user_id: null) message never increments unread counts (see
// getUnreadMessageCount) and would go unnoticed. from_user_id is set to the
// same founder being notified -- there's no dedicated "system" actor, and
// the message content itself makes clear it's automated.
export async function notifyFounders(companyId: string, content: string): Promise<void> {
  const { data: founders } = await supabase
    .from("company_members")
    .select("profile_id")
    .eq("company_id", companyId)
    .eq("role", "founder");

  if (!founders || founders.length === 0) return;

  await supabase.from("messages").insert(
    founders.map((f) => ({
      from_user_id: f.profile_id,
      to_user_id: f.profile_id,
      content,
      message_type: "team",
    }))
  );
}

export async function postTeamComment(params: {
  clientId: string;
  taskId?: string;
  deliverableId?: string;
  authorProfileId: string;
  body: string;
}): Promise<boolean> {
  const { error } = await supabase.from("comments").insert({
    client_id: params.clientId,
    task_id: params.taskId ?? null,
    deliverable_id: params.deliverableId ?? null,
    author_type: "team",
    author_profile_id: params.authorProfileId,
    body: params.body,
  });
  if (error) {
    console.error("Error posting comment:", error);
    return false;
  }
  return true;
}
