"use client";

import { useState, useRef, useEffect, use } from "react";
import { chatApi } from "@/lib/api/chat";
import { Send, Bot, User } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useRouter } from "next/navigation";
import { BASE_URL } from "@/lib/api/client";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export default function ChatConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = use(params);
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch initial messages on load
  useEffect(() => {
    if (!conversationId) return;
    
    setIsLoading(true);
    chatApi.getMessages(conversationId)
      .then((data) => {
        setMessages(data as Message[]);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [conversationId]);

  // Connect to the SSE stream
  useEffect(() => {
    if (!conversationId) return;

    const eventSource = new EventSource(`${BASE_URL}/api/v1/chat/${conversationId}`);

    eventSource.onmessage = (event) => {
      if (event.data === "connected") return;

      try {
        const incomingMessage = JSON.parse(event.data);
        setMessages((prev) => {
          if (prev.find((m) => m.id === incomingMessage.id)) return prev;
          return [...prev, incomingMessage];
        });
      } catch (err) {
        console.error("Error parsing incoming message:", err);
      }
    };

    eventSource.onerror = (error) => {
      console.error("SSE Error:", error);
    };

    return () => {
      eventSource.close();
    };
  }, [conversationId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      await chatApi.send(userMessage.content, conversationId);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + "-error",
          role: "assistant",
          content: `Error: ${err.message || "Failed to send message"}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-text-muted space-y-4">
            <div className="w-12 h-12 rounded-full bg-bg-elevated flex items-center justify-center">
              <Bot className="w-6 h-6 text-text-secondary" />
            </div>
            <p>Send a message to test the ingestion queue.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-4 ${
              msg.role === "user" ? "flex-row-reverse" : "flex-row"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${
                msg.role === "user"
                  ? "bg-accent text-white"
                  : "bg-bg-elevated border border-border text-text-primary"
              }`}
            >
              {msg.role === "user" ? (
                <User className="w-4 h-4" />
              ) : (
                <Bot className="w-4 h-4" />
              )}
            </div>

            <div
              className={`px-4 py-3 rounded-2xl max-w-[80%] text-[15px] leading-relaxed ${
                msg.role === "user"
                  ? "bg-accent-muted text-accent border border-accent/20 rounded-tr-sm"
                  : "bg-bg-elevated text-text-primary border border-border rounded-tl-sm"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {messages.length > 0 && messages[messages.length - 1].role === "user" && (
          <div className="flex gap-4 flex-row">
            <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center bg-bg-elevated border border-border text-text-primary">
              <Bot className="w-4 h-4" />
            </div>
            <div className="px-4 py-3 rounded-2xl bg-bg-elevated text-text-primary border border-border rounded-tl-sm flex items-center gap-2">
              <Spinner className="w-4 h-4 text-text-muted" />
              <span className="text-text-muted text-sm">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-bg-base border-t border-border">
        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            type="text"
            className="input w-full pr-14 py-3.5 pl-4 rounded-xl shadow-none"
            placeholder="Ask the support agent..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-icon btn-primary rounded-lg h-9 w-9"
          >
            {isLoading ? (
              <Spinner className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
