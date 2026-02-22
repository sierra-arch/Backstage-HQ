// MyTeamPage.tsx - Team member overview
import React, { useState } from "react";
import { DBTask, XP_BY_IMPACT, LEVEL_XP_THRESHOLD } from "./types";
import { Card, Avatar, Chip, LevelRing } from "./ui";
import { Modal } from "./TaskModals";

export function MyTeamPage({
  tasks,
  teamMembers = [],
}: {
  tasks: DBTask[];
  teamMembers?: { id: string; display_name: string | null; xp?: number; level?: number }[];
}) {
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  const teamMemberStats = teamMembers.map((member) => {
    const name = member.display_name || "Unknown";
    const memberTasks = tasks.filter((t) => t.assignee_name === name);
    const activeTasks = memberTasks.filter((t) => t.status !== "completed" && t.status !== "archived");
    const completedTasks = memberTasks.filter((t) => t.status === "completed");
    // Use real xp/level from profile if available
    const level = member.level ?? 1;
    const xp = member.xp ?? 0;

    return { name, level, xp, activeTasks, completedTasks };
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
                  <Avatar name={m.name} size={40} />
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
        title={selectedMember ?? ""}
        size="large"
      >
        {selectedMemberData && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar name={selectedMemberData.name} size={60} />
              <div className="flex-1">
                <h3 className="text-xl font-semibold">{selectedMemberData.name}</h3>
                <p className="text-sm text-neutral-600">
                  Level {selectedMemberData.level} · {selectedMemberData.xp} XP · {selectedMemberData.completedTasks.length} tasks completed
                </p>
              </div>
              <LevelRing level={selectedMemberData.level} value={selectedMemberData.xp} max={LEVEL_XP_THRESHOLD} size={72} stroke={10} />
            </div>

            <div className="border-t pt-4 space-y-4">
              <div>
                <h4 className="font-medium mb-3 text-sm">Active Tasks ({selectedMemberData.activeTasks.length})</h4>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {selectedMemberData.activeTasks.length === 0 && (
                    <div className="text-sm text-neutral-400 text-center py-4">No active tasks</div>
                  )}
                  {selectedMemberData.activeTasks.map((task) => (
                    <div key={task.id} className="rounded-xl border p-3 bg-white flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{task.title}</div>
                        <div className="text-xs text-neutral-500 mt-0.5">{task.company_name} · {task.impact} impact</div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border capitalize ${
                        task.status === "submitted" ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-neutral-50 text-neutral-600"
                      }`}>
                        {task.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3 text-sm">Completed Tasks ({selectedMemberData.completedTasks.length})</h4>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {selectedMemberData.completedTasks.length === 0 && (
                    <div className="text-sm text-neutral-400 text-center py-4">No completed tasks yet</div>
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
