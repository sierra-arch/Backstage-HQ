// TasksPage.tsx - Tasks page with filters and task list components
import React from "react";
import { motion } from "framer-motion";
import { DBTask, COMPANIES, Role, isFounder } from "./types";
import { Card, CompanyChip, Avatar } from "./ui";

/* ──────────────────────────────────────────────────────────────────
   Task Row & List (shared, used by TodayPage too)
   ────────────────────────────────────────────────────────────────── */
export function TaskRow({
  task, onClick, onSubmit,
}: {
  task: DBTask;
  onClick: () => void;
  onSubmit?: (task: DBTask) => void;
}) {
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
          {task.due_date && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
              new Date(task.due_date) < new Date()
                ? "bg-red-50 text-red-700 border-red-200"
                : "bg-neutral-50 text-neutral-600"
            }`}>
              Due {new Date(task.due_date).toLocaleDateString([], { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
      </div>
      {onSubmit && task.status === "active" && (
        <button
          onClick={(e) => { e.stopPropagation(); onSubmit(task); }}
          className="flex-shrink-0 text-[11px] rounded-xl border border-teal-300 bg-teal-50 text-teal-800 px-2.5 py-1 hover:bg-teal-100 font-medium"
        >
          Submit
        </button>
      )}
    </motion.div>
  );
}

export function TaskList({
  tasks, onTaskClick, onSubmit,
}: {
  tasks: DBTask[];
  onTaskClick: (task: DBTask) => void;
  onSubmit?: (task: DBTask) => void;
}) {
  return (
    <div className="space-y-2">
      {tasks.length === 0 && (
        <div className="text-sm text-neutral-500 text-center py-8">No tasks yet</div>
      )}
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} onClick={() => onTaskClick(t)} onSubmit={onSubmit} />
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
  userName,
  userId,
  teamMembers,
  onOpenCreateTask,
  onTaskClick,
  onSubmit,
}: {
  filteredTasks: DBTask[];
  taskFilters: { company: string; impact: string; priority: string; status: string; assignee: string };
  setTaskFilters: (f: any) => void;
  role: Role;
  userName: string;
  userId: string;
  teamMembers: { id: string; display_name: string | null }[];
  onOpenCreateTask: () => void;
  onTaskClick: (task: DBTask) => void;
  onSubmit?: (task: DBTask) => void;
}) {
  const [showArchived, setShowArchived] = React.useState(false);
  const isFiltered = Object.values(taskFilters).some((v) => v !== "all");

  // Team members see their own tasks + unassigned tasks (so null-assigned legacy tasks are visible)
  // Founders see everything
  const scopedTasks = isFounder(role)
    ? filteredTasks
    : filteredTasks.filter(
        (t) =>
          t.assigned_to === userId ||
          t.assignee_name === userName ||
          (!t.assigned_to && !t.assignee_name)
      );

  // When the status filter is pinned to completed/archived, show those directly.
  // Founders always see all statuses by default (no hiding behind toggle).
  // Team members default to hiding completed/archived behind the toggle.
  const statusPinned = taskFilters.status === "completed" || taskFilters.status === "archived";
  const activeTasks = scopedTasks.filter((t) => t.status !== "completed" && t.status !== "archived");
  const archivedTasks = scopedTasks.filter((t) => t.status === "completed" || t.status === "archived");
  const displayedTasks = statusPinned
    ? scopedTasks
    : isFounder(role)
    ? scopedTasks
    : showArchived
    ? archivedTasks
    : activeTasks;

  return (
    <div className="space-y-4">
      <Card title="All Tasks">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button onClick={onOpenCreateTask}
            className="rounded-full border-2 border-teal-600 bg-white text-teal-600 px-4 py-1.5 hover:bg-teal-50 text-xs font-medium flex-shrink-0">
            + New Task
          </button>

          <select value={taskFilters.company}
            onChange={(e) => setTaskFilters({ ...taskFilters, company: e.target.value })}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium outline-none bg-white ${taskFilters.company !== "all" ? "border-teal-400 text-teal-700" : ""}`}>
            <option value="all">Company</option>
            {COMPANIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <select value={taskFilters.status}
            onChange={(e) => setTaskFilters({ ...taskFilters, status: e.target.value })}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium outline-none bg-white ${taskFilters.status !== "all" ? "border-teal-400 text-teal-700" : ""}`}>
            <option value="all">Status</option>
            <option value="focus">Focus</option>
            <option value="active">Active</option>
            <option value="submitted">Submitted</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>

          <select value={taskFilters.impact}
            onChange={(e) => setTaskFilters({ ...taskFilters, impact: e.target.value })}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium outline-none bg-white ${taskFilters.impact !== "all" ? "border-teal-400 text-teal-700" : ""}`}>
            <option value="all">Level</option>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>

          {isFounder(role) && (
            <select value={taskFilters.assignee}
              onChange={(e) => setTaskFilters({ ...taskFilters, assignee: e.target.value })}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium outline-none bg-white ${taskFilters.assignee !== "all" ? "border-teal-400 text-teal-700" : ""}`}>
              <option value="all">Assignee</option>
              {teamMembers.map((tm) => (
                <option key={tm.id} value={tm.display_name || ""}>{tm.display_name || "Unknown"}</option>
              ))}
              <option value="">Unassigned</option>
            </select>
          )}

          {isFiltered && (
            <button
              onClick={() => setTaskFilters({ company: "all", impact: "all", priority: "all", status: "all", assignee: "all" })}
              className="text-xs text-neutral-400 hover:text-neutral-600 ml-1">
              ✕ Clear
            </button>
          )}
        </div>

        <TaskList tasks={displayedTasks} onTaskClick={onTaskClick} onSubmit={onSubmit} />

        {!statusPinned && !isFounder(role) && (
          <p className="text-xs text-neutral-400 mt-1">Showing your tasks and unassigned tasks.</p>
        )}

        {!statusPinned && !isFounder(role) && archivedTasks.length > 0 && (
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="mt-4 w-full text-xs text-neutral-400 hover:text-neutral-600 border border-dashed rounded-xl py-2 transition-colors">
            {showArchived
              ? "Hide completed & archived tasks"
              : `Show completed & archived tasks (${archivedTasks.length})`}
          </button>
        )}
      </Card>
    </div>
  );
}
