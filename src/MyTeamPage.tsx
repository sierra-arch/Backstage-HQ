// MyTeamPage.tsx - Team member overview
import React, { useState } from "react";
import { DBTask, XP_BY_IMPACT, LEVEL_XP_THRESHOLD } from "./types";
import { Card, Avatar, Chip, LevelRing } from "./ui";
import { Modal } from "./TaskModals";
import { AccomplishmentDB } from "./useDatabase";

export function MyTeamPage({
  tasks,
  teamMembers = [],
  accomplishments = [],
  onSendKudos,
}: {
  tasks: DBTask[];
  teamMembers?: { id: string; display_name: string | null; xp?: number; level?: number; avatar_url?: string | null }[];
  accomplishments?: AccomplishmentDB[];
  onSendKudos?: (memberId: string) => void;
}) {
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const teamMemberStats = teamMembers.map((member) => {
    const name = member.display_name || "Unknown";
    const memberTasks = tasks.filter((t) => t.assignee_name === name || t.assigned_to === member.id);
    const activeTasks = memberTasks.filter((t) => t.status !== "completed" && t.status !== "archived");
    const completedTasks = memberTasks.filter((t) => t.status === "completed");
    const completedThisWeek = completedTasks.filter((t) => t.completed_at && new Date(t.completed_at) >= startOfWeek).length;
    const completedThisMonth = completedTasks.filter((t) => t.completed_at && new Date(t.completed_at) >= startOfMonth).length;
    const totalXP = completedTasks.reduce((sum, t) => sum + XP_BY_IMPACT[t.impact], 0);
    const memberAccomplishments = accomplishments.filter((a) => a.user_name === name);
    const level = member.level ?? 1;
    const xp = member.xp ?? 0;

    return { id: member.id, name, level, xp, activeTasks, completedTasks, completedThisWeek, completedThisMonth, totalXP, memberAccomplishments, avatarUrl: member.avatar_url ?? null };
  });

  const selectedMemberData = teamMemberStats.find((m) => m.name === selectedMember);

  return (
    <>
      <Card title="My Team">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {teamMemberStats.map((m) => (
            <div
              key={m.name}
              onClick={() => setSelectedMember(m.name)}
              className="rounded-2xl border p-4 bg-white cursor-pointer hover:border-teal-300 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Avatar name={m.name} size={40} photoUrl={m.avatarUrl ?? undefined} />
                  <div>
                    <div className="font-semibold">{m.name}</div>
                    <div className="text-xs text-neutral-500">{m.activeTasks.length} active · {m.completedTasks.length} completed</div>
                  </div>
                </div>
                <LevelRing level={m.level} value={m.xp} max={LEVEL_XP_THRESHOLD} showStats={false} size={60} stroke={8} />
              </div>
              <div className="flex gap-2">
                <Chip>Level {m.level}</Chip>
                <Chip>{m.xp} XP</Chip>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Modal
        isOpen={!!selectedMember}
        onClose={() => setSelectedMember(null)}
        title={selectedMemberData?.name ?? ""}
        size="large"
      >
        {selectedMemberData && (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-4">
              <Avatar name={selectedMemberData.name} size={60} photoUrl={selectedMemberData.avatarUrl ?? undefined} />
              <div className="flex-1">
                <h3 className="text-xl font-semibold">{selectedMemberData.name}</h3>
                <p className="text-sm text-neutral-500">Level {selectedMemberData.level} · {selectedMemberData.xp} XP</p>
              </div>
              <div className="flex items-center gap-2">
                {onSendKudos && (
                  <button
                    onClick={() => { setSelectedMember(null); onSendKudos(selectedMemberData.id); }}
                    className="text-xs border border-yellow-300 bg-yellow-50 text-yellow-800 px-3 py-1.5 rounded-full hover:bg-yellow-100 font-medium"
                  >
                    Send Kudos 🏆
                  </button>
                )}
                <LevelRing level={selectedMemberData.level} value={selectedMemberData.xp} max={LEVEL_XP_THRESHOLD} size={72} stroke={10} />
              </div>
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "This Week", value: selectedMemberData.completedThisWeek },
                { label: "This Month", value: selectedMemberData.completedThisMonth },
                { label: "All Time", value: selectedMemberData.completedTasks.length },
                { label: "Total XP", value: selectedMemberData.totalXP },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border bg-neutral-50 p-3 text-center">
                  <div className="text-lg font-bold text-teal-700">{s.value}</div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 space-y-4">
              {/* Active Tasks */}
              <div>
                <h4 className="font-medium mb-2 text-sm">Active Tasks ({selectedMemberData.activeTasks.length})</h4>
                <div className="space-y-2 max-h-44 overflow-y-auto">
                  {selectedMemberData.activeTasks.length === 0 && (
                    <div className="text-sm text-neutral-400 text-center py-3">No active tasks</div>
                  )}
                  {selectedMemberData.activeTasks.map((task) => (
                    <div key={task.id} className="rounded-xl border p-3 bg-white flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{task.title}</div>
                        <div className="text-xs text-neutral-500 mt-0.5">{task.company_name} · {task.impact} impact</div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border capitalize ${
                        task.status === "submitted" ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-neutral-50 text-neutral-600"
                      }`}>{task.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Accomplishments */}
              {selectedMemberData.memberAccomplishments.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 text-sm">Recent Accomplishments</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedMemberData.memberAccomplishments.slice(0, 5).map((a) => (
                      <div key={a.id} className="rounded-xl border p-3 bg-violet-50 border-violet-200">
                        <div className="text-xs text-violet-600 mb-0.5">{new Date(a.created_at).toLocaleDateString()}</div>
                        <div className="text-sm">{a.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Tasks */}
              <div>
                <h4 className="font-medium mb-2 text-sm">Completed Tasks ({selectedMemberData.completedTasks.length})</h4>
                <div className="space-y-2 max-h-44 overflow-y-auto">
                  {selectedMemberData.completedTasks.length === 0 && (
                    <div className="text-sm text-neutral-400 text-center py-3">No completed tasks yet</div>
                  )}
                  {selectedMemberData.completedTasks.map((task) => (
                    <div key={task.id} className="rounded-xl border p-3 bg-neutral-50 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{task.title}</div>
                        <div className="text-xs text-neutral-500 mt-0.5">{task.company_name} · {task.impact} impact</div>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 flex-shrink-0">
                        +{XP_BY_IMPACT[task.impact]} XP
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
