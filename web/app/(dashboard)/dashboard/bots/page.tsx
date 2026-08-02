"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Plus, Bot as BotIcon, RefreshCw } from "lucide-react";
import { BotCardGrid } from "@/components/bots/bot-card-grid";
import { botsApi, Bot } from "@/lib/api/bots";
import Link from "next/link";

export default function BotsStudioPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBots = async () => {
    try {
      setIsLoading(true);
      const data = await botsApi.list();
      setBots(data);
    } catch (err) {
      console.error("Failed to fetch bots:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBots();
  }, []);

  const handleDeleteBot = async (botId: string) => {
    if (!confirm("Are you sure you want to delete this Bot touchpoint?")) {
      return;
    }
    try {
      await botsApi.delete(botId);
      setBots((prev) => prev.filter((b) => b.id !== botId));
    } catch (err) {
      alert("Failed to delete bot.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Bots Studio"
        description="Build and customize customer-facing Bot touchpoints, configure their supervisor routing prompts, and assemble specialist agent teams."
        action={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchBots}
              disabled={isLoading}
              className="gap-2 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            <Link href="/dashboard/bots/new">
              <Button className="btn-primary gap-2 text-xs">
                <Plus className="w-4 h-4" /> Create New Bot
              </Button>
            </Link>
          </div>
        }
      />

      <BotCardGrid
        bots={bots}
        isLoading={isLoading}
        onDeleteBot={handleDeleteBot}
      />
    </div>
  );
}
