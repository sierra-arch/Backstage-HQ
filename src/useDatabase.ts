// =====================================================
// SUPABASE DATABASE HOOKS
// React hooks for interacting with your database
// =====================================================

import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';

// =====================================================
// TYPES
// =====================================================

export type AppRole = 'founder' | 'team';

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
  status: 'focus' | 'active' | 'submitted' | 'completed' | 'archived';
  priority: 'low' | 'medium' | 'high';
  impact: 'small' | 'medium' | 'large';
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
export async function ensureProfile(seedRole: AppRole = 'team'): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Auto-promote certain emails to founder
  const founderEmails = new Set([
    'sierra@gobackstage.ai',
    'sierra@backstageop.com',
  ]);
  
  const role: AppRole = founderEmails.has(user.email ?? '') ? 'founder' : seedRole;

  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        display_name:
          (user.user_metadata?.full_name as string | undefined) ||
          user.email?.split('@')[0] ||
          'User',
        role,
      },
      { onConflict: 'id' }
    )
    .select()
    .single();

  if (error) {
    console.error('Error ensuring profile:', error);
    return null;
  }

  return data;
}

/**
 * Fetch current user's profile
 */
export async function fetchProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
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
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
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

// =====================================================
// COMPANY HOOKS
// =====================================================

/**
 * Fetch all companies
 */
export async function fetchCompanies(): Promise<Company[]> {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching companies:', error);
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
  status?: Task['status'] | Task['status'][];
  assignedTo?: string;
  companyId?: string;
}): Promise<Task[]> {
  let query = supabase
    .from('tasks')
    .select(`
      *,
      company:companies(name, slug),
      assignee:profiles!assigned_to(display_name)
    `)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query = query.in('status', filters.status);
    } else {
      query = query.eq('status', filters.status);
    }
  }

  if (filters?.assignedTo) {
    query = query.eq('assigned_to', filters.assignedTo);
  }

  if (filters?.companyId) {
    query = query.eq('company_id', filters.companyId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching tasks:', error);
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
  status?: Task['status'] | Task['status'][];
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
      .channel('task-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      ...task,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating task:', error);
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
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .select()
    .single();

  if (error) {
    console.error('Error updating task:', error);
    return null;
  }

  return data;
}

/**
 * Complete a task and award XP
 */
export async function completeTask(taskId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // First, get the task details
  const { data: task, error: fetchError } = await supabase
    .from('tasks')
    .select('impact, estimate_minutes')
    .eq('id', taskId)
    .single();

  if (fetchError || !task) {
    console.error('Error fetching task:', fetchError);
    return false;
  }

  // Mark task as completed
  const { error: updateError } = await supabase
    .from('tasks')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  if (updateError) {
    console.error('Error completing task:', updateError);
    return false;
  }

  // Award XP
  const { data: xpResult, error: xpError } = await supabase.rpc('award_xp', {
    p_user_id: user.id,
    p_xp_amount: await calculateTaskXP(task.impact, task.estimate_minutes),
    p_action_type: 'task_completed',
    p_task_id: taskId,
  });

  if (xpError) {
    console.error('Error awarding XP:', xpError);
  }

  return true;
}

/**
 * Calculate XP for a task
 */
async function calculateTaskXP(impact: string, estimateMinutes: number): Promise<number> {
  const { data, error } = await supabase.rpc('calculate_xp_for_task', {
    task_impact: impact,
    task_estimate: estimateMinutes,
  });

  if (error) {
    console.error('Error calculating XP:', error);
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
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);

  if (error) {
    console.error('Error deleting task:', error);
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

  const { error } = await supabase.from('tasks').upsert(updates);

  if (error) {
    console.error('Error reordering tasks:', error);
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
    .from('notes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching notes:', error);
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('notes')
    .insert({
      content,
      author_id: user.id,
      role_context: roleContext,
      company_id: companyId,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating note:', error);
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
    .from('notes')
    .update(updates)
    .eq('id', noteId)
    .select()
    .single();

  if (error) {
    console.error('Error updating note:', error);
    return null;
  }

  return data;
}

/**
 * Delete a note
 */
export async function deleteNote(noteId: string): Promise<boolean> {
  const { error } = await supabase.from('notes').delete().eq('id', noteId);

  if (error) {
    console.error('Error deleting note:', error);
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching activity log:', error);
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
    .from('companies')
    .select('*')
    .eq('name', name)
    .single();

  if (error) {
    console.error('Error fetching company:', error);
    return null;
  }

  return data;
}
