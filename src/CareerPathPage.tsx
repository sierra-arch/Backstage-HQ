// CareerPathPage.tsx - XP progress, milestones, and task history for team members
import React from "react";
import { DBTask, XP_BY_IMPACT, LEVEL_XP_THRESHOLD } from "./types";

export function CareerPathPage({
  level,
  xp,
  tasks,
  userName,
  userId,
}: {
  level: number;
  xp: number;
  tasks: DBTask[];
  userName: string;
  userId: string;
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
  const totalXPEarned = myCompleted.reduce((sum, t) => sum + XP_BY_IMPACT[t.impact], 0);
  const pct = Math.min(100, Math.round((xp / LEVEL_XP_THRESHOLD) * 100));

  return (
    <div className="rounded-2xl bg-[#ECF7F3] p-6 md:p-8 space-y-7">
      {/* ── Level hero ── */}
      <div>
        <div className="text-3xl font-bold tracking-tight">Level {level}</div>
        <div className="text-sm text-neutral-600 mt-1">
          {xp} / {LEVEL_XP_THRESHOLD} XP &nbsp;·&nbsp; {LEVEL_XP_THRESHOLD - xp} XP to Level {level + 1}
        </div>
        {/* XP bar */}
        <div className="mt-3 h-2.5 w-full max-w-xs rounded-full bg-teal-100 overflow-hidden">
          <div className="h-full bg-teal-600 transition-all rounded-full" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-3 flex gap-1.5">
          <span className="text-[11px] px-2 py-1 rounded-full bg-white border border-teal-200 text-teal-800 whitespace-nowrap">Small = 5 XP</span>
          <span className="text-[11px] px-2 py-1 rounded-full bg-white border border-teal-200 text-teal-800 whitespace-nowrap">Medium = 10 XP</span>
          <span className="text-[11px] px-2 py-1 rounded-full bg-white border border-teal-200 text-teal-800 whitespace-nowrap">Large = 20 XP</span>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "This Week", value: completedThisWeek.length, sub: "completed" },
          { label: "This Month", value: completedThisMonth.length, sub: "completed" },
          { label: "All Time", value: myCompleted.length, sub: "completed" },
          { label: "Total XP", value: totalXPEarned, sub: "earned" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-white border border-teal-100 p-4 text-center">
            <div className="text-2xl font-bold text-teal-700">{s.value}</div>
            <div className="text-xs font-medium text-neutral-700 mt-0.5">{s.label}</div>
            <div className="text-[11px] text-neutral-400">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Completed task history ── */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-700 mb-3">
          Completed Tasks <span className="font-normal text-neutral-400">({myCompleted.length})</span>
        </h3>
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {myCompleted.length === 0 && (
            <div className="rounded-xl bg-white border border-teal-100 p-6 text-sm text-neutral-400 text-center">
              No completed tasks yet — finish your first one to earn XP!
            </div>
          )}
          {[...myCompleted]
            .sort((a, b) => {
              const da = a.completed_at ? new Date(a.completed_at).getTime() : 0;
              const db = b.completed_at ? new Date(b.completed_at).getTime() : 0;
              return db - da;
            })
            .map((t) => (
              <div key={t.id} className="rounded-xl bg-white border border-teal-100 p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  <div className="text-xs text-neutral-500 mt-0.5 flex items-center gap-2">
                    <span>{t.company_name ?? "—"}</span>
                    {t.completed_at && (
                      <>
                        <span className="text-neutral-300">·</span>
                        <span>{new Date(t.completed_at).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                      </>
                    )}
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 flex-shrink-0 font-medium">
                  +{XP_BY_IMPACT[t.impact]} XP
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
