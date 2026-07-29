"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { AgentForm } from "@/components/agents/agent-form";
import { agentsApi, Agent } from "@/lib/api/agents";
import { Spinner } from "@/components/ui/spinner";
import { useParams } from "next/navigation";

export default function EditAgentPage() {
  const params = useParams();
  const id = params.id as string;
  const [agent, setAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    agentsApi.get(id)
      .then(setAgent)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Spinner className="text-[--accent]" />
      </div>
    );
  }

  if (!agent) {
    return <div>Agent not found</div>;
  }

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
      <PageHeader 
        title="Edit Agent" 
        description={`Configure settings for ${agent.name}.`}
      />
      <AgentForm initialData={agent} />
    </div>
  );
}
