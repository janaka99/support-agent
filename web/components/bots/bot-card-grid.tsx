"use client";

import { Bot } from "@/lib/api/bots";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot as BotIcon, MessageSquare, Edit3, Trash2, Cpu, Sparkles } from "lucide-react";
import Link from "next/link";

interface BotCardGridProps {
  bots: Bot[];
  isLoading: boolean;
  onDeleteBot: (botId: string) => void;
}

export function BotCardGrid({ bots, isLoading, onDeleteBot }: BotCardGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-64 rounded-xl border border-border bg-bg-surface/50 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (bots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-border bg-bg-surface/30">
        <div className="w-12 h-12 rounded-full bg-accent-muted flex items-center justify-center mb-4">
          <BotIcon className="w-6 h-6 text-accent" />
        </div>
        <h3 className="text-base font-semibold text-text-primary">No Bot Touchpoints created</h3>
        <p className="text-sm text-text-muted mt-1 max-w-md">
          Create customer-facing bots (e.g., Storefront Assistant, VIP Priority Line) and assemble a team of specialist agents to power them.
        </p>
        <Link href="/dashboard/bots/new" className="mt-5">
          <Button className="btn-primary">Create Your First Bot</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {bots.map((bot) => (
        <div
          key={bot.id}
          className="flex flex-col justify-between rounded-xl border border-border bg-bg-surface hover:border-border-strong transition-all duration-200 p-5 group shadow-sm hover:shadow-md"
        >
          <div>
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-xl bg-accent-muted border border-accent/20 shrink-0">
                  <BotIcon className="w-5 h-5 text-accent" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-text-primary truncate">
                    {bot.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="mono text-[11px] text-text-muted">
                      {bot.model}
                    </span>
                    <span className="text-[10px] text-text-muted/60">•</span>
                    <span className="text-[11px] text-text-muted">
                      {bot.agents?.length ?? 0} agents
                    </span>
                  </div>
                </div>
              </div>

              <Badge
                variant={bot.is_active ? "success" : "muted"}
                className="text-[10px] capitalize shrink-0"
              >
                {bot.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>

            {/* Description */}
            <p className="text-xs text-text-secondary mt-3 line-clamp-2 leading-relaxed">
              {bot.description || "No description provided."}
            </p>

            {/* Greeting preview */}
            {bot.greeting_message && (
              <div className="mt-3 p-2.5 rounded-lg bg-bg-base border border-border/80 text-[11px] text-text-muted italic line-clamp-2">
                &ldquo;{bot.greeting_message}&rdquo;
              </div>
            )}

            {/* Specialist Agent Team Roster */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-text-muted">
                <Cpu className="w-3.5 h-3.5 text-accent" />
                <span>Specialist Team:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {bot.agents && bot.agents.length > 0 ? (
                  bot.agents.map((ag) => (
                    <span
                      key={ag.agent_id}
                      className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-bg-elevated text-text-secondary border border-border"
                      title={ag.routing_hint || ag.specialization}
                    >
                      <Sparkles className="w-2.5 h-2.5 text-accent" />
                      {ag.agent_name || "Specialist"}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-text-muted italic">
                    No specialist agents assigned yet.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Footer / Actions */}
          <div className="mt-6 pt-3.5 border-t border-border flex items-center justify-between">
            <Link href={`/dashboard/chat?botId=${bot.id}`}>
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 text-xs gap-1.5 text-accent hover:text-accent hover:bg-accent-muted border-border"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chat in Playground</span>
              </Button>
            </Link>

            <div className="flex items-center gap-1">
              <Link href={`/dashboard/bots/${bot.id}`}>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-text-muted hover:text-text-primary"
                  title="Edit Bot & Roster"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </Button>
              </Link>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDeleteBot(bot.id)}
                className="h-8 w-8 p-0 text-text-muted hover:text-rose-400"
                title="Delete Bot"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
