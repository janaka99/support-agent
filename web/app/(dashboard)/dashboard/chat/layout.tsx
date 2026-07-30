"use client";

import { useEffect, useState } from "react";
import { chatApi } from "@/lib/api/chat";
import { Plus, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [conversations, setConversations] = useState<
    Array<{ id: string; status: string; title: string }>
  >([]);
  const params = useParams();
  const currentConversationId = params.conversationId as string | undefined;

  useEffect(() => {
    // Fetch conversations list on mount
    chatApi
      .getConversations()
      .then((data) => {
        setConversations(data);
      })
      .catch(console.error);
  }, []);

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-bg-surface/50 border border-border rounded-xl overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-bg-base border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <Link
            href="/dashboard/chat"
            className="btn btn-primary w-full flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {(conversations || []).length === 0 && (
            <p className="text-sm text-text-muted text-center mt-4">
              No recent chats.
            </p>
          )}
          {(conversations || []).map((conv) => (
            <Link
              key={conv.id}
              href={`/dashboard/chat/${conv.id}`}
              className={`flex items-center gap-3 p-3 rounded-lg text-sm transition-colors ${
                currentConversationId === conv.id
                  ? "bg-bg-elevated text-text-primary shadow-sm"
                  : "text-text-secondary hover:bg-bg-surface"
              }`}
            >
              <MessageSquare className="w-4 h-4 opacity-70" />
              <div className="truncate flex-1">{conv.title}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
