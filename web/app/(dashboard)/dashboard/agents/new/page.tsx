import { PageHeader } from "@/components/layout/page-header";
import { AgentForm } from "@/components/agents/agent-form";

export default function NewAgentPage() {
  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
      <PageHeader 
        title="Create New Agent" 
        description="Configure a new AI support agent for your team."
      />
      <AgentForm />
    </div>
  );
}
