"use client";

import { useState, useEffect } from "react";
import { chatApi } from "@/lib/api/chat";
import { botsApi, Bot } from "@/lib/api/bots";
import { Send, Bot as BotIcon, Sparkles, Cpu } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useRouter, useSearchParams } from "next/navigation";

const SUGGESTED_PROMPTS = [
  { label: "📦 Check order status", query: "Can you check the shipping status for order #1042?" },
  { label: "💳 Request a refund", query: "I would like to request a refund for my recent transaction." },
  { label: "🛡️ Payment issue", query: "My credit card was declined for charge #789, what happened?" },
  { label: "👤 Talk to human", query: "This is urgent, please escalate me to a human representative." },
];

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const botIdFromQuery = searchParams.get("botId");

  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string>("");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    botsApi
      .list()
      .then((data) => {
        setBots(data);
        if (data.length > 0) {
          if (botIdFromQuery && data.some((b) => b.id === botIdFromQuery)) {
            setSelectedBotId(botIdFromQuery);
          } else {
            setSelectedBotId(data[0].id);
          }
        }
      })
      .catch(console.error);
  }, [botIdFromQuery]);

  const currentBot = bots.find((b) => b.id === selectedBotId);

  const handleSend = async (messageText?: string) => {
    const textToSend = (messageText || input).trim();
    if (!textToSend || isLoading) return;

    setIsLoading(true);

    try {
      // Send the first message to create a new conversation with chosen bot
      const res = await chatApi.send(textToSend, undefined, selectedBotId || undefined);
      if (res.conversation_id) {
        router.push(`/dashboard/chat/${res.conversation_id}`);
      }
    } catch (err: any) {
      console.error(err);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-bg-base">
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
        {/* Bot Icon & Selector */}
        <div className="flex flex-col items-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-accent-muted border border-accent/20 flex items-center justify-center text-accent shadow-sm">
            <BotIcon className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-text-primary">
              {currentBot?.name || "Multi-Agent Support Playground"}
            </h2>
            <p className="text-xs text-text-muted max-w-md">
              {currentBot?.description || "Select a bot touchpoint to test live multi-agent orchestration and dynamic tool calls."}
            </p>
          </div>

          {/* Bot Selector Dropdown */}
          {bots.length > 1 && (
            <div className="pt-1">
              <select
                value={selectedBotId}
                onChange={(e) => setSelectedBotId(e.target.value)}
                className="h-8 rounded-lg bg-bg-surface border border-border px-3 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {bots.map((b) => (
                  <option key={b.id} value={b.id}>
                    Target Bot: {b.name} ({b.model})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Bot Greeting & Specialist Team Roster */}
        {currentBot && (
          <div className="w-full p-4 rounded-xl border border-border bg-bg-surface text-left space-y-3 shadow-xs">
            <div className="text-xs text-text-secondary italic">
              &ldquo;{currentBot.greeting_message || "Hello! How can our specialist team help today?"}&rdquo;
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border/60">
              <span className="text-[11px] font-medium text-text-muted flex items-center gap-1">
                <Cpu className="w-3 h-3 text-accent" /> Ready Specialists:
              </span>
              {currentBot.agents && currentBot.agents.length > 0 ? (
                currentBot.agents.map((ag) => (
                  <span
                    key={ag.agent_id}
                    className="mono text-[10px] px-2 py-0.5 rounded-md bg-bg-elevated text-text-secondary border border-border"
                  >
                    {ag.agent_name || "Specialist"}
                  </span>
                ))
              ) : (
                <span className="text-[10px] text-text-muted italic">No agents attached</span>
              )}
            </div>
          </div>
        )}

        {/* Suggested Prompts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full pt-1">
          {SUGGESTED_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(prompt.query)}
              className="text-left text-xs p-3 rounded-xl bg-bg-surface border border-border hover:border-accent/40 hover:bg-accent-muted/10 text-text-secondary hover:text-text-primary transition-all duration-200 shadow-xs"
            >
              <span className="font-medium block mb-0.5 text-text-primary">{prompt.label}</span>
              <span className="text-text-muted truncate block text-[11px]">{prompt.query}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-bg-surface border-t border-border">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="relative flex items-center max-w-4xl mx-auto w-full"
        >
          <input
            type="text"
            className="input w-full pr-14 py-3.5 pl-4 rounded-xl bg-bg-elevated/60 border border-border focus:border-accent focus:bg-bg-surface text-sm transition-all duration-200 shadow-none"
            placeholder={
              currentBot
                ? `Message ${currentBot.name}...`
                : "Type your customer support question..."
            }
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
