// TasksPage.tsx - Tasks page with filters and task list components
import React from "react";
import { motion } from "framer-motion";
import { DBTask, COMPANIES, Role, isFounder } from "./types";
import { Card, CompanyChip, Avatar } from "./ui";

/* ──────────────────────────────────────────────────────────────────
   Task Row & List (shared, used by TodayPage too)
   ────────────────────────────────────────────────────────────────── */
export function TaskRow({ task, onClick }: { task: DBTask; onClick: () => void }) {
  return (
    <motion.div
      layout
      onClick={onClick}
      className="group flex items-center gap-3 rounded-xl border p-3 hover:border-teal-200 transition-colors bg-white cursor-pointer"
    >
      {task.photo_url && (
        <div
          className="w-12 h-12 rounded-lg bg-cover bg-center flex-shrink-0"
          style={{ backgroundImage: `url(${task.photo_url})` }}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] md:text-[14px] font-medium truncate">{task.title}</div>
        <div className="text-xs text-neutral-500 truncate">{task.description || "No description"}</div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <CompanyChip name={task.company_name || "Unknown"} />
          <span className="text-[10px] px-2 py-0.5 rounded-full border bg-teal-50 text-teal-900/80">{task.impact}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full border bg-neutral-50 inline-flex items-center gap-1">
            <Avatar name={task.assignee_name || "Unassigned"} size={14} />
            {task.assignee_name || "Unassigned"}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export function TaskList({ tasks, onTaskClick }: { tasks: DBTask[]; onTaskClick: (task: DBTask) => void }) {
  return (
    <div className="space-y-2">
      {tasks.length === 0 && (
        <div className="text-sm text-neutral-500 text-center py-8">No tasks yet</div>
      )}
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} onClick={() => onTaskClick(t)} />
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Tasks Page
   ────────────────────────────────────────────────────────────────── */
export function TasksPage({
  filteredTasks,
  taskFilters,
  setTaskFilters,
  role,
  teamMembers,
  onOpenCreateTask,
  onTaskClick,
}: {
  filteredTasks: DBTask[];
  taskFilters: { company: string; impact: string; priority: string; status: string; assignee: string };
  setTaskFilters: (f: any) => void;
  role: Role;
  teamMembers: { id: string; display_name: string | null }[];
  onOpenCreateTask: () => void;
  onTaskClick: (task: DBTask) => void;
}) {
  return (
    <div className="space-y-4">
      <Card title="Filters">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <select value={taskFilters.company}
            onChange={(e) => setTaskFilters({ ...taskFilters, company: e.target.value })}
            className="rounded-xl border px-3 py-2 text-sm">
            <option value="all">All Companies</option>
            {COMPANIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <select value={taskFilters.impact}
            onChange={(e) => setTaskFilters({ ...taskFilters, impact: e.target.value })}
            className="rounded-xl border px-3 py-2 text-sm">
            <option value="all">All Levels</option>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>

          <select value={taskFilters.priority}
            onChange={(e) => setTaskFilters({ ...taskFilters, priority: e.target.value })}
            className="rounded-xl border px-3 py-2 text-sm">
            <option value="all">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>

          <select value={taskFilters.status}
            onChange={(e) => setTaskFilters({ ...taskFilters, status: e.target.value })}
            className="rounded-xl border px-3 py-2 text-sm">
            <option value="all">All Statuses</option>
            <option value="focus">Focus</option>
            <option value="active">Active</option>
            <option value="submitted">Submitted</option>
            <option value="completed">Completed</option>
          </select>

          {isFounder(role) && (
            <select value={taskFilters.assignee}
              onChange={(e) => setTaskFilters({ ...taskFilters, assignee: e.target.value })}
              className="rounded-xl border px-3 py-2 text-sm">
              <option value="all">All Team Members</option>
              {teamMembers.map((tm) => (
                <option key={tm.id} value={tm.display_name || ""}>{tm.display_name || "Unknown"}</option>
              ))}
              <option value="">Unassigned</option>
            </select>
          )}
        </div>

        <button
          onClick={() => setTaskFilters({ company: "all", impact: "all", priority: "all", status: "all", assignee: "all" })}
          className="mt-3 text-xs text-teal-600 hover:text-teal-700 underline"
        >
          Clear all filters
        </button>
      </Card>

      <Card title="All Tasks">
        <button onClick={onOpenCreateTask}
          className="mb-4 rounded-full border-2 border-teal-600 bg-white text-teal-600 px-4 py-2 hover:bg-teal-50 text-sm font-medium">
          NEW
        </button>
        <TaskList tasks={filteredTasks} onTaskClick={onTaskClick} />
      </Card>
    </div>
  );
}
