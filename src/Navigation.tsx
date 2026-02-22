// Navigation.tsx - Sidebar and TopHeader
import React, { useState } from "react";
import { Role, Page, FounderPage, TeamPage, isFounder } from "./types";

export function Sidebar({
  role,
  active,
  onSelect,
  userName,
}: {
  role: Role;
  active: Page;
  onSelect: (p: Page) => void;
  userName: string;
}) {
  const founderNav: FounderPage[] = ["Today", "Meetings", "Tasks", "Companies", "Playbook", "My Team"];
  const teamNav: TeamPage[] = ["Today", "Tasks", "Companies", "Playbook", "Career Path"];
  const nav = isFounder(role) ? founderNav : teamNav;

  return (
    <aside className="w-72 shrink-0 border-r bg-white/90 backdrop-blur-sm sticky top-0 h-screen p-4 flex flex-col">
      <button
        onClick={() => onSelect("Today" as Page)}
        className="text-[22px] font-semibold leading-none mb-6 tracking-tight text-left hover:text-teal-700 transition-colors"
      >
        Backstage HQ
      </button>
      <nav className="space-y-1 text-[15px]">
        {nav.map((item) => {
          const isActive = active === item;
          return (
            <button
              key={item}
              onClick={() => onSelect(item)}
              className={`w-full text-left flex items-center justify-between rounded-xl px-3 py-2 hover:bg-teal-50 ${
                isActive ? "bg-teal-50 text-teal-900 font-medium" : ""
              }`}
            >
              <span>{item}</span>
            </button>
          );
        })}
      </nav>
      <div className="mt-auto pt-6">
        <button
          onClick={() => onSelect("Settings" as Page)}
          className="text-sm font-medium hover:text-teal-600 transition-colors text-left"
        >
          {userName}
        </button>
      </div>
    </aside>
  );
}

function useGreeting(name: string) {
  const hour = new Date().getHours();
  const period = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
  const firstName = name.split(" ")[0];
  return `Good ${period}, ${firstName}`;
}

export function TopHeader({
  onSearch,
  onOpenChat,
  unreadCount,
  userName,
}: {
  onSearch: (q: string) => void;
  onOpenChat: () => void;
  unreadCount: number;
  userName: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const greeting = useGreeting(userName);

  return (
    <div className="sticky top-0 z-30 -mx-4 md:-mx-6 lg:-mx-8 -mt-4 md:-mt-6 lg:-mt-8">
      <div className="h-12 md:h-14 bg-white flex items-center justify-between px-3 md:px-4 border-b">
        <div className="text-[14px] font-medium text-neutral-700 pl-1">{greeting}</div>
        <div className="flex items-center gap-2">
          <div className="flex items-center w-[200px] md:w-[280px]">
            <input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); onSearch(e.target.value); }}
              className="w-full rounded-full border px-2.5 py-0.5 text-[12px] outline-none focus:ring-2 focus:ring-teal-200"
            />
          </div>
          <button
            onClick={onOpenChat}
            className="relative rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm hover:bg-teal-100 transition-colors font-medium text-teal-900"
          >
            Inbox
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-orange-500 rounded-full w-3 h-3" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
