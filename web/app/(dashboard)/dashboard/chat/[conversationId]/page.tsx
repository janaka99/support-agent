"use client";

import { useState, useRef, useEffect, use } from "react";
import { chatApi } from "@/lib/api/chat";
import { Send, Bot, User, AlertTriangle, ShieldAlert, Copy, Check, Sparkles } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useRouter } from "next/navigation";
import { BASE_URL } from "@/lib/api/client";

type Message = {
  id: string;
  role: "user" | "assistant" | "system" | "error";
  content: string;
};

const SUGGESTED_PROMPTS = [
  { label: "📦 Check order status", query: "Can you check the shipping status for order #1042?" },
  { label: "💳 Request a refund", query: "I would like to request a refund for my recent transaction." },
  { label: "🛡️ Payment issue", query: "My credit card was declined for charge #789, what happened?" },
  { label: "👤 Talk to human", query: "This is urgent, please escalate me to a human representative." },
];

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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

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
      if (event.data === "[DONE]") {
        setIsLoading(false);
        return;
      }

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

  const handleSend = async (messageText?: string) => {
    const textToSend = (messageText || input).trim();
    if (!textToSend || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend,
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
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isGuardrailOrFallback = (content: string) => {
    const lower = content.toLowerCase();
    return (
      lower.includes("violates safety guidelines") ||
      lower.includes("trouble connecting right now") ||
      lower.includes("blocked by safety")
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-bg-base">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full max-w-lg mx-auto text-center space-y-6 animate-in fade-in duration-500 py-12">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shadow-sm">
              <Sparkles className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-text-primary">Multi-Agent Support Session</h3>
              <p className="text-sm text-text-muted">
                Ask a question to trigger intelligent agent routing, RAG knowledge retrieval, and tool execution.
              </p>
            </div>

            {/* Quick-start suggested prompt chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full pt-2">
              {SUGGESTED_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(prompt.query)}
                  className="text-left text-xs p-3 rounded-xl bg-bg-surface border border-border hover:border-accent/40 hover:bg-accent/5 text-text-secondary hover:text-text-primary transition-all duration-200 shadow-sm"
                >
                  <span className="font-medium block mb-1 text-text-primary">{prompt.label}</span>
                  <span className="text-text-muted truncate block">{prompt.query}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === "user";
          const isWarning = !isUser && isGuardrailOrFallback(msg.content);

          return (
            <div
              key={msg.id}
              className={`flex gap-3.5 group ${
                isUser ? "flex-row-reverse" : "flex-row"
              } animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-medium shadow-sm ${
                  isUser
                    ? "bg-accent text-white"
                    : isWarning
                    ? "bg-amber-500/20 border border-amber-500/30 text-amber-400"
                    : "bg-bg-surface border border-border text-text-primary"
                }`}
              >
                {isUser ? (
                  <User className="w-4 h-4" />
                ) : isWarning ? (
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                ) : (
                  <Bot className="w-4 h-4 text-accent" />
                )}
              </div>

              {/* Message Bubble */}
              <div className="relative max-w-[82%] sm:max-w-[75%] space-y-1">
                <div
                  className={`px-4 py-3 rounded-2xl text-[14px] leading-relaxed relative ${
                    isUser
                      ? "bg-accent text-white rounded-tr-xs shadow-sm"
                      : isWarning
                      ? "bg-amber-500/10 border border-amber-500/30 text-amber-200 rounded-tl-xs"
                      : "bg-bg-surface border border-border text-text-primary rounded-tl-xs shadow-xs"
                  }`}
                >
                  {/* Warning Header */}
                  {isWarning && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 mb-1.5 pb-1 border-b border-amber-500/20">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Security & Resilience Alert</span>
                    </div>
                  )}

                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>

                {/* Copy button for assistant responses */}
                {!isUser && (
                  <div className="flex items-center gap-2 px-1 text-xs text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="hover:text-text-primary flex items-center gap-1 py-0.5"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Animated Typing Indicator */}
        {isLoading && (
          <div className="flex gap-3.5 flex-row animate-in fade-in duration-300">
            <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center bg-bg-surface border border-border text-accent shadow-sm">
              <Bot className="w-4 h-4" />
            </div>
            <div className="px-4 py-3 rounded-2xl bg-bg-surface border border-border rounded-tl-xs flex items-center gap-3 shadow-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-accent animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 rounded-full bg-accent animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 rounded-full bg-accent animate-bounce" />
              </div>
              <span className="text-xs text-text-muted font-medium">Agent routing & executing...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-4 bg-bg-surface border-t border-border">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="relative flex items-center max-w-4xl mx-auto"
        >
          <input
            type="text"
            className="input w-full pr-14 py-3.5 pl-4 rounded-xl bg-bg-elevated/60 border border-border focus:border-accent focus:bg-bg-surface text-sm transition-all duration-200 shadow-none"
            placeholder="Type your question or request..."
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
