// ChatPanel.tsx - Team chat and direct messages
import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Message } from "./types";
import { markMessagesFromUserAsRead } from "./useDatabase";
import { Avatar } from "./ui";

export function ChatPanel({
  userName: _userName,
  isOpen,
  onClose,
  messages,
  onSendMessage,
  teamMembers = [],
  onTaskClick,
  onMarkRead,
  currentUserId,
}: {
  userName: string;
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  onSendMessage: (content: string, to?: string) => void;
  teamMembers?: { id: string; display_name: string | null; avatar_url?: string | null }[];
  onTaskClick?: (taskId: string) => void;
  onMarkRead?: () => void;
  currentUserId?: string;
}) {

  const [newMessage, setNewMessage] = useState("");
  const [activeChannel, setActiveChannel] = useState<"team" | string>("team");
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const teammates = teamMembers
    .filter((tm) => tm.id !== currentUserId)
    .map((tm) => tm.display_name)
    .filter((name): name is string => name !== null);

  const hasUnreadDM = (person: string) => {
    const otherUser = teamMembers.find((tm) => tm.display_name === person);
    if (!otherUser) return false;
    return messages.some(
      (msg) => msg.from_user_id === otherUser.id && msg.to_user_id === currentUserId && !msg.is_read
    );
  };

  // Auto-switch to first unread DM when panel opens
  useEffect(() => {
    if (isOpen && currentUserId) {
      const firstUnread = teammates.find((person) => hasUnreadDM(person));
      if (firstUnread) {
        setActiveChannel(firstUnread);
        const otherUser = teamMembers.find((tm) => tm.display_name === firstUnread);
        if (otherUser) markMessagesFromUserAsRead(otherUser.id).then(() => onMarkRead?.());
      }
    }
    // Reset to team chat when panel closes
    if (!isOpen) setActiveChannel("team");
  }, [isOpen, currentUserId]);

  function send() {
    if (!newMessage.trim()) return;
    const recipient = activeChannel !== "team" ? activeChannel : undefined;
    onSendMessage(newMessage, recipient);
    setNewMessage("");
  }

  const filteredMessages = messages.filter((msg) => {
    if (activeChannel === "team") {
      return msg.message_type === "team" && !msg.is_kudos;
    } else {
      const otherUser = teamMembers.find((tm) => tm.display_name === activeChannel);
      const otherUserId = otherUser?.id;
      return (
        (msg.from_user_id === otherUserId && msg.to_user_id === currentUserId) ||
        (msg.from_user_id === currentUserId && msg.to_user_id === otherUserId)
      );
    }
  });


  // Scroll the messages container to the bottom after paint
  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => {
      const el = messagesContainerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [filteredMessages.length, activeChannel, isOpen]);

  function switchChannel(channel: string) {
    setActiveChannel(channel);
    if (channel !== "team") {
      const otherUser = teamMembers.find((tm) => tm.display_name === channel);
      if (otherUser) markMessagesFromUserAsRead(otherUser.id).then(() => onMarkRead?.());
    }
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-39" onClick={onClose} />
      <motion.div
        initial={{ x: 400 }}
        animate={{ x: 0 }}
        exit={{ x: 400 }}
        className="fixed right-0 top-0 bottom-0 w-[480px] bg-white border-l shadow-2xl z-40 flex"
      >
        {/* Sidebar */}
        <div className="w-48 bg-neutral-50 border-r flex flex-col">
          <div className="border-b px-3 py-3">
            <h3 className="font-semibold text-sm text-neutral-700">Messages</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            {/* Team Chat */}
            <div className="px-2 py-2">
              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider px-2 mb-1">Channels</p>
              <button
                onClick={() => switchChannel("team")}
                className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 ${
                  activeChannel === "team" ? "bg-teal-100 text-teal-900 font-medium" : "hover:bg-neutral-100"
                }`}
              >
                Team Chat
              </button>
            </div>

            {/* Direct Messages */}
            {teammates.length > 0 && (
              <div className="px-2 py-1 border-t">
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider px-2 mb-1 mt-1">Direct Messages</p>
                {teammates.map((person) => (
                  <button
                    key={person}
                    onClick={() => switchChannel(person)}
                    className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 ${
                      activeChannel === person ? "bg-teal-100 text-teal-900 font-medium" : "hover:bg-neutral-100"
                    }`}
                  >
                    <Avatar name={person} size={16} photoUrl={teamMembers.find((tm) => tm.display_name === person)?.avatar_url ?? undefined} />
                    <span className="flex-1 truncate">{person}</span>
                    {hasUnreadDM(person) && (
                      <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          <div className="border-b px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {activeChannel !== "team" && <Avatar name={activeChannel} size={24} photoUrl={teamMembers.find((tm) => tm.display_name === activeChannel)?.avatar_url ?? undefined} />}
              <h3 className="font-semibold">
                {activeChannel === "team" ? "# Team Chat" : activeChannel}
              </h3>
            </div>
            <button onClick={onClose} className="text-neutral-500 hover:text-neutral-900 text-xl">×</button>
          </div>


          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredMessages.length === 0 ? (
              <div className="text-center text-neutral-400 text-sm mt-8">
                {activeChannel === "team" ? "No team messages yet." : `No messages with ${activeChannel} yet.`}
              </div>
            ) : (
              filteredMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-xl p-3 ${
                    msg.is_kudos || msg.content.startsWith("🏆")
                      ? "bg-yellow-50 border border-yellow-200"
                      : msg.content.startsWith("🎉")
                      ? "bg-violet-50 border border-violet-200"
                      : msg.content.startsWith("You've been assigned")
                      ? "bg-[#ECF7F3] border border-teal-100"
                      : "bg-neutral-50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar name={msg.from_name || "Unknown"} size={20} photoUrl={teamMembers.find((tm) => tm.id === msg.from_user_id)?.avatar_url ?? undefined} />
                    <span className="text-xs font-medium">{msg.from_name || "Unknown"}</span>
                    <span className="text-xs text-neutral-400 ml-auto">
                      {(() => {
                        const d = new Date(msg.created_at);
                        const isToday = d.toDateString() === new Date().toDateString();
                        return isToday
                          ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : d.toLocaleDateString([], { month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                      })()}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-700">{msg.content}</p>
                  {msg.related_task_id && onTaskClick && (
                    <button
                      onClick={() => { onTaskClick(msg.related_task_id!); onClose(); }}
                      className="text-xs text-teal-600 underline mt-1 block hover:text-teal-800"
                    >
                      View completed task →
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="border-t p-4">
            <div className="flex gap-2">
              <input
                type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && send()}
                placeholder={activeChannel === "team" ? "Message team..." : `Message ${activeChannel}...`}
                className="flex-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
              />
              <button onClick={send} className="bg-teal-600 text-white rounded-xl px-4 py-2 hover:bg-teal-700 text-sm font-medium">
                Send
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
