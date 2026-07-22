import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";
import { getRequestUser, UnauthorizedError } from "./_lib/supabaseServer.js";
import { ANTHROPIC_TOOLS, executeTool } from "./_lib/taskTools.js";

const MAX_ITERATIONS = 6;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let requestUser;
  try {
    requestUser = await getRequestUser(req.headers.authorization);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    console.error("Auth error in /api/chat:", err);
    res.status(500).json({ error: "Assistant is not configured" });
    return;
  }

  const { supabase, user, displayName, role } = requestUser;

  const incoming: ChatMessage[] = Array.isArray(req.body?.messages) ? req.body.messages : [];
  if (incoming.length === 0) {
    res.status(400).json({ error: "messages is required" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Missing ANTHROPIC_API_KEY");
    res.status(500).json({ error: "Assistant is not configured" });
    return;
  }

  const anthropic = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

  const today = new Date().toISOString().slice(0, 10);
  const system = `You are Claude, embedded as an assistant inside the Backstage team dashboard.
You're talking to ${displayName} (role: ${role}). Today's date is ${today}.
You can list, create, update the status of, and reassign tasks using the provided tools.
Assignees and companies are referred to by their plain display name, not an id — the tools resolve names to the right record automatically.
Be concise and conversational. When you take an action, briefly confirm what you did.`;

  let messages: Anthropic.MessageParam[] = incoming.map((m) => ({ role: m.role, content: m.content }));

  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await anthropic.messages.create({
        model,
        max_tokens: 2048,
        system,
        tools: ANTHROPIC_TOOLS,
        messages,
      });

      if (response.stop_reason !== "tool_use") {
        const reply = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        res.status(200).json({ reply: reply || "(no response)" });
        return;
      }

      messages = [...messages, { role: "assistant", content: response.content }];

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block): Promise<Anthropic.ToolResultBlockParam> => {
          try {
            const result = await executeTool(block.name, block.input, supabase, user);
            return { type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) };
          } catch (err: any) {
            return {
              type: "tool_result",
              tool_use_id: block.id,
              content: err?.message ?? String(err),
              is_error: true,
            };
          }
        })
      );

      messages = [...messages, { role: "user", content: toolResults }];
    }

    res.status(200).json({
      reply:
        "I wasn't able to finish that — I made several tool calls but didn't reach a final answer. Could you rephrase or break the request into smaller steps?",
    });
  } catch (err) {
    console.error("Error in /api/chat:", err);
    res.status(500).json({ error: "Something went wrong talking to the assistant" });
  }
}
