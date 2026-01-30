// ChatPanel.tsx
import React, { useState } from "react";
import { motion } from "framer-motion";
import { Message } from "./types";
import { Avatar } from "./ui";
import { markMessagesFromUserAsRead } from "./useDatabase";

export function ChatPanel({
  userName,
  isOpen,
  onClose,
  messages,
  onSendMessage,
  teamMembers = [],
  currentUserId,
}: {
  userName: string;
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  onSendMessage: (content: string, to?: string) => void;
  teamMembers?: { id: string; display_name: string | null }[];
  currentUserId?: string | null;
}) {
  const [newMessage, setNewMessage] = useState("");
  const [activeChannel, setActiveChannel] = useState<"team" | string>("team");

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
      if (!otherUserId || !currentUserId) return false;
      return (
        (msg.from_user_id === otherUserId && msg.to_user_id === currentUserId) ||
        (msg.from_user_id === currentUserId && msg.to_user_id === otherUserId)
      );
    }
  });

  const teammates = teamMembers
    .map((tm) => tm.display_name)
    .filter((name): name is string => name !== null && name !== userName);

  const hasUnreadDM = (person: string) => {
    const otherUser = teamMembers.find((tm) => tm.display_name === person);
    if (!otherUser || !currentUserId) return false;
    return messages.some(
      (msg) =>
        msg.from_user_id === otherUser.id &&
        msg.to_user_id === currentUserId &&
        !msg.is_read
    );
  };

  function switchChannel(channel: string) {
    setActiveChannel(channel);
    if (channel !== "team") {
      const otherUser = teamMembers.find((tm) => tm.display_name === channel);
      if (otherUser) markMessagesFromUserAsRead(otherUser.id);
    }
  }

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ x: 400 }}
      animate={{ x: 0 }}
      exit={{ x: 400 }}
      className="fixed right-0 top-0 bottom-0 w-[600px] bg-white border-l shadow-2xl z-40 flex"
    >
      <div className="w-48 bg-neutral-50 border-r flex flex-col">
        <div className="border-b px-3 py-3 bg-teal-50">
          <h3 className="font-semibold text-sm">Inbox</h3>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-2 py-2">
            <p className="text-xs font-semibold text-neutral-500 px-2 mb-1">
              CHANNELS
            </p>

            <button
              onClick={() => switchChannel("team")}
              className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 ${
                activeChannel === "team"
                  ? "bg-teal-100 text-teal-900 font-medium"
                  : "hover:bg-neutral-100"
              }`}
            >
              Team Chat
            </button>
          </div>

          <div className="px-2 py-2 border-t">
            <p className="text-xs font-semibold text-neutral-500 px-2 mb-1">
              DIRECT MESSAGES
            </p>
            {teammates.map((person) => (
              <button
                key={person}
                onClick={() => switchChannel(person)}
                className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 ${
                  activeChannel === person
                    ? "bg-teal-100 text-teal-900 font-medium"
                    : "hover:bg-neutral-100"
                }`}
              >
                <Avatar name={person} size={16} />
                <span className="flex-1 truncate">{person}</span>
                {hasUnreadDM(person) && (
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {activeChannel !== "team" && <Avatar name={activeChannel} size={24} />}
            <h3 className="font-semibold">
              {activeChannel === "team" ? "Team Chat" : activeChannel}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-900 text-xl"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredMessages.length === 0 ? (
            <div className="text-center text-neutral-400 text-sm mt-8">
              No messages yet. Start the conversation!
            </div>
          ) : (
            filteredMessages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-xl p-3 ${
                  msg.is_kudos
                    ? "bg-yellow-50 border border-yellow-200"
                    : "bg-neutral-50"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Avatar name={msg.from_name || "Unknown"} size={20} />
                  <span className="text-xs font-medium">
                    {msg.from_name || "Unknown"}
                  </span>
                  {msg.is_kudos && (
                    <span className="text-xs text-yellow-600 font-medium">
                      Task Highlight
                    </span>
                  )}
                  <span className="text-xs text-neutral-400 ml-auto">
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-sm text-neutral-700">{msg.content}</p>
              </div>
            ))
          )}
        </div>

        <div className="border-t p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={
                activeChannel === "team"
                  ? "Message team..."
                  : `Message ${activeChannel}...`
              }
              className="flex-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
            />
            <button
              onClick={send}
              className="bg-teal-600 text-white rounded-xl px-4 py-2 hover:bg-teal-700 text-sm font-medium"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
