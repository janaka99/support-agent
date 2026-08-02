"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { analyticsApi, AnalyticsOverview } from "@/lib/api/analytics";
import {
  DollarSign,
  Coins,
  MessageSquare,
  TrendingDown,
  Cpu,
  Layers,
  ExternalLink,
  Sparkles,
  Calendar,
} from "lucide-react";

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await analyticsApi.getOverview();
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load analytics");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto py-12 flex flex-col items-center justify-center gap-4">
        <Spinner size="lg" className="text-accent" />
        <p className="text-sm text-text-muted">Calculating real-time token usage and costs...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-6xl mx-auto py-8">
        <PageHeader
          title="Cost & Token Analytics"
          description="Real-time LLM operational cost and usage monitoring."
        />
        <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm mt-4">
          <p>{error || "Unable to retrieve analytics data."}</p>
        </div>
      </div>
    );
  }

  // Calculate highest daily tokens for visual scaling of bars
  const maxDailyTokens = Math.max(
    ...data.daily_cost_history.map((d) => d.tokens),
    1000
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <PageHeader
        title="Cost & Token Analytics"
        description="Monitor token consumption, LLM operational expenditures, and per-conversation metrics in real time."
      />

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-border bg-bg-surface shadow-sm rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Total LLM Spend
              </p>
              <h3 className="text-2xl font-bold text-text-primary mt-1">
                ${data.total_cost_usd < 0.01 && data.total_cost_usd > 0
                  ? data.total_cost_usd.toFixed(5)
                  : data.total_cost_usd.toFixed(4)}
              </h3>
              <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>Across all agents</span>
              </p>
            </div>
            <div className="p-3 rounded-xl bg-accent-muted text-accent">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border bg-bg-surface shadow-sm rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Avg Cost / Conversation
              </p>
              <h3 className="text-2xl font-bold text-text-primary mt-1">
                ${data.avg_cost_per_conversation < 0.01 && data.avg_cost_per_conversation > 0
                  ? data.avg_cost_per_conversation.toFixed(5)
                  : data.avg_cost_per_conversation.toFixed(4)}
              </h3>
              <p className="text-[11px] text-text-muted mt-1">
                Per resolved inquiry
              </p>
            </div>
            <div className="p-3 rounded-xl bg-bg-elevated text-text-secondary">
              <TrendingDown className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border bg-bg-surface shadow-sm rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Total Tokens
              </p>
              <h3 className="text-2xl font-bold text-text-primary mt-1">
                {data.total_tokens.toLocaleString()}
              </h3>
              <p className="text-[11px] text-text-muted mt-1">
                Prompt + Completion
              </p>
            </div>
            <div className="p-3 rounded-xl bg-bg-elevated text-text-secondary">
              <Coins className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border bg-bg-surface shadow-sm rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Total Conversations
              </p>
              <h3 className="text-2xl font-bold text-text-primary mt-1">
                {data.total_conversations.toLocaleString()}
              </h3>
              <p className="text-[11px] text-text-muted mt-1">
                ~{data.avg_tokens_per_conversation.toLocaleString()} tokens/ticket
              </p>
            </div>
            <div className="p-3 rounded-xl bg-bg-elevated text-text-secondary">
              <MessageSquare className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 14-Day Usage & Daily Spend Visualizer */}
      <Card className="border border-border bg-bg-surface shadow-sm rounded-2xl">
        <CardContent className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
            <div>
              <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <Calendar className="w-4 h-4 text-accent" />
                <span>Daily LLM Volume & Cost (Last 14 Days)</span>
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Token consumption breakdown per calendar day.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-text-muted">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-accent inline-block" />
                <span>Token Volume</span>
              </span>
            </div>
          </div>

          <div className="pt-2">
            <div className="grid grid-cols-7 sm:grid-cols-14 gap-2 items-end h-40 pt-4">
              {data.daily_cost_history.map((day) => {
                const heightPercent = Math.max(
                  Math.round((day.tokens / maxDailyTokens) * 100),
                  day.tokens > 0 ? 8 : 2
                );
                const shortDate = day.date.slice(5); // MM-DD
                return (
                  <div
                    key={day.date}
                    className="flex flex-col items-center gap-2 h-full justify-end group relative"
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-bg-base border border-border px-2.5 py-1.5 rounded-lg text-[10px] text-text-primary pointer-events-none z-10 whitespace-nowrap shadow-lg">
                      <div className="font-semibold">{day.date}</div>
                      <div>{day.tokens.toLocaleString()} tokens (${day.cost_usd.toFixed(4)})</div>
                    </div>

                    <div className="w-full bg-bg-elevated/40 rounded-t-md h-full flex items-end overflow-hidden">
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full rounded-t-md transition-all duration-500 ${
                          day.tokens > 0
                            ? "bg-accent group-hover:bg-accent-hover"
                            : "bg-border/30"
                        }`}
                      />
                    </div>
                    <span className="text-[10px] text-text-muted font-mono">
                      {shortDate}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Model Breakdown & Cost Efficiency */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border border-border bg-bg-surface shadow-sm rounded-2xl">
          <CardContent className="p-6 space-y-4">
            <div className="border-b border-border pb-3">
              <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <Cpu className="w-4 h-4 text-accent" />
                <span>Model Distribution</span>
              </h3>
              <p className="text-xs text-text-muted">Spend by foundation model.</p>
            </div>

            <div className="space-y-3 pt-1">
              {data.model_breakdown.length === 0 ? (
                <p className="text-xs text-text-muted py-4 text-center">
                  No model usage recorded yet.
                </p>
              ) : (
                data.model_breakdown.map((item) => (
                  <div
                    key={item.model}
                    className="p-3 rounded-xl bg-bg-elevated/40 border border-border/60 flex items-center justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-text-primary font-mono truncate">
                        {item.model}
                      </p>
                      <p className="text-[11px] text-text-muted">
                        {item.tokens.toLocaleString()} tokens
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-text-primary">
                        ${item.cost_usd.toFixed(4)}
                      </span>
                      <p className="text-[10px] text-accent font-medium">
                        {item.percentage}%
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Per-Conversation Cost Drill-Down */}
        <Card className="lg:col-span-2 border border-border bg-bg-surface shadow-sm rounded-2xl">
          <CardContent className="p-6 space-y-4">
            <div className="border-b border-border pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                  <Layers className="w-4 h-4 text-accent" />
                  <span>Recent Conversations Cost</span>
                </h3>
                <p className="text-xs text-text-muted">
                  Itemized token consumption and cost per support session.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              {data.recent_conversations.length === 0 ? (
                <p className="text-xs text-text-muted py-8 text-center">
                  No conversations recorded yet.
                </p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-text-muted uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 pr-4 font-medium">Conversation</th>
                      <th className="py-2.5 px-4 font-medium">Status</th>
                      <th className="py-2.5 px-4 font-medium">Tokens</th>
                      <th className="py-2.5 px-4 font-medium">Est. Cost</th>
                      <th className="py-2.5 pl-4 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {data.recent_conversations.map((conv) => (
                      <tr key={conv.conversation_id} className="hover:bg-bg-elevated/20 transition-colors">
                        <td className="py-3 pr-4 font-medium text-text-primary max-w-[200px] truncate">
                          <div>{conv.title}</div>
                          <div className="text-[10px] text-text-muted font-mono truncate">
                            {conv.conversation_id}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                              conv.status === "open"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : conv.status === "pending_human"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : "bg-bg-elevated text-text-muted border-border"
                            }`}
                          >
                            {conv.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-text-secondary">
                          {conv.total_tokens.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-text-primary">
                          ${conv.cost_usd.toFixed(4)}
                        </td>
                        <td className="py-3 pl-4 text-right">
                          <Link
                            href={`/dashboard/chat/${conv.conversation_id}`}
                            className="inline-flex items-center gap-1 text-accent hover:text-accent-hover text-xs font-medium"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
