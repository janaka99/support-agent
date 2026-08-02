"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ToolForm } from "@/components/tools/tool-form";
import { toolsApi, Tool } from "@/lib/api/tools";
import { Spinner } from "@/components/ui/spinner";

export default function EditToolPage() {
  const params = useParams();
  const toolId = params.id as string;
  const [tool, setTool] = useState<Tool | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadTool() {
      try {
        const data = await toolsApi.get(toolId);
        setTool(data);
      } catch (err) {
        console.error("Failed to load tool:", err);
      } finally {
        setIsLoading(false);
      }
    }
    if (toolId) loadTool();
  }, [toolId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-24">
        <Spinner size="lg" className="text-accent" />
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="p-8 text-center text-text-muted">
        Tool not found.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title={`Edit Tool: ${tool.display_name || tool.name}`}
        description="Update endpoint configuration, JSON schema, or prompt description."
      />
      <ToolForm initialTool={tool} isEditing />
    </div>
  );
}
