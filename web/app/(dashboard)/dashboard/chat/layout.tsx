"use client";

import { useEffect, useState } from "react";
import { chatApi, ConversationItem } from "@/lib/api/chat";
import { botsApi, Bot } from "@/lib/api/bots";
import { Plus, MessageSquare, Bot as BotIcon, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string>("all");
  const params = useParams();
  const searchParams = useSearchParams();
  const currentConversationId = params.conversationId as string | undefined;

  useEffect(() => {
    // Load all active bots
    botsApi.list().then(setBots).catch(console.error);
  }, []);

  useEffect(() => {
    // Fetch conversations filtered by selected bot
    const botQuery = selectedBotId === "all" ? undefined : selectedBotId;
    chatApi
      .getConversations(botQuery)
      .then((data) => {
        setConversations(data);
      })
      .catch(console.error);
  }, [selectedBotId]);

  return (
    <div className="flex h-[calc(100vh-7.5rem)] bg-bg-surface/50 border border-border rounded-xl overflow-hidden shadow-sm">
      {/* Sidebar */}
      <div className="w-72 bg-bg-base border-r border-border flex flex-col shrink-0">
        {/* New Chat CTA */}
        <div className="p-3.5 border-b border-border space-y-2.5">
          <Link
            href={`/dashboard/chat${selectedBotId !== "all" ? `?botId=${selectedBotId}` : ""}`}
            className="btn btn-primary w-full flex items-center justify-center gap-2 text-xs font-medium h-9"
          >
            <Plus className="w-4 h-4" />
            New Conversation
          </Link>

          {/* Bot Filter Dropdown */}
          <div className="relative">
            <select
              value={selectedBotId}
              onChange={(e) => setSelectedBotId(e.target.value)}
              className="w-full h-8 rounded-lg bg-bg-elevated border border-border px-2.5 text-[11px] text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="all">All Bot Touchpoints</option>
              {bots.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
          {conversations.length === 0 ? (
            <p className="text-xs text-text-muted text-center mt-6">
              No recent conversations.
            </p>
          ) : (
            conversations.map((conv) => {
              const matchedBot = bots.find((b) => b.id === conv.bot_id);
              const isActive = currentConversationId === conv.id;

              return (
                <Link
                  key={conv.id}
                  href={`/dashboard/chat/${conv.id}`}
                  className={`flex flex-col gap-1 p-2.5 rounded-lg text-xs transition-colors ${
                    isActive
                      ? "bg-bg-elevated text-text-primary border border-border shadow-xs"
                      : "text-text-secondary hover:bg-bg-surface"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span className="truncate flex-1 font-medium">{conv.title || "Untitled Chat"}</span>
                  </div>

                  {matchedBot && (
                    <div className="flex items-center gap-1 pl-5.5 text-[10px] text-text-muted">
                      <BotIcon className="w-2.5 h-2.5" />
                      <span className="truncate">{matchedBot.name}</span>
                    </div>
                  )}
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
