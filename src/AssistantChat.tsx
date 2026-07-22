// AssistantChat.tsx
import React, { useRef, useState, useEffect } from "react";
import { supabase } from "./supabase";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
}

export function AssistantChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, isSending]);

  async function send() {
    const text = input.trim();
    if (!text || isSending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setIsSending(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Your session expired — please refresh the page.", isError: true },
        ]);
        return;
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.error || "Something went wrong — try again.", isError: true },
        ]);
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong — try again.", isError: true },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 pr-1">
        {messages.length === 0 ? (
          <div className="text-center text-neutral-400 text-sm mt-4">
            Ask Claude about your tasks — "what's due this week?", "create a task for...", "mark X as done"
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl p-3 text-sm ${
                  msg.role === "user"
                    ? "bg-teal-600 text-white"
                    : msg.isError
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-neutral-50 text-neutral-700"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}
        {isSending && (
          <div className="flex justify-start">
            <div className="rounded-xl p-3 text-sm bg-neutral-50 text-neutral-400">
              Claude is thinking…
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask Claude..."
          disabled={isSending}
          className="flex-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 outline-none"
        />
        <button
          onClick={send}
          disabled={isSending}
          className="bg-teal-600 text-white rounded-full px-4 py-2 hover:bg-teal-700 text-sm font-medium disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
