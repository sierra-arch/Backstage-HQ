// =====================================================
// SUPABASE DATABASE HOOKS
// React hooks for interacting with your database
// =====================================================

import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";

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
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  company_id: string | null;
  assigned_to: string | null;
  created_by: string | null;
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
  // Joined fields from views
  company_name?: string;
  company_slug?: string;
  assignee_name?: string;
}

export interface Note {
  id: string;
  content: string;
  author_id: string;
  role_context: AppRole | null;
  company_id: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action_type: string;
  xp_gained: number;
  related_task_id: string | null;
  metadata: any;
  created_at: string;
}

// =====================================================
// PROFILE HOOKS
// =====================================================

/**
 * Fetch or create user profile
 */
export async function ensureProfile(
  seedRole: AppRole = "team"
): Promise<Profile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Auto-promote certain emails to founder
  const founderEmails = new Set([
    "sierra@gobackstage.ai",
    "sierra@backstageop.com",
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

/**
 * Fetch current user's profile
 */
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

/**
 * Hook to get current user's profile with real-time updates
 */
export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    // Subscribe to profile changes
    const subscription = supabase
      .channel("profile-changes")
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

/**
 * 🆕 Fetch ALL profiles (team members)
 */
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

/**
 * 🆕 Hook to get all team members with real-time updates
 */
export function useTeamMembers() {
  const [teamMembers, setTeamMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

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

    // Subscribe to profile changes (when new users sign up or profiles update)
    const subscription = supabase
      .channel("team-member-changes")
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

/**
 * Fetch all companies
 */
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

/**
 * Hook to get all companies
 */
export function useCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadCompanies() {
      const data = await fetchCompanies();
      if (mounted) {
        setCompanies(data);
        setLoading(false);
      }
    }

    loadCompanies();

    return () => {
      mounted = false;
    };
  }, []);

  return { companies, loading };
}

// =====================================================
// TASK HOOKS
// =====================================================

/**
 * Fetch tasks with optional filters
 */
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

  // Transform the joined data
  return (data || []).map((task: any) => ({
    ...task,
    company_name: task.company?.name,
    company_slug: task.company?.slug,
    assignee_name: task.assignee?.display_name,
  }));
}

/**
 * Hook to get tasks with real-time updates
 */
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

  useEffect(() => {
    let mounted = true;

    if (mounted) {
      loadTasks();
    }

    // Subscribe to task changes
    const subscription = supabase
      .channel("task-changes")
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

/**
 * Create a new task
 */
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

/**
 * Update a task
 */
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

/**
 * Complete a task and award XP
 */
export async function completeTask(taskId: string): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  // First, get the task details
  const { data: task, error: fetchError } = await supabase
    .from("tasks")
    .select("impact, estimate_minutes")
    .eq("id", taskId)
    .single();

  if (fetchError || !task) {
    console.error("Error fetching task:", fetchError);
    return false;
  }

  // Mark task as completed
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

  // Award XP
  const { data: xpResult, error: xpError } = await supabase.rpc("award_xp", {
    p_user_id: user.id,
    p_xp_amount: await calculateTaskXP(task.impact, task.estimate_minutes),
    p_action_type: "task_completed",
    p_task_id: taskId,
  });

  if (xpError) {
    console.error("Error awarding XP:", xpError);
  }

  return true;
}

/**
 * Calculate XP for a task
 */
async function calculateTaskXP(
  impact: string,
  estimateMinutes: number
): Promise<number> {
  const { data, error } = await supabase.rpc("calculate_xp_for_task", {
    task_impact: impact,
    task_estimate: estimateMinutes,
  });

  if (error) {
    console.error("Error calculating XP:", error);
    // Fallback calculation
    const xpMap = { small: 5, medium: 10, large: 20 };
    return xpMap[impact as keyof typeof xpMap] || 5;
  }

  return data || 5;
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: string): Promise<boolean> {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);

  if (error) {
    console.error("Error deleting task:", error);
    return false;
  }

  return true;
}

/**
 * Reorder tasks
 */
export async function reorderTasks(taskIds: string[]): Promise<boolean> {
  const updates = taskIds.map((id, index) => ({
    id,
    sort_order: index,
  }));

  const { error } = await supabase.from("tasks").upsert(updates);

  if (error) {
    console.error("Error reordering tasks:", error);
    return false;
  }

  return true;
}

// =====================================================
// NOTE HOOKS
// =====================================================

/**
 * Fetch notes for current user
 */
export async function fetchNotes(): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching notes:", error);
    return [];
  }

  return data || [];
}

/**
 * Create a note
 */
export async function createNote(
  content: string,
  roleContext: AppRole,
  companyId?: string
): Promise<Note | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("notes")
    .insert({
      content,
      author_id: user.id,
      role_context: roleContext,
      company_id: companyId,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating note:", error);
    return null;
  }

  return data;
}

/**
 * Update a note
 */
export async function updateNote(
  noteId: string,
  updates: Partial<Note>
): Promise<Note | null> {
  const { data, error } = await supabase
    .from("notes")
    .update(updates)
    .eq("id", noteId)
    .select()
    .single();

  if (error) {
    console.error("Error updating note:", error);
    return null;
  }

  return data;
}

/**
 * Delete a note
 */
export async function deleteNote(noteId: string): Promise<boolean> {
  const { error } = await supabase.from("notes").delete().eq("id", noteId);

  if (error) {
    console.error("Error deleting note:", error);
    return false;
  }

  return true;
}

// =====================================================
// ACTIVITY LOG HOOKS
// =====================================================

/**
 * Fetch activity log for current user
 */
export async function fetchActivityLog(limit = 50): Promise<ActivityLog[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("activity_log")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching activity log:", error);
    return [];
  }

  return data || [];
}

/**
 * Hook to get activity log
 */
export function useActivityLog(limit = 50) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadActivities() {
      const data = await fetchActivityLog(limit);
      if (mounted) {
        setActivities(data);
        setLoading(false);
      }
    }

    loadActivities();

    return () => {
      mounted = false;
    };
  }, [limit]);

  return { activities, loading };
}

// =====================================================
// UTILITY: Get company by name
// =====================================================

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
// CLIENT TYPES AND FUNCTIONS
// =====================================================

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
  client_status: "active" | "completed" | "archived";
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  company_id: string | null;
  name: string;
  photo_url: string | null;
  description: string | null;
  sku: string | null;
  etsy_listing_id: string | null;
  etsy_url: string | null;
  price: number | null;
  inventory_count: number;
  last_synced_at: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
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

export async function deleteClient(clientId: string): Promise<boolean> {
  const { error } = await supabase.from("clients").delete().eq("id", clientId);

  if (error) {
    console.error("Error deleting client:", error);
    return false;
  }

  return true;
}

export function useClients(companyId?: string) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const loadClients = useCallback(async () => {
    const data = await fetchClients(companyId);
    setClients(data);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    let mounted = true;

    if (mounted) {
      loadClients();
    }

    const subscription = supabase
      .channel("client-changes")
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
// PRODUCT FUNCTIONS
// =====================================================

export async function fetchProducts(companyId?: string): Promise<Product[]> {
  let query = supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
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
        .insert({ ...product, created_by: user.id })
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

  useEffect(() => {
    let mounted = true;

    if (mounted) {
      loadProducts();
    }

    const subscription = supabase
      .channel("product-changes")
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

  useEffect(() => {
    let mounted = true;

    if (mounted) {
      loadSOPs();
    }

    const subscription = supabase
      .channel("sop-changes")
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
      .channel("approval-changes")
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
// MESSAGES FUNCTIONS
// =====================================================

export async function fetchMessages(): Promise<Message[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("messages")
    .select(`
      *,
      from_profile:profiles!from_user_id(display_name),
      to_profile:profiles!to_user_id(display_name)
    `)
    .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id},to_user_id.is.null`)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching messages:", error);
    return [];
  }

  return (data || []).map((msg: any) => ({
    ...msg,
    from_name: msg.from_profile?.display_name,
    to_name: msg.to_profile?.display_name,
  }));
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

  useEffect(() => {
    let mounted = true;

    if (mounted) {
      loadMessages();
    }

    const subscription = supabase
      .channel("message-changes")
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

export async function getDMMessages(otherUserId: string): Promise<Message[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("messages")
    .select(`
      *,
      from_profile:profiles!from_user_id(display_name),
      to_profile:profiles!to_user_id(display_name)
    `)
    .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${otherUserId}),and(from_user_id.eq.${otherUserId},to_user_id.eq.${user.id})`)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching DM messages:", error);
    return [];
  }

  return (data || []).map((msg: any) => ({
    ...msg,
    from_name: msg.from_profile?.display_name,
    to_name: msg.to_profile?.display_name,
  }));
}

// =====================================================
// COMPANY ENHANCEMENT FUNCTIONS
// =====================================================

export async function updateCompany(
  companyId: string,
  updates: Partial<Company>
): Promise<Company | null> {
  const { data, error } = await supabase
    .from("companies")
    .update(updates)
    .eq("id", companyId)
    .select()
    .single();

  if (error) {
    console.error("Error updating company:", error);
    return null;
  }

  return data;
}
