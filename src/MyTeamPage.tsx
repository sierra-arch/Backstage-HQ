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
  teamMembers?: { id: string; display_name: string | null }[];
}) {
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  const teamMemberStats = teamMembers.map((member) => {
    const name = member.display_name || "Unknown";
    const memberTasks = tasks.filter((t) => t.assignee_name === name);
    const completed = memberTasks.filter((t) => t.status === "completed");
    const level = Math.floor((completed.length * 5) / LEVEL_XP_THRESHOLD) + 1;
    const xp = (completed.length * 5) % LEVEL_XP_THRESHOLD;

    return { name, level, xp, completedTasks: completed, totalTasks: memberTasks.length };
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
                    <div className="text-xs text-neutral-500">{m.totalTasks} tasks</div>
                  </div>
                </div>
                <LevelRing level={m.level} value={m.xp} max={LEVEL_XP_THRESHOLD} showStats={false} size={60} stroke={8} />
              </div>
              <div className="flex gap-2">
                <Chip>{m.completedTasks.length} completed</Chip>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Modal
        isOpen={!!selectedMember}
        onClose={() => setSelectedMember(null)}
        title={`${selectedMember}'s Completed Tasks`}
        size="large"
      >
        {selectedMemberData && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name={selectedMemberData.name} size={60} />
              <div className="flex-1">
                <h3 className="text-xl font-semibold">{selectedMemberData.name}</h3>
                <p className="text-sm text-neutral-600">
                  Level {selectedMemberData.level} • {selectedMemberData.completedTasks.length} tasks completed
                </p>
              </div>
              <LevelRing level={selectedMemberData.level} value={selectedMemberData.xp} max={LEVEL_XP_THRESHOLD} size={72} stroke={10} />
            </div>
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Completed Tasks</h4>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {selectedMemberData.completedTasks.map((task) => (
                  <div key={task.id} className="rounded-xl border p-3 bg-neutral-50">
                    <div className="font-medium text-sm">{task.title}</div>
                    <div className="text-xs text-neutral-500 mt-1">
                      {task.company_name} • {task.impact} impact • {XP_BY_IMPACT[task.impact]} XP
                    </div>
                  </div>
                ))}
                {selectedMemberData.completedTasks.length === 0 && (
                  <div className="text-sm text-neutral-500 text-center py-8">No completed tasks yet</div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
