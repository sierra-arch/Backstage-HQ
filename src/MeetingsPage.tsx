// MeetingsPage.tsx - Meetings with real Supabase data
import React, { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useMeetings, createMeeting, updateMeeting, deleteMeeting, Meeting } from "./useDatabase";
import { Card } from "./ui";
import { COMPANIES, Role, isFounder } from "./types";
import { Modal } from "./TaskModals";

/* ──────────────────────────────────────────────────────────────────
   Meeting Form Modal (create + edit)
   ────────────────────────────────────────────────────────────────── */
function MeetingFormModal({
  isOpen, onClose, onSaved, existing,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing?: Meeting;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const existingDt = existing?.scheduled_at ? new Date(existing.scheduled_at) : null;
  const [scheduledDate, setScheduledDate] = useState(
    existingDt ? existingDt.toLocaleDateString("en-CA") : ""
  );
  const [scheduledTime, setScheduledTime] = useState(() => {
    if (!existingDt) return "09:00";
    const h = String(existingDt.getHours()).padStart(2, "0");
    // snap to nearest :00/:15/:30/:45
    const rawMin = existingDt.getMinutes();
    const snapped = [0, 15, 30, 45].reduce((prev, cur) =>
      Math.abs(cur - rawMin) < Math.abs(prev - rawMin) ? cur : prev
    );
    return `${h}:${String(snapped).padStart(2, "0")}`;
  });
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const TIME_OPTIONS: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 15, 30, 45]) {
      TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }

  function formatTimeLabel(t: string) {
    const [hStr, mStr] = t.split(":");
    const h = parseInt(hStr);
    const suffix = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${mStr} ${suffix}`;
  }

  async function handleSave() {
    if (!title.trim() || !scheduledDate) return;
    setSaving(true);
    const isoString = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
    if (existing) {
      await updateMeeting(existing.id, { title, scheduled_at: isoString, notes: notes || null });
    } else {
      await createMeeting({ title, scheduled_at: isoString, notes: notes || null, company_id: null, created_by: null });
    }
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={existing ? "Edit Meeting" : "Schedule Meeting"} size="small">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-neutral-700">Title *</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Ops Standup"
            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none" />
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700">Date *</label>
          <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)}
            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none" />
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700">Time *</label>
          <select value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)}
            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none bg-white">
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>{formatTimeLabel(t)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700">Notes / Agenda</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder={"Agenda items...\n\n• Topic 1\n• Topic 2\n• Action items"}
            className="w-full mt-1 rounded-xl border px-3 py-2 text-sm min-h-[100px] focus:ring-2 focus:ring-teal-200 outline-none" />
        </div>
        <div className="flex gap-3 pt-4 border-t">
          <button onClick={handleSave} disabled={!title.trim() || !scheduledDate || saving}
            className="flex-1 bg-teal-600 text-white rounded-xl px-4 py-2 hover:bg-teal-700 font-medium text-sm disabled:opacity-50">
            {saving ? "Saving..." : existing ? "Save Changes" : "Schedule"}
          </button>
          <button onClick={onClose} className="px-4 py-2 border rounded-xl hover:bg-neutral-50 text-sm">Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Meeting Detail Modal
   ────────────────────────────────────────────────────────────────── */
function MeetingDetailModal({
  meeting, isOpen, onClose, onEdit, onDelete, role,
}: {
  meeting: Meeting | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  role: Role;
}) {
  if (!meeting) return null;
  const dt = new Date(meeting.scheduled_at);
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={meeting.title} size="medium">
      <div className="space-y-4">
        <div className="bg-teal-50 rounded-xl px-4 py-3 border border-teal-100">
          <div className="text-sm font-medium text-teal-900">
            {dt.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
          </div>
          <div className="text-sm text-teal-700">
            {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
        {meeting.notes ? (
          <div>
            <label className="text-sm font-medium text-neutral-700">Notes & Agenda</label>
            <pre className="mt-1 text-sm text-neutral-600 whitespace-pre-wrap font-sans">{meeting.notes}</pre>
          </div>
        ) : (
          <p className="text-sm text-neutral-400">No notes added yet.</p>
        )}
        {isFounder(role) && (
          <div className="flex gap-3 pt-4 border-t">
            <button onClick={onEdit} className="flex-1 border rounded-xl px-4 py-2 hover:bg-neutral-50 text-sm font-medium">
              Edit
            </button>
            <button onClick={onDelete} className="text-red-600 border border-red-200 rounded-xl px-4 py-2 hover:bg-red-50 text-sm font-medium">
              Delete
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Mini Calendar
   ────────────────────────────────────────────────────────────────── */
function MiniCalendar({
  meetings,
  selectedDate,
  onSelectDate,
}: {
  meetings: Meeting[];
  selectedDate: string | null;
  onSelectDate: (dateStr: string | null) => void;
}) {
  const [viewDate, setViewDate] = useState(new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Map "YYYY-MM-DD" → meetings on that day
  const byDay: Record<string, Meeting[]> = {};
  meetings.forEach((m) => {
    const key = new Date(m.scheduled_at).toLocaleDateString("en-CA"); // "YYYY-MM-DD"
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(m);
  });

  const todayStr = new Date().toLocaleDateString("en-CA");
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="text-neutral-400 hover:text-neutral-700 px-2 py-1 rounded-lg hover:bg-neutral-100 text-sm">
          ‹
        </button>
        <span className="text-sm font-semibold text-neutral-700">
          {viewDate.toLocaleDateString([], { month: "long", year: "numeric" })}
        </span>
        <button
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="text-neutral-400 hover:text-neutral-700 px-2 py-1 rounded-lg hover:bg-neutral-100 text-sm">
          ›
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-neutral-400 uppercase py-1">{d}</div>
        ))}
      </div>

      {/* Date cells */}
      <div className="grid grid-cols-7 gap-y-2">
        {/* Leading blanks */}
        {Array.from({ length: firstDow }).map((_, i) => <div key={`blank-${i}`} className="py-3" />)}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const hasMeeting = !!byDay[dateStr];
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(isSelected ? null : dateStr)}
              className={`relative flex flex-col items-center justify-center rounded-xl py-3 text-sm transition-colors ${
                isSelected
                  ? "bg-teal-600 text-white font-semibold"
                  : isToday
                  ? "bg-[#ECF7F3] text-teal-800 font-semibold"
                  : "hover:bg-neutral-100 text-neutral-700"
              }`}
            >
              {day}
              {hasMeeting && (
                <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                  isSelected ? "bg-white" : "bg-teal-500"
                }`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Google Calendar link helper
   ────────────────────────────────────────────────────────────────── */
function googleCalendarUrl(meeting: Meeting) {
  const start = new Date(meeting.scheduled_at);
  const end = new Date(start.getTime() + 60 * 60 * 1000); // default 1 hour
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: meeting.title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: meeting.notes || "",
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

/* ──────────────────────────────────────────────────────────────────
   Meetings Page
   ────────────────────────────────────────────────────────────────── */
export function MeetingsPage({ role }: { role: Role }) {
  const { meetings, loading, refetch } = useMeetings();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const now = new Date();
  const upcoming = meetings.filter((m) => new Date(m.scheduled_at) >= now);
  const past = meetings.filter((m) => new Date(m.scheduled_at) < now);

  // When a date is selected, show all meetings that day (past or future)
  // When no date selected, show only upcoming
  const displayedUpcoming = selectedDate
    ? meetings.filter((m) => new Date(m.scheduled_at).toLocaleDateString("en-CA") === selectedDate)
    : upcoming;

  async function handleDelete(id: string) {
    await deleteMeeting(id);
    setSelectedMeeting(null);
    refetch();
  }

  function formatMeetingTime(iso: string) {
    const d = new Date(iso);
    const dayLabel = d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `${dayLabel} • ${time}`;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Calendar */}
        <Card title="Calendar">
          <MiniCalendar meetings={meetings} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
        </Card>

        {/* Upcoming list */}
        <Card>
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <h2 className="text-[14px] md:text-[15px] font-semibold leading-tight">
                {selectedDate ? new Date(selectedDate + "T12:00:00").toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }) : "Upcoming Meetings"}
              </h2>
              {!selectedDate && <p className="text-xs text-neutral-500">Scheduled sessions</p>}
            </div>
            {isFounder(role) && (
              <button onClick={() => setShowCreate(true)}
                className="flex-shrink-0 rounded-full border border-teal-400 bg-teal-50 text-teal-700 px-3 py-1 hover:bg-teal-100 text-xs font-medium">
                + Schedule
              </button>
            )}
          </div>
          {loading ? (
            <div className="text-sm text-neutral-500 text-center py-6">Loading...</div>
          ) : displayedUpcoming.length === 0 ? (
            <div className="text-sm text-neutral-500 text-center py-6">
              {selectedDate ? "No meetings on this day." : "No upcoming meetings scheduled."}
            </div>
          ) : (
            <div className="space-y-2">
              {displayedUpcoming.map((m) => {
                const isPast = new Date(m.scheduled_at) < now;
                return (
                <div key={m.id}
                  onClick={() => setSelectedMeeting(m)}
                  className={`rounded-xl border p-3 flex items-start justify-between gap-3 cursor-pointer hover:border-teal-300 transition-colors ${isPast ? "bg-neutral-50 opacity-70" : "bg-white"}`}>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{m.title}</div>
                    <div className="text-xs text-neutral-500">{formatMeetingTime(m.scheduled_at)}</div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <a
                      href={googleCalendarUrl(m)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[11px] rounded-xl border border-teal-300 bg-teal-50 text-teal-800 px-2 py-1 hover:bg-teal-100 font-medium"
                    >
                      + Google Cal
                    </a>
                    <button className="text-xs rounded-xl border px-2 py-1 hover:border-teal-300">
                      Agenda
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <MeetingDetailModal
        meeting={selectedMeeting} isOpen={!!selectedMeeting} role={role}
        onClose={() => setSelectedMeeting(null)}
        onEdit={() => { setEditingMeeting(selectedMeeting); setSelectedMeeting(null); }}
        onDelete={() => selectedMeeting && handleDelete(selectedMeeting.id)}
      />

      <AnimatePresence>
        {showCreate && (
          <MeetingFormModal isOpen={showCreate} onClose={() => setShowCreate(false)} onSaved={refetch} />
        )}
        {editingMeeting && (
          <MeetingFormModal isOpen={!!editingMeeting} onClose={() => setEditingMeeting(null)} onSaved={refetch} existing={editingMeeting} />
        )}
      </AnimatePresence>
    </div>
  );
}
