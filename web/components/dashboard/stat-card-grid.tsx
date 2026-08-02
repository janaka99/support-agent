"use client";

import { StatCard } from "@/components/data/stat-card";
import { Bot, Users, MessageSquare, DollarSign, TrendingDown } from "lucide-react";
import { useEffect, useState } from "react";
import { agentsApi } from "@/lib/api/agents";
import { orgApi } from "@/lib/api/org";
import { analyticsApi, AnalyticsOverview } from "@/lib/api/analytics";

export function StatCardGrid() {
  const [agentCount, setAgentCount] = useState<number | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);

  useEffect(() => {
    agentsApi.list().then((data) => setAgentCount(data.length)).catch(console.error);
    orgApi.listMembers().then((data) => setMemberCount(data.length)).catch(console.error);
    analyticsApi.getOverview().then(setAnalytics).catch(console.error);
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard 
        title="Active Agents" 
        value={agentCount === null ? "-" : agentCount} 
        icon={<Bot className="w-5 h-5" />} 
      />
      <StatCard 
        title="Total Conversations" 
        value={analytics ? analytics.total_conversations : "-"} 
        icon={<MessageSquare className="w-5 h-5" />} 
      />
      <StatCard 
        title="Total LLM Spend" 
        value={
          analytics
            ? `$${analytics.total_cost_usd < 0.01 && analytics.total_cost_usd > 0 ? analytics.total_cost_usd.toFixed(4) : analytics.total_cost_usd.toFixed(3)}`
            : "-"
        } 
        icon={<DollarSign className="w-5 h-5" />} 
      />
      <StatCard 
        title="Avg Cost / Ticket" 
        value={
          analytics
            ? `$${analytics.avg_cost_per_conversation < 0.01 && analytics.avg_cost_per_conversation > 0 ? analytics.avg_cost_per_conversation.toFixed(4) : analytics.avg_cost_per_conversation.toFixed(3)}`
            : "-"
        } 
        icon={<TrendingDown className="w-5 h-5" />} 
      />
    </div>
  );
}
