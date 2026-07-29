"use client";

import { StatCard } from "@/components/data/stat-card";
import { Bot, Users, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { agentsApi } from "@/lib/api/agents";
import { orgApi } from "@/lib/api/org";

export function StatCardGrid() {
  const [agentCount, setAgentCount] = useState<number | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);

  useEffect(() => {
    agentsApi.list().then(data => setAgentCount(data.length)).catch(console.error);
    orgApi.listMembers().then(data => setMemberCount(data.length)).catch(console.error);
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <StatCard 
        title="Active Agents" 
        value={agentCount === null ? "-" : agentCount} 
        icon={<Bot className="w-5 h-5" />} 
      />
      <StatCard 
        title="Team Members" 
        value={memberCount === null ? "-" : memberCount} 
        icon={<Users className="w-5 h-5" />} 
      />
      <StatCard 
        title="Conversations Today" 
        value="-" 
        icon={<MessageSquare className="w-5 h-5" />} 
      />
    </div>
  );
}
