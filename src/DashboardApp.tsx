import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Role = 'Founder' | 'Team' | null;

type GoalRowData = {
  id: string;
  title: string;
  kind: 'numeric' | 'task' | 'checkbox';
  unit: string | null;
  target_num: number | null;
  current_value: number | null;
  progress: number | null; // 0..1
  end_at: string | null;
  is_active?: boolean | null;
  total_tasks?: number | null;
  completed_tasks?: number | null;
};

type BrandProgress = {
  company_id: string;
  company_name: string;
  total_tasks: number | null;
  completed_tasks: number | null;
  progress: number | null; // 0..1
};

// -----------------------------------------------------------------------------
// Utility UI Components (minimal, Tailwind-only)
// -----------------------------------------------------------------------------

function Card({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={
      'rounded-2xl border border-gray-200 bg-white shadow-sm ' + className
    }>
      {(title || subtitle || action) && (
        <div className="flex items-center justify-between px-5 pt-5">
          <div>
            {title && (
              <h3 className="text-base font-semibold text-gray-900 leading-6">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-gray-500 -mt-0.5">{subtitle}</p>
            )}
          </div>
          {action}
        </div>
      )}
      <div className={(title || subtitle || action) ? 'p-5 pt-3' : 'p-5'}>
        {children}
      </div>
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  const bounded = Math.max(0, Math.min(100, percent ?? 0));
  return (
    <div className="h-2 w-full rounded-full bg-gray-100">
      <div
        className="h-2 rounded-full bg-emerald-700 transition-all"
        style={{ width: `${bounded}%` }}
        aria-label={`Progress ${bounded}%`}
      />
    </div>
  );
}

function Row({
  label,
  sublabel,
  right,
  children,
}: {
  label: string;
  sublabel?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-800">{label}</p>
          {sublabel && (
            <p className="text-xs text-gray-500 mt-0.5">{sublabel}</p>
          )}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

// Specific rows
function GoalRow({ g }: { g: GoalRowData }) {
  const pct = Math.round(((g.progress ?? 0) * 100) as number);
  const sub =
    g.kind === 'task'
      ? `${g.completed_tasks ?? 0} of ${g.total_tasks ?? 0} tasks`
      : g.unit
      ? `${g.current_value ?? 0}${g.unit} of ${g.target_num ?? 0}${g.unit}`
      : undefined;

  return (
    <Row label={g.title} sublabel={sub} right={<span className="text-xs text-gray-500">{pct}%</span>}>
      <ProgressBar percent={pct} />
    </Row>
  );
}

function BrandRow({ b }: { b: BrandProgress }) {
  const pct = Math.round(((b.progress ?? 0) * 100) as number);
  return (
    <Row
      label={b.company_name}
      sublabel={`${b.completed_tasks ?? 0} of ${b.total_tasks ?? 0} tasks`}
      right={<span className="text-xs text-gray-500">{pct}%</span>}
    >
      <ProgressBar percent={pct} />
    </Row>
  );
}

// -----------------------------------------------------------------------------
// Data hooks
// -----------------------------------------------------------------------------

function useRole(): Role {
  const [role, setRole] = useState<Role>(null);
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return setRole(null);
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
      if (error) {
        console.error('profiles role error', error);
        setRole(null);
      } else {
        setRole((data?.role as Role) ?? null);
      }
    })();
  }, []);
  return role;
}

function useCompanyGoals(limit = 3) {
  const [rows, setRows] = useState<GoalRowData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('vw_company_goals')
        .select('*')
        .order('end_at', { ascending: true })
        .limit(limit);
      if (error) setError(error.message);
      setRows(data ?? []);
    })();
  }, [limit]);
  return { rows, error };
}

function useBrandProgress() {
  const [rows, setRows] = useState<BrandProgress[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('vw_brand_progress')
        .select('*');
      if (error) setError(error.message);
      setRows(data ?? []);
    })();
  }, []);
  return { rows, error };
}

// -----------------------------------------------------------------------------
// Main Dashboard App
// -----------------------------------------------------------------------------

export default function DashboardApp() {
  const role = useRole();
  const { rows: goals } = useCompanyGoals(3);
  const { rows: brands } = useBrandProgress();

  const firstName = useMemo(() => {
    // Optional: pull from your auth metadata; fallback to generic
    return 'Sierra';
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/70 backdrop-blur">
        <div className="mx-auto max-w-screen-2xl px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="text-lg font-semibold text-gray-900">Backstage Headquarters</div>
            <div className="ml-auto flex items-center gap-2">
              <input
                placeholder="Search tasks…"
                className="w-72 rounded-full border border-gray-200 px-4 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <button className="rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                Inbox
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-screen-2xl p-4 md:p-6">
        {/* Welcome + Notes row */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Welcome back</p>
                <h1 className="mt-1 text-3xl font-semibold text-gray-900">{firstName}</h1>
              </div>
              <div className="h-20 w-20 rounded-full border-[6px] border-emerald-200 p-2">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-emerald-50 text-emerald-900 font-semibold">
                  L1
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-2 text-xs text-gray-600">
              <span className="rounded-full bg-gray-100 px-2 py-1">40% to next level</span>
              <span className="rounded-full bg-gray-100 px-2 py-1">0 completed this week</span>
            </div>
          </Card>

          <Card title="Notes">
            <textarea
              className="min-h-[116px] w-full resize-vertical rounded-xl border border-gray-200 p-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              placeholder="Quick note…"
            />
            <div className="mt-3 flex justify-end">
              <button className="rounded-full bg-emerald-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-800">
                Save to Google Doc
              </button>
            </div>
          </Card>
        </div>

        {/* Focus/Brand/Goals/Accomplishments row */}
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Left: Today\'s Focus placeholder (kept minimal here) */}
          <Card
            title={"Today's Focus"}
            subtitle="Smartly chosen by due date, priority & quick wins"
            className="xl:col-span-2"
          >
            <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gradient-to-b from-emerald-50/50 to-transparent">
              <p className="text-sm text-gray-500">No tasks yet</p>
            </div>
          </Card>

          {/* Right column: Submitted for Approval placeholder */}
          <Card title="Submitted for Approval" subtitle="Approve or return with notes">
            <p className="text-sm text-gray-500">Nothing pending.</p>
          </Card>
        </div>

        {/* Brand Snapshot / Company Goals / Accomplishments */}
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card title="Brand Snapshot" className="space-y-4">
            {!brands && <p className="text-sm text-gray-500">Loading…</p>}
            {brands && brands.length === 0 && (
              <p className="text-sm text-gray-500">No companies found.</p>
            )}
            {brands?.map((b) => (
              <div key={b.company_id} className="rounded-xl border border-gray-100 p-4">
                <BrandRow b={b} />
              </div>
            ))}
          </Card>

          <Card title="Company Goals" subtitle="Company & Role" className="space-y-4">
            {!goals && <p className="text-sm text-gray-500">Loading…</p>}
            {goals && goals.length === 0 && (
              <p className="text-sm text-gray-500">No active goals.</p>
            )}
            {goals?.map((g) => (
              <div key={g.id} className="rounded-xl border border-gray-100 p-4">
                <GoalRow g={g} />
              </div>
            ))}
          </Card>

          <Card title="Accomplishments" subtitle="Celebrate wins">
            <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center">
              <p className="text-sm text-gray-500">No accomplishments yet - add your first one!</p>
            </div>
          </Card>
        </div>

        <div className="h-10" />
      </main>
    </div>
  );
}
