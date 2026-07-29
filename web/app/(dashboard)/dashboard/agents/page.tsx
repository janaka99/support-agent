"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AgentTable } from "@/components/agents/agent-table";
import { agentsApi, Agent } from "@/lib/api/agents";
import Link from "next/link";

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAgents = async () => {
    try {
      setIsLoading(true);
      const data = await agentsApi.list();
      setAgents(data);
    } catch (err) {
      console.error("Failed to fetch agents:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
      <PageHeader 
        title="Support Agents" 
        description="Manage your AI agents, their prompts, and capabilities."
        action={
          <Link href="/dashboard/agents/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Create Agent
            </Button>
          </Link>
        }
      />
      <AgentTable agents={agents} isLoading={isLoading} />
    </div>
  );
}
