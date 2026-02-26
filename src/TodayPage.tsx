// TodayPage.tsx - Today page for Founder and Team views
import React from "react";
import { DBTask, COMPANIES, LEVEL_XP_THRESHOLD } from "./types";
import { AccomplishmentDB, useMeetings } from "./useDatabase";
import { Card, Chip, Avatar, CompanyChip, LevelRing } from "./ui";
import { TaskList } from "./TasksPage";
import { updateTask as dbUpdateTask, useCompanyGoals, upsertCompanyGoal } from "./useDatabase";

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
  const [editCurrent, setEditCurrent] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [newLabel, setNewLabel] = React.useState("");
  const [newTarget, setNewTarget] = React.useState("");
  const [newUnit, setNewUnit] = React.useState("%");

  async function saveEdit(id: string) {
    await upsertCompanyGoal({ id, current_value: parseFloat(editCurrent) || 0 });
    setEditingId(null);
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
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">{g.label}</div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-neutral-500">{g.current_value}/{g.target_value}{g.unit === "%" ? "%" : ` ${g.unit}`}</div>
                  {founderView && !isEditing && (
                    <button onClick={() => { setEditingId(g.id); setEditCurrent(String(g.current_value)); }}
                      className="text-xs text-teal-600 hover:text-teal-800">Edit</button>
                  )}
                </div>
              </div>
              {isEditing ? (
                <div className="flex gap-2 mt-1">
                  <input type="number" value={editCurrent} onChange={(e) => setEditCurrent(e.target.value)}
                    className="flex-1 border rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-teal-200"
                    placeholder="Current value" />
                  <button onClick={() => saveEdit(g.id)} className="text-xs bg-teal-600 text-white px-2 py-1 rounded-lg hover:bg-teal-700">Save</button>
                  <button onClick={() => setEditingId(null)} className="text-xs border px-2 py-1 rounded-lg hover:bg-neutral-50">✕</button>
                </div>
              ) : (
                <div className="h-2 w-full rounded-full bg-teal-100 overflow-hidden">
                  <div className="h-full bg-teal-600 transition-all" style={{ width: `${pct}%` }} />
                </div>
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
  onPinTask,
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
  onPinTask?: (task: DBTask) => void;
}) {
  const equalCardH = "h-[360px]";

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
                <p className="text-xs text-neutral-600">Smartly chosen by due date, priority & quick wins</p>
              </div>
              <button onClick={onOpenCreateTask}
                className="rounded-full border-2 border-teal-600 bg-white text-teal-600 px-3 py-1 hover:bg-teal-50 text-xs font-medium">
                NEW
              </button>
            </header>
            <div className="flex-1 overflow-y-auto pr-1">
              <TaskList tasks={focusTasks} onTaskClick={onTaskClick} onPin={onPinTask} />
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
  onPinTask,
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
  onPinTask?: (task: DBTask) => void;
}) {
  const myTasks = filteredTasks.filter((t) => t.assignee_name === userName && t.status !== "completed" && t.status !== "archived");
  const equalCardH = "h-[360px]";
  const mySubmittedTasks = submittedTasks.filter((t) => t.assignee_name === userName);

  return (
    <>
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
              <p className="text-xs text-neutral-600">Your top priorities</p>
            </header>
            <div className="flex-1 overflow-y-auto pr-1">
              <TaskList tasks={focusTasks} onTaskClick={onTaskClick} onPin={onPinTask} />
            </div>
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
              subtitle="Everything on your plate"
              className="h-full flex flex-col"
            >
              <div className="flex-1 overflow-y-auto pr-1">
                <TaskList tasks={myTasks} onTaskClick={onTaskClick} onPin={onPinTask} />
              </div>
            </Card>
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 rounded-b-2xl bg-gradient-to-t from-white to-transparent z-10" />
          </div>
        </div>
      </div>

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
          <CompanySnapshot allTasks={allTasks.filter((t) => t.status !== "completed" && t.status !== "archived")} onCompanyClick={onCompanyClick} />
        </div>
        <div className="col-span-12 md:col-span-4">
          <AccomplishmentsCard accomplishments={accomplishments} onOpenAddAccomplishment={onOpenAddAccomplishment} />
        </div>
      </div>
    </>
  );
}
