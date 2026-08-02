"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { BotForm } from "@/components/bots/bot-form";
import { botsApi, Bot } from "@/lib/api/bots";
import { Spinner } from "@/components/ui/spinner";

export default function EditBotPage() {
  const params = useParams();
  const botId = params.id as string;
  const [bot, setBot] = useState<Bot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadBot() {
      try {
        const data = await botsApi.get(botId);
        setBot(data);
      } catch (err) {
        console.error("Failed to load bot:", err);
      } finally {
        setIsLoading(false);
      }
    }
    if (botId) loadBot();
  }, [botId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-24">
        <Spinner size="lg" className="text-accent" />
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="p-8 text-center text-text-muted">
        Bot touchpoint not found.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title={`Edit Bot: ${bot.name}`}
        description="Update supervisor routing prompt, model, and specialist agent team assignments."
      />
      <BotForm initialBot={bot} isEditing />
    </div>
  );
}
