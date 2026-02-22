// CareerPathPage.tsx - XP progress, milestones, and task history for team members
import React from "react";
import { DBTask, XP_BY_IMPACT, LEVEL_XP_THRESHOLD } from "./types";
import { Card, LevelRing } from "./ui";


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

  return (
    <div className="space-y-4">
      {/* Hero: level ring + title */}
      <Card>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <LevelRing level={level} value={xp} max={LEVEL_XP_THRESHOLD} size={120} stroke={14} />
          <div className="text-center sm:text-left">
            <div className="text-3xl font-bold">Level {level}</div>
            <div className="text-sm text-neutral-500 mt-1">
              {xp} / {LEVEL_XP_THRESHOLD} XP — {LEVEL_XP_THRESHOLD - xp} XP to level {level + 1}
            </div>
            <div className="mt-3 flex flex-wrap justify-center sm:justify-start gap-2">
              <span className="text-xs px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800">Small = 5 XP</span>
              <span className="text-xs px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800">Medium = 10 XP</span>
              <span className="text-xs px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800">Large = 20 XP</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "This Week", value: completedThisWeek.length, sub: "tasks completed" },
          { label: "This Month", value: completedThisMonth.length, sub: "tasks completed" },
          { label: "All Time", value: myCompleted.length, sub: "tasks completed" },
          { label: "Total XP", value: totalXPEarned, sub: "XP earned overall" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border bg-white p-4 text-center">
            <div className="text-2xl font-bold text-teal-700">{stat.value}</div>
            <div className="text-xs font-medium mt-0.5">{stat.label}</div>
            <div className="text-[11px] text-neutral-400 mt-0.5">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Completed task history */}
      <Card title={`Completed Tasks (${myCompleted.length})`}>
        <div className="space-y-2 max-h-[480px] overflow-y-auto">
          {myCompleted.length === 0 && (
            <div className="text-sm text-neutral-500 text-center py-8">
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
              <div key={t.id} className="rounded-xl border p-3 flex items-center justify-between bg-white gap-3">
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
      </Card>
    </div>
  );
}
