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
  google_doc_id: string | null;
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
  software_links: { name: string; url: string }[] | null;
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
  photo_url: string | null;
  created_at: string;
  updated_at: string;
  company_name?: string;
  company_slug?: string;
  assignee_name?: string;
}

export interface Client {
  id: string;
  company_id: string | null;
  company_name?: string | null;
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
  company_name?: string | null;
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

export async function updateProfileGoogleDocId(userId: string, docId: string): Promise<void> {
  await supabase.from("profiles").update({ google_doc_id: docId }).eq("id", userId);
}

const LEVEL_XP_THRESHOLD = 200;

export async function addXPToProfile(userId: string, xpGained: number): Promise<void> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("xp, level")
    .eq("id", userId)
    .single();
  if (!profile) return;

  let newXP = (profile.xp || 0) + xpGained;
  let newLevel = profile.level || 1;
  while (newXP >= LEVEL_XP_THRESHOLD) {
    newXP -= LEVEL_XP_THRESHOLD;
    newLevel++;
  }
  await supabase.from("profiles").update({ xp: newXP, level: newLevel }).eq("id", userId);
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      const data = await fetchProfile();
      setProfile(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let subscription: any = null;

    async function init() {
      await loadProfile();
      if (!mounted) return;

      // Get user ID from auth for a stable subscription filter
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;

      subscription = supabase
        .channel("profile-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            if (mounted && payload.new) {
              setProfile(payload.new as Profile);
            }
          }
        )
        .subscribe();
    }

    init();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [loadProfile]);

  return { profile, loading, error, refetch: loadProfile };
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

export async function updateCompanySoftwareLinks(
  companyId: string,
  links: { name: string; url: string }[]
): Promise<boolean> {
  const { error } = await supabase
    .from("companies")
    .update({ software_links: links })
    .eq("id", companyId);
  if (error) {
    console.error("Error updating software links:", error);
    return false;
  }
  return true;
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
    .select("*")
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

  if (!data || data.length === 0) return [];

  // Enrich with company + assignee names via separate simple lookups
  // (avoids needing FK constraints for PostgREST joins)
  const companyIds = [...new Set(data.map((t: any) => t.company_id).filter(Boolean))];
  const assigneeIds = [...new Set(data.map((t: any) => t.assigned_to).filter(Boolean))];

  const [companiesResult, profilesResult] = await Promise.all([
    companyIds.length > 0
      ? supabase.from("companies").select("id, name, slug").in("id", companyIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    assigneeIds.length > 0
      ? supabase.from("profiles").select("id, display_name").in("id", assigneeIds)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  const companyMap = new Map((companiesResult.data || []).map((c: any) => [c.id, c]));
  const profileMap = new Map((profilesResult.data || []).map((p: any) => [p.id, p]));

  return data.map((task: any) => ({
    ...task,
    company_name: companyMap.get(task.company_id)?.name ?? null,
    company_slug: companyMap.get(task.company_id)?.slug ?? null,
    assignee_name: profileMap.get(task.assigned_to)?.display_name ?? null,
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

  useEffect(() => {
    let mounted = true;

    if (mounted) {
      loadTasks();
    }

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

export async function createTask(task: Partial<Task>): Promise<Task | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      sort_order: 0,
      updated_at: new Date().toISOString(),
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
    .update({ updated_at: new Date().toISOString(), ...updates })
    .eq("id", taskId)
    .select()
    .single();

  if (error) {
    console.error("Error updating task:", error);
    return null;
  }

  return data;
}

export async function completeTask(taskId: string): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: task, error: fetchError } = await supabase
    .from("tasks")
    .select("impact, estimate_minutes")
    .eq("id", taskId)
    .single();

  if (fetchError || !task) {
    console.error("Error fetching task:", fetchError);
    return false;
  }

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

  if (!data || data.length === 0) return [];

  const companyIds = [...new Set(data.map((c: any) => c.company_id).filter(Boolean))];
  if (companyIds.length === 0) return data;

  const { data: companies } = await supabase.from("companies").select("id, name").in("id", companyIds);
  const companyMap = new Map((companies || []).map((c: any) => [c.id, c.name]));

  return data.map((client: any) => ({
    ...client,
    company_name: companyMap.get(client.company_id) ?? null,
  }));
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
    .order("created_at", { ascending: false });

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching products:", error);
    return [];
  }

  if (!data || data.length === 0) return [];

  const companyIds = [...new Set(data.map((p: any) => p.company_id).filter(Boolean))];
  if (companyIds.length === 0) return data;

  const { data: companies } = await supabase.from("companies").select("id, name").in("id", companyIds);
  const companyMap = new Map((companies || []).map((c: any) => [c.id, c.name]));

  return data.map((product: any) => ({
    ...product,
    company_name: companyMap.get(product.company_id) ?? null,
  }));
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

  // Count unread DMs addressed to this user
  const { count: dmCount, error: dmError } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("to_user_id", user.id)
    .eq("is_read", false);

  if (dmError) {
    console.error("Error getting unread DM count:", dmError);
  }

  // Count team messages from others newer than last time chat was opened
  const lastOpened = localStorage.getItem("teamChatLastOpened");
  let teamCount = 0;
  if (lastOpened) {
    const { count, error: teamError } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .is("to_user_id", null)
      .neq("from_user_id", user.id)
      .gt("created_at", lastOpened);
    if (!teamError) teamCount = count || 0;
  }

  return (dmCount || 0) + teamCount;
}

// =====================================================
// MEETINGS
// =====================================================

export interface Meeting {
  id: string;
  title: string;
  scheduled_at: string;
  company_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchMeetings(): Promise<Meeting[]> {
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .order("scheduled_at", { ascending: true });
  if (error) { console.error("Error fetching meetings:", error); return []; }
  return data || [];
}

export async function createMeeting(meeting: Omit<Meeting, "id" | "created_at" | "updated_at">): Promise<Meeting | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("meetings")
    .insert({ ...meeting, created_by: user.id })
    .select()
    .single();
  if (error) { console.error("Error creating meeting:", error); return null; }
  return data;
}

export async function updateMeeting(id: string, updates: Partial<Meeting>): Promise<boolean> {
  const { error } = await supabase.from("meetings").update(updates).eq("id", id);
  if (error) { console.error("Error updating meeting:", error); return false; }
  return true;
}

export async function deleteMeeting(id: string): Promise<boolean> {
  const { error } = await supabase.from("meetings").delete().eq("id", id);
  if (error) { console.error("Error deleting meeting:", error); return false; }
  return true;
}

export function useMeetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await fetchMeetings();
    setMeetings(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    if (mounted) load();
    const sub = supabase.channel("meeting-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, () => { if (mounted) load(); })
      .subscribe();
    return () => { mounted = false; sub.unsubscribe(); };
  }, [load]);

  return { meetings, loading, refetch: load };
}

// =====================================================
// COMPANY GOALS
// =====================================================

export interface CompanyGoal {
  id: string;
  company_id: string | null;
  label: string;
  current_value: number;
  target_value: number;
  unit: string;
  created_at: string;
  updated_at: string;
}

export async function fetchCompanyGoals(companyId?: string): Promise<CompanyGoal[]> {
  let query = supabase.from("company_goals").select("*").order("created_at", { ascending: true });
  if (companyId) query = query.eq("company_id", companyId);
  const { data, error } = await query;
  if (error) { console.error("Error fetching goals:", error); return []; }
  return data || [];
}

export async function upsertCompanyGoal(goal: Partial<CompanyGoal>): Promise<CompanyGoal | null> {
  if (goal.id) {
    // Update existing
    const { data, error } = await supabase
      .from("company_goals")
      .update(goal)
      .eq("id", goal.id)
      .select()
      .single();
    if (error) { console.error("Error updating goal:", error); return null; }
    return data;
  } else {
    // Insert new
    const { data, error } = await supabase
      .from("company_goals")
      .insert(goal)
      .select()
      .single();
    if (error) { console.error("Error inserting goal:", error); return null; }
    return data;
  }
}

export function useCompanyGoals(companyId?: string) {
  const [goals, setGoals] = useState<CompanyGoal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await fetchCompanyGoals(companyId);
    setGoals(data);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    let mounted = true;
    if (mounted) load();
    const sub = supabase.channel("goal-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "company_goals" }, () => { if (mounted) load(); })
      .subscribe();
    return () => { mounted = false; sub.unsubscribe(); };
  }, [load]);

  return { goals, loading, refetch: load };
}

// =====================================================
// ACCOMPLISHMENTS
// =====================================================

export interface AccomplishmentDB {
  id: string;
  user_id: string;
  user_name: string;
  text: string;
  posted_to_team: boolean;
  created_at: string;
}

export async function saveAccomplishment(
  text: string,
  userName: string,
  postedToTeam: boolean
): Promise<AccomplishmentDB | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("accomplishments")
    .insert({ user_id: user.id, user_name: userName, text, posted_to_team: postedToTeam })
    .select()
    .single();
  if (error) { console.error("Error saving accomplishment:", error); return null; }
  return data;
}

export function useAccomplishments() {
  const [accomplishments, setAccomplishments] = useState<AccomplishmentDB[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("accomplishments")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error) setAccomplishments(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    if (mounted) load();
    const sub = supabase.channel("accomplishment-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "accomplishments" },
        () => { if (mounted) load(); })
      .subscribe();
    return () => { mounted = false; sub.unsubscribe(); };
  }, [load]);

  return { accomplishments, loading, refetch: load };
}

export function useAllAccomplishments() {
  const [accomplishments, setAccomplishments] = useState<AccomplishmentDB[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("accomplishments")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setAccomplishments(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    if (mounted) load();
    const sub = supabase.channel("all-accomplishment-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "accomplishments" },
        () => { if (mounted) load(); })
      .subscribe();
    return () => { mounted = false; sub.unsubscribe(); };
  }, [load]);

  return { accomplishments, loading, refetch: load };
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
