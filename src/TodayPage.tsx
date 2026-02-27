// TodayPage.tsx - Today page for Founder and Team views
import React from "react";
import { DBTask, COMPANIES, LEVEL_XP_THRESHOLD } from "./types";
import { AccomplishmentDB, useMeetings } from "./useDatabase";
import { Card, Chip, Avatar, CompanyChip, LevelRing } from "./ui";
import { TaskRow } from "./TasksPage";
import { updateTask as dbUpdateTask, useCompanyGoals, upsertCompanyGoal, deleteCompanyGoal } from "./useDatabase";
import {
  DndContext, DragEndEvent, DragStartEvent, DragOverlay,
  PointerSensor, useSensor, useSensors, closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/* ──────────────────────────────────────────────────────────────────
   SortableTaskItem — TaskRow with a drag handle for DnD
   ────────────────────────────────────────────────────────────────── */
function SortableTaskItem({
  task, containerId, onTaskClick, onSubmit,
}: {
  task: DBTask;
  containerId: string;
  onTaskClick: (task: DBTask) => void;
  onSubmit?: (task: DBTask) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, data: { containerId } });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }}
      className="flex items-center gap-1"
    >
      <div
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-neutral-300 hover:text-neutral-500 flex-shrink-0 touch-none select-none px-0.5 text-base leading-none"
        title="Drag to reorder"
      >
        ⠿
      </div>
      <div className="flex-1 min-w-0">
        <TaskRow task={task} onClick={() => onTaskClick(task)} onSubmit={onSubmit} />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Confetti
   ────────────────────────────────────────────────────────────────── */
export function Confetti({ fire }: { fire: boolean }) {
  if (!fire) return null;
  return (
    <div style={{ pointerEvents: "none", position: "fixed", inset: 0, zIndex: 60 }}>
      {Array.from({ length: 140 }).map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.2;
        const dur = 0.8 + Math.random() * 0.9;
        const size = 4 + Math.random() * 7;
        const rot = Math.random() * 360;
        const hue = 155 + Math.random() * 40;
        return (
          <span
            key={i}
            style={{
              position: "absolute", top: "-6vh", left: `${left}%`,
              width: size, height: size * 0.35,
              background: `hsl(${hue} 70% 45%)`,
              transform: `rotate(${rot}deg)`,
              borderRadius: 2, opacity: 0.9,
              animation: `fall ${dur}s ${delay}s linear forwards`,
            }}
          />
        );
      })}
      <style>{`@keyframes fall{to{transform:translateY(110vh) rotate(720deg);opacity:1}}`}</style>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Welcome Card
   ────────────────────────────────────────────────────────────────── */
function WelcomeCard({
  name,
  doneThisWeek,
  level,
  levelXP,
  levelMax,
  className = "",
}: {
  name: string;
  doneThisWeek: number;
  level: number;
  levelXP: number;
  levelMax: number;
  className?: string;
}) {
  const pct = Math.min(100, Math.round((levelXP / levelMax) * 100));
  const firstName = name.split(" ")[0];
  const getNameFontSize = () => {
    if (firstName.length > 12) return "text-[28px]";
    if (firstName.length > 8) return "text-[34px]";
    return "text-[40px] md:text-[44px]";
  };

  return (
    <Card variant="compact" className={`h-full ${className}`}>
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-6 pt-1 pb-4">
          <div className="flex-1 min-w-0">
            <div className="text-[12px] text-neutral-500">Welcome back</div>
            <div className={`${getNameFontSize()} font-semibold tracking-tight leading-tight`}>{firstName}</div>
          </div>
          <div className="flex-none">
            <LevelRing level={level} value={levelXP} max={levelMax} showStats={false} size={120} stroke={14} />
          </div>
        </div>
        <div className="mt-auto pt-2 flex flex-wrap items-center gap-2">
          <Chip>{pct}% to next level</Chip>
          <Chip>{doneThisWeek} completed this week</Chip>
        </div>
      </div>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Company Snapshot
   ────────────────────────────────────────────────────────────────── */
// 0 open tasks = 100% (clear plate). Each task reduces the bar. Cap at 10 tasks = 0%.
const MAX_OPEN_TASKS = 10;

function CompanySnapshot({
  allTasks,
  onCompanyClick,
}: {
  allTasks: DBTask[];
  onCompanyClick: (company: string) => void;
}) {
  const buckets = COMPANIES.map((c) => {
    const open = allTasks.filter((t) => t.company_name === c).length;
    const progress = Math.max(0, Math.round((1 - open / MAX_OPEN_TASKS) * 100));
    return { name: c, open, progress };
  });

  return (
    <Card title="Company Snapshot">
      <div className="space-y-3">
        {buckets.map((b) => (
          <div
            key={b.name}
            onClick={() => onCompanyClick(b.name)}
            className="rounded-2xl border p-4 bg-white cursor-pointer hover:border-teal-300 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="text-[14px] font-semibold">{b.name}</div>
              <div className="text-xs text-neutral-600">{b.open} open</div>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-teal-100 overflow-hidden">
              <div className="h-full bg-teal-600" style={{ width: `${b.progress}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Notes Card
   ────────────────────────────────────────────────────────────────── */
function NotesCard({ onSave }: { onSave: (text: string) => Promise<void> }) {
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  async function handleSave() {
    if (!note.trim()) return;
    setSaving(true);
    await onSave(note.trim());
    setSaving(false);
    setSaved(true);
    setNote("");
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <Card title="Notes" variant="compact" className="h-full flex flex-col">
      <div className="flex-1">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full h-full min-h-[80px] rounded-xl border p-3 text-sm resize-none focus:ring-2 focus:ring-teal-200 outline-none"
          placeholder="Quick note…"
        />
      </div>
      <div className="mt-3 flex justify-end">
        <button
          onClick={handleSave}
          disabled={!note.trim() || saving}
          className="rounded-full bg-teal-600 text-white px-4 py-1.5 hover:bg-teal-700 text-sm font-medium disabled:opacity-40 transition-opacity"
        >
          {saved ? "Saved!" : saving ? "Saving…" : "Save to Google Doc"}
        </button>
      </div>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Company Goals Card (live from DB, editable by founders)
   ────────────────────────────────────────────────────────────────── */
function CompanyGoalsCard({ className, isFounder: founderView }: { className?: string; isFounder?: boolean }) {
  const { goals, refetch } = useCompanyGoals();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editLabel, setEditLabel] = React.useState("");
  const [editCurrent, setEditCurrent] = React.useState("");
  const [editTarget, setEditTarget] = React.useState("");
  const [editUnit, setEditUnit] = React.useState("%");
  const [adding, setAdding] = React.useState(false);
  const [newLabel, setNewLabel] = React.useState("");
  const [newTarget, setNewTarget] = React.useState("");
  const [newUnit, setNewUnit] = React.useState("%");

  function startEdit(g: { id: string; label: string; current_value: number; target_value: number; unit: string }) {
    setEditingId(g.id);
    setEditLabel(g.label);
    setEditCurrent(String(g.current_value));
    setEditTarget(String(g.target_value));
    setEditUnit(g.unit || "%");
  }

  async function saveEdit(id: string) {
    await upsertCompanyGoal({
      id,
      label: editLabel.trim(),
      current_value: parseFloat(editCurrent) || 0,
      target_value: parseFloat(editTarget) || 0,
      unit: editUnit,
    });
    setEditingId(null);
    refetch();
  }

  async function handleDelete(id: string) {
    await deleteCompanyGoal(id);
    refetch();
  }

  async function addGoal() {
    if (!newLabel.trim() || !newTarget) return;
    await upsertCompanyGoal({
      label: newLabel.trim(),
      target_value: parseFloat(newTarget) || 0,
      current_value: 0,
      unit: newUnit,
    });
    setNewLabel(""); setNewTarget(""); setNewUnit("%"); setAdding(false);
    refetch();
  }

  return (
    <Card title="Company Goals" subtitle="Targets & progress" className={className}>
      <div className="space-y-3 overflow-y-auto max-h-[260px]">
        {goals.length === 0 && (
          <div className="text-sm text-neutral-400 text-center py-4">No goals set yet.</div>
        )}
        {goals.map((g) => {
          const pct = g.target_value > 0 ? Math.min(100, Math.round((g.current_value / g.target_value) * 100)) : 0;
          const isEditing = editingId === g.id;
          return (
            <div key={g.id} className="rounded-xl border p-3 hover:border-teal-200 transition-colors bg-white">
              {isEditing ? (
                <div className="space-y-2">
                  <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="Goal label"
                    className="w-full border rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-teal-200" />
                  <div className="flex gap-2">
                    <input type="number" value={editCurrent} onChange={(e) => setEditCurrent(e.target.value)}
                      placeholder="Current" className="flex-1 border rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-teal-200" />
                    <input type="number" value={editTarget} onChange={(e) => setEditTarget(e.target.value)}
                      placeholder="Target" className="flex-1 border rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-teal-200" />
                    <select value={editUnit} onChange={(e) => setEditUnit(e.target.value)}
                      className="border rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-teal-200">
                      <option value="%">%</option>
                      <option value="clients">clients</option>
                      <option value="orders">orders</option>
                      <option value="tasks">tasks</option>
                      <option value="$">$</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(g.id)} className="flex-1 text-xs bg-teal-600 text-white px-2 py-1 rounded-lg hover:bg-teal-700">Save</button>
                    <button onClick={() => setEditingId(null)} className="text-xs border px-2 py-1 rounded-lg hover:bg-neutral-50">Cancel</button>
                    <button onClick={() => handleDelete(g.id)} className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50">Delete</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">{g.label}</div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-neutral-500">{g.current_value}/{g.target_value}{g.unit === "%" ? "%" : ` ${g.unit}`}</div>
                      {founderView && (
                        <button onClick={() => startEdit(g)}
                          className="text-xs text-teal-600 hover:text-teal-800">Edit</button>
                      )}
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-teal-100 overflow-hidden">
                    <div className="h-full bg-teal-600 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </>
              )}
            </div>
          );
        })}
        {founderView && adding && (
          <div className="rounded-xl border p-3 bg-teal-50 space-y-2">
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Goal label…"
              className="w-full border rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-teal-200" />
            <div className="flex gap-2">
              <input type="number" value={newTarget} onChange={(e) => setNewTarget(e.target.value)} placeholder="Target"
                className="flex-1 border rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-teal-200" />
              <select value={newUnit} onChange={(e) => setNewUnit(e.target.value)}
                className="border rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-teal-200">
                <option value="%">%</option>
                <option value="clients">clients</option>
                <option value="orders">orders</option>
                <option value="tasks">tasks</option>
                <option value="$">$</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={addGoal} disabled={!newLabel.trim() || !newTarget}
                className="flex-1 bg-teal-600 text-white rounded-lg px-2 py-1.5 text-xs hover:bg-teal-700 disabled:opacity-50">Add</button>
              <button onClick={() => setAdding(false)} className="border rounded-lg px-2 py-1.5 text-xs hover:bg-white">Cancel</button>
            </div>
          </div>
        )}
      </div>
      {founderView && !adding && (
        <button onClick={() => setAdding(true)} className="mt-3 w-full text-xs text-teal-600 hover:text-teal-800 border border-dashed border-teal-300 rounded-xl py-2 hover:bg-teal-50">
          + Add Goal
        </button>
      )}
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Accomplishments Card (shared between Founder + Team)
   ────────────────────────────────────────────────────────────────── */
function AccomplishmentsCard({
  accomplishments,
  onOpenAddAccomplishment,
}: {
  accomplishments: AccomplishmentDB[];
  onOpenAddAccomplishment: () => void;
}) {
  return (
    <Card className="h-[360px] flex flex-col">
      <div className="flex items-center justify-between mb-3 flex-shrink-0 relative z-20">
        <div>
          <h2 className="text-[14px] md:text-[15px] font-semibold leading-tight">Accomplishments</h2>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onOpenAddAccomplishment(); }}
          className="rounded-full bg-teal-600 relative z-30 cursor-pointer pointer-events-auto text-white px-3 py-1 hover:bg-teal-700 text-xs font-medium"
        >
          Add
        </button>
      </div>
      <div className="space-y-3 overflow-y-auto flex-1">
        {accomplishments.map((acc) => (
          <div key={acc.id} className="rounded-xl border p-3 bg-white">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-semibold text-teal-700">{acc.user_name}</span>
              <span className="text-xs text-neutral-400">· {new Date(acc.created_at).toLocaleDateString()}</span>
            </div>
            <div className="text-sm">{acc.text}</div>
          </div>
        ))}
        {accomplishments.length === 0 && (
          <div className="rounded-xl border p-3 bg-white">
            <div className="text-sm text-neutral-500 text-center py-4">No accomplishments yet — add your first one!</div>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────────
   TodayFounder
   ────────────────────────────────────────────────────────────────── */
export function TodayFounder({
  userName,
  completedThisWeek,
  level,
  xp,
  focusTasks,
  submittedTasks,
  allActiveTasks,
  accomplishments,
  onOpenCreateTask,
  onTaskClick,
  onApprove,
  onOpenAddAccomplishment,
  onCompanyClick,
  onSaveNote,
  refetch,
}: {
  userName: string;
  completedThisWeek: number;
  level: number;
  xp: number;
  focusTasks: DBTask[];
  submittedTasks: DBTask[];
  allActiveTasks: DBTask[];
  accomplishments: AccomplishmentDB[];
  onOpenCreateTask: () => void;
  onTaskClick: (task: DBTask) => void;
  onApprove: (task: DBTask) => void;
  onOpenAddAccomplishment: () => void;
  onCompanyClick: (name: string) => void;
  onSaveNote: (text: string) => Promise<void>;
  refetch: () => void;
}) {
  const equalCardH = "h-[360px]";

  // DnD state for sortable focus list
  const [focusList, setFocusList] = React.useState(focusTasks);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  React.useEffect(() => { setFocusList(focusTasks); }, [focusTasks]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setDraggingId(null);
    if (!over || active.id === over.id) return;
    const oldIndex = focusList.findIndex(t => t.id === active.id);
    const newIndex = focusList.findIndex(t => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newList = arrayMove(focusList, oldIndex, newIndex);
    setFocusList(newList);
    await Promise.all(newList.map((t, i) => dbUpdateTask(t.id, { sort_order: i })));
    refetch();
  }

  const draggingTask = draggingId ? focusList.find(t => t.id === draggingId) : null;

  return (
    <>
      <div className="grid grid-cols-12 gap-4 items-stretch">
        <div className="col-span-12 md:col-span-4">
          <WelcomeCard name={userName} doneThisWeek={completedThisWeek} level={level} levelXP={xp} levelMax={LEVEL_XP_THRESHOLD} className="h-full" />
        </div>
        <div className="col-span-12 md:col-span-8">
          <NotesCard onSave={onSaveNote} />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-6">
          <section className="relative rounded-2xl p-4 md:p-5 shadow-sm border bg-[#ECF7F3] h-[360px] flex flex-col" style={{ borderColor: "#0F766E" }}>
            <header className="mb-3 flex-shrink-0 flex items-center justify-between">
              <div>
                <h2 className="text-[15px] font-semibold leading-tight">Today's Focus</h2>
                <p className="text-xs text-neutral-600">Drag to reorder</p>
              </div>
              <button onClick={onOpenCreateTask}
                className="rounded-full border-2 border-teal-600 bg-white text-teal-600 px-3 py-1 hover:bg-teal-50 text-xs font-medium">
                NEW
              </button>
            </header>
            <div className="flex-1 overflow-y-auto pr-1">
              <DndContext sensors={sensors} collisionDetection={closestCorners}
                onDragStart={({ active }) => setDraggingId(active.id as string)}
                onDragEnd={handleDragEnd}>
                <SortableContext items={focusList.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {focusList.length === 0 && <div className="text-sm text-neutral-500 text-center py-8">No focus tasks yet</div>}
                    {focusList.map(t => (
                      <SortableTaskItem key={t.id} task={t} containerId="focus" onTaskClick={onTaskClick} />
                    ))}
                  </div>
                </SortableContext>
                <DragOverlay>
                  {draggingTask && <TaskRow task={draggingTask} onClick={() => {}} />}
                </DragOverlay>
              </DndContext>
            </div>
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 rounded-b-2xl bg-gradient-to-t from-[#ECF7F3] to-transparent z-10" />
          </section>
        </div>

        <div className="col-span-12 md:col-span-6">
          <Card title="Submitted for Approval" subtitle="Approve or return with notes" className={`${equalCardH} flex flex-col`}>
            <div className="relative flex-1 overflow-y-auto pr-1">
              <div className="space-y-2">
                {submittedTasks.length === 0 && (
                  <div className="text-xs text-neutral-500">Nothing pending.</div>
                )}
                {submittedTasks.map((t) => (
                  <div key={t.id} className="rounded-xl border p-3 flex items-center justify-between gap-3 bg-white">
                    <div className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer" onClick={() => onTaskClick(t)}>
                      <Avatar name={t.assignee_name || "Unassigned"} size={22} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{t.title}</div>
                        <div className="text-xs text-neutral-500">
                          {t.company_name}{t.assignee_name ? ` • @${t.assignee_name}` : ""}
                        </div>
                      </div>
                    </div>
                    <button className="text-xs rounded-xl border px-2 py-1 hover:border-teal-300"
                      onClick={(e) => { e.stopPropagation(); onApprove(t); }}>
                      Review
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-4">
          <div className={equalCardH}>
            <CompanySnapshot allTasks={allActiveTasks} onCompanyClick={onCompanyClick} />
          </div>
        </div>
        <div className="col-span-12 md:col-span-4">
          <CompanyGoalsCard className={equalCardH} isFounder />
        </div>
        <div className="col-span-12 md:col-span-4">
          <AccomplishmentsCard accomplishments={accomplishments} onOpenAddAccomplishment={onOpenAddAccomplishment} />
        </div>
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Today Mini Calendar (team view)
   ────────────────────────────────────────────────────────────────── */
function TodayCalendar() {
  const { meetings } = useMeetings();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = now.toLocaleDateString("en-CA");
  const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

  const byDay: Record<string, true> = {};
  meetings.forEach((m) => {
    byDay[new Date(m.scheduled_at).toLocaleDateString("en-CA")] = true;
  });

  return (
    <Card variant="compact" className="h-full">
      <div className="text-xs font-semibold text-neutral-500 mb-2">
        {now.toLocaleDateString([], { month: "long", year: "numeric" })}
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d, i) => (
          <div key={i} className="text-center text-[9px] font-semibold text-neutral-400 uppercase py-0.5">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: firstDow }).map((_, i) => <div key={`b-${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday = dateStr === todayStr;
          const hasMeeting = !!byDay[dateStr];
          return (
            <div key={dateStr} className={`relative flex flex-col items-center justify-center rounded-lg py-1.5 text-[11px] ${
              isToday ? "bg-teal-600 text-white font-semibold" : "text-neutral-600"
            }`}>
              {day}
              {hasMeeting && (
                <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isToday ? "bg-white" : "bg-teal-400"}`} />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────────
   TodayTeam
   ────────────────────────────────────────────────────────────────── */
export function TodayTeam({
  userName,
  completedThisWeek,
  level,
  xp,
  focusTasks,
  submittedTasks,
  filteredTasks,
  allTasks,
  accomplishments,
  onOpenCreateTask,
  onTaskClick,
  onCompanyClick,
  onOpenAddAccomplishment,
  onSaveNote,
  refetch,
}: {
  userName: string;
  completedThisWeek: number;
  level: number;
  xp: number;
  focusTasks: DBTask[];
  submittedTasks: DBTask[];
  filteredTasks: DBTask[];
  allTasks: DBTask[];
  accomplishments: AccomplishmentDB[];
  onOpenCreateTask: () => void;
  onTaskClick: (task: DBTask) => void;
  onCompanyClick: (company: string) => void;
  onOpenAddAccomplishment: () => void;
  onSaveNote: (text: string) => Promise<void>;
  refetch?: () => void;
}) {
  const focusIds = new Set(focusTasks.map((t) => t.id));
  const computedMyTasks = filteredTasks.filter(
    (t) => t.assignee_name === userName && t.status === "active" && !focusIds.has(t.id)
  );
  const equalCardH = "h-[360px]";
  const mySubmittedTasks = submittedTasks.filter((t) => t.assignee_name === userName);

  // DnD state
  const [focusList, setFocusList] = React.useState(focusTasks);
  const [activeList, setActiveList] = React.useState(computedMyTasks);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  React.useEffect(() => { setFocusList(focusTasks); }, [focusTasks]);
  React.useEffect(() => { setActiveList(computedMyTasks); }, [filteredTasks, userName, focusTasks]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setDraggingId(null);
    if (!over) return;
    const taskId = active.id as string;
    const overId = over.id as string;
    const sourceContainer = (active.data.current as any)?.containerId as string;
    const destContainer =
      (over.data.current as any)?.containerId ??
      (overId === "focus" || overId === "active" ? overId : null);

    if (!sourceContainer || !destContainer) return;

    if (sourceContainer === destContainer && sourceContainer === "focus") {
      // Reorder within focus
      const oldIdx = focusList.findIndex(t => t.id === taskId);
      const newIdx = focusList.findIndex(t => t.id === overId);
      if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;
      const newList = arrayMove(focusList, oldIdx, newIdx);
      setFocusList(newList);
      await Promise.all(newList.map((t, i) => dbUpdateTask(t.id, { sort_order: i })));
      refetch?.();
    } else if (sourceContainer !== destContainer) {
      if (destContainer === "focus") {
        const task = activeList.find(t => t.id === taskId);
        if (!task) return;
        setActiveList(prev => prev.filter(t => t.id !== taskId));
        setFocusList(prev => [...prev, { ...task, status: "focus" }]);
        await dbUpdateTask(taskId, { status: "focus" });
        refetch?.();
      } else {
        const task = focusList.find(t => t.id === taskId);
        if (!task) return;
        setFocusList(prev => prev.filter(t => t.id !== taskId));
        setActiveList(prev => [...prev, { ...task, status: "active" }]);
        await dbUpdateTask(taskId, { status: "active" });
        refetch?.();
      }
    }
  }

  const draggingTask = draggingId ? [...focusList, ...activeList].find(t => t.id === draggingId) : null;

  return (
    <>
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={({ active }) => setDraggingId(active.id as string)}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-12 gap-4">
        {/* Welcome — order-1 always */}
        <div className="col-span-12 md:col-span-4 order-1">
          <WelcomeCard name={userName} doneThisWeek={completedThisWeek} level={level} levelXP={xp} levelMax={LEVEL_XP_THRESHOLD} className="h-full" />
        </div>
        {/* Today's Focus — order-2 on mobile, order-3 on desktop */}
        <div className="col-span-12 md:col-span-6 order-2 md:order-3">
          <section className="relative rounded-2xl p-4 md:p-5 shadow-sm border bg-[#ECF7F3] h-[360px] flex flex-col" style={{ borderColor: "#0F766E" }}>
            <header className="mb-3 flex-shrink-0">
              <h2 className="text-[15px] font-semibold leading-tight">Today's Focus</h2>
            </header>
            <SortableContext items={focusList.map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div id="focus" className="flex-1 overflow-y-auto pr-1 min-h-[40px]">
                <div className="space-y-2">
                  {focusList.length === 0 && (
                    <div className="text-sm text-neutral-400 text-center py-8">
                      No focus tasks yet
                    </div>
                  )}
                  {focusList.map(t => (
                    <SortableTaskItem key={t.id} task={t} containerId="focus" onTaskClick={onTaskClick} />
                  ))}
                </div>
              </div>
            </SortableContext>
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 rounded-b-2xl bg-gradient-to-t from-[#ECF7F3] to-transparent z-10" />
          </section>
        </div>
        {/* Notes — order-3 on mobile, order-2 on desktop */}
        <div className="col-span-12 md:col-span-8 order-3 md:order-2">
          <NotesCard onSave={onSaveNote} />
        </div>
        {/* Full Task List — order-4 always */}
        <div className="col-span-12 md:col-span-6 order-4">
          <div className={`relative ${equalCardH} flex flex-col`}>
            <Card
              title="Full Task List"
              subtitle="Drag tasks to Today's Focus"
              className="h-full flex flex-col"
            >
              <SortableContext items={activeList.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <div id="active" className="flex-1 overflow-y-auto pr-1 min-h-[40px]">
                  <div className="space-y-2">
                    {activeList.length === 0 && (
                      <div className="text-sm text-neutral-500 text-center py-8 leading-relaxed">
                        Don't see any tasks?<br />
                        <span className="text-neutral-400">Check the Tasks page for any unassigned tasks!</span>
                      </div>
                    )}
                    {activeList.map(t => (
                      <SortableTaskItem key={t.id} task={t} containerId="active" onTaskClick={onTaskClick} />
                    ))}
                  </div>
                </div>
              </SortableContext>
            </Card>
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 rounded-b-2xl bg-gradient-to-t from-white to-transparent z-10" />
          </div>
        </div>
      </div>
      <DragOverlay>
        {draggingTask && <TaskRow task={draggingTask} onClick={() => {}} />}
      </DragOverlay>
    </DndContext>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-4">
          <Card title="Submitted for Approval" subtitle="Waiting on founder" className={`${equalCardH} flex flex-col`}>
            <div className="relative flex-1 overflow-y-auto pr-1">
              <div className="space-y-2">
                {mySubmittedTasks.length === 0 && (
                  <div className="text-xs text-neutral-500">You have no pending submissions.</div>
                )}
                {mySubmittedTasks.map((t) => (
                  <div key={t.id} onClick={() => onTaskClick(t)}
                    className="rounded-xl border p-3 flex items-center justify-between gap-3 bg-white cursor-pointer hover:border-teal-300">
                    <div className="flex items-center gap-2">
                      <Avatar name={t.assignee_name || "You"} size={22} />
                      <div>
                        <div className="text-sm font-medium">{t.title}</div>
                        <div className="text-xs text-neutral-500">{t.company_name} • Pending</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
        <div className="col-span-12 md:col-span-4">
          <CompanyGoalsCard />
        </div>
        <div className="col-span-12 md:col-span-4">
          <AccomplishmentsCard accomplishments={accomplishments} onOpenAddAccomplishment={onOpenAddAccomplishment} />
        </div>
      </div>
    </>
  );
}
