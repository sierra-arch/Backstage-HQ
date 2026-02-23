// Navigation.tsx - Sidebar and TopHeader
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Role, Page, FounderPage, TeamPage, isFounder } from "./types";

export function Sidebar({
  role,
  active,
  onSelect,
  userName,
  mobileOpen,
  onMobileClose,
}: {
  role: Role;
  active: Page;
  onSelect: (p: Page) => void;
  userName: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const founderNav: FounderPage[] = ["Today", "Meetings", "Tasks", "Companies", "Playbook", "My Team"];
  const teamNav: TeamPage[] = ["Today", "Tasks", "Companies", "Playbook", "Career Path"];
  const nav = isFounder(role) ? founderNav : teamNav;

  function handleSelect(item: Page) {
    onSelect(item);
    onMobileClose?.();
  }

  const sidebarContent = (
    <aside className="w-72 h-full bg-white/95 backdrop-blur-sm flex flex-col p-4">
      <button
        onClick={() => handleSelect("Today" as Page)}
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
              onClick={() => handleSelect(item)}
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
          onClick={() => handleSelect("Settings" as Page)}
          className="text-sm font-medium hover:text-teal-600 transition-colors text-left"
        >
          {userName}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar — always visible on md+ */}
      <div className="hidden md:flex w-72 shrink-0 border-r sticky top-0 h-screen">
        {sidebarContent}
      </div>

      {/* Mobile sidebar — slides in as overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onMobileClose}
              className="fixed inset-0 bg-black/40 z-40 md:hidden"
            />
            {/* Panel */}
            <motion.div
              key="panel"
              initial={{ x: -288 }}
              animate={{ x: 0 }}
              exit={{ x: -288 }}
              transition={{ type: "tween", duration: 0.22 }}
              className="fixed top-0 left-0 bottom-0 z-50 md:hidden border-r shadow-2xl"
            >
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
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
  searchValue,
  onOpenChat,
  onOpenMobileMenu,
  unreadCount,
  userName,
}: {
  onSearch: (q: string) => void;
  searchValue: string;
  onOpenChat: () => void;
  onOpenMobileMenu?: () => void;
  unreadCount: number;
  userName: string;
}) {
  const greeting = useGreeting(userName);

  return (
    <div className="sticky top-0 z-30 -mx-4 md:-mx-6 lg:-mx-8 -mt-4 md:-mt-6 lg:-mt-8">
      <div className="h-12 md:h-14 bg-white flex items-center justify-between px-3 md:px-4 border-b gap-2">
        {/* Hamburger — mobile only */}
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden flex flex-col gap-1.5 p-1 shrink-0"
          aria-label="Open menu"
        >
          <span className="block w-5 h-0.5 bg-neutral-700 rounded" />
          <span className="block w-5 h-0.5 bg-neutral-700 rounded" />
          <span className="block w-5 h-0.5 bg-neutral-700 rounded" />
        </button>

        <div className="text-[14px] font-medium text-neutral-700 pl-1 hidden md:block">{greeting}</div>

        <div className="flex items-center gap-2 ml-auto">
          <div className="relative flex items-center w-[160px] md:w-[280px]">
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchValue}
              onChange={(e) => onSearch(e.target.value)}
              className="w-full rounded-full border px-3 py-1.5 text-[12px] outline-none focus:ring-2 focus:ring-teal-200 pr-7"
            />
            {searchValue && (
              <button
                onClick={() => onSearch("")}
                className="absolute right-2.5 text-neutral-400 hover:text-neutral-600 leading-none text-xs"
              >
                ✕
              </button>
            )}
          </div>
          <button
            onClick={onOpenChat}
            className="relative rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm hover:bg-teal-100 transition-colors font-medium text-teal-900 shrink-0"
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
