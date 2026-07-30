"use client";

import { useState } from "react";
import { chatApi } from "@/lib/api/chat";
import { Send, Bot } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useRouter } from "next/navigation";

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setIsLoading(true);

    try {
      // Send the first message to create a new conversation
      const res = (await chatApi.send(input.trim())) as any;
      if (res.conversation_id) {
        // Redirect to the new conversation page, which will load the history and stream
        router.push(`/dashboard/chat/${res.conversation_id}`);
      }
    } catch (err: any) {
      console.error(err);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-bg-elevated flex items-center justify-center mb-4 shadow-sm">
          <Bot className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold text-text-primary">How can I help you today?</h2>
        <p className="text-text-muted max-w-md">
          Start a new conversation to test the AI support agent pipeline. 
          Your message will be processed in the background.
        </p>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-bg-base border-t border-border">
        <form onSubmit={handleSend} className="relative flex items-center max-w-3xl mx-auto w-full">
          <input
            type="text"
            className="input w-full pr-14 py-4 pl-4 rounded-xl shadow-sm text-[15px]"
            placeholder="Message the agent..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-icon btn-primary rounded-lg h-10 w-10"
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
