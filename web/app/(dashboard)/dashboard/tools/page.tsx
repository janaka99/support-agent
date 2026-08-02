"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Plus, Wrench, RefreshCw } from "lucide-react";
import { ToolCardGrid } from "@/components/tools/tool-card-grid";
import { TestToolModal } from "@/components/tools/test-tool-modal";
import { toolsApi, Tool } from "@/lib/api/tools";
import Link from "next/link";

export default function ToolsHubPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedToolForTest, setSelectedToolForTest] = useState<Tool | null>(null);

  const fetchTools = async () => {
    try {
      setIsLoading(true);
      const data = await toolsApi.list();
      setTools(data);
    } catch (err) {
      console.error("Failed to fetch tools:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTools();
  }, []);

  const handleDeleteTool = async (toolId: string) => {
    if (!confirm("Are you sure you want to delete this tool? Any agent referencing it will lose access.")) {
      return;
    }
    try {
      await toolsApi.delete(toolId);
      setTools((prev) => prev.filter((t) => t.id !== toolId));
    } catch (err) {
      alert("Failed to delete tool.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Tools Hub"
        description="Build and manage reusable REST APIs, webhooks, and sandboxes that can be bound to any specialist agent."
        action={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchTools}
              disabled={isLoading}
              className="gap-2 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            <Link href="/dashboard/tools/new">
              <Button className="btn-primary gap-2 text-xs">
                <Plus className="w-4 h-4" /> Create Custom Tool
              </Button>
            </Link>
          </div>
        }
      />

      <ToolCardGrid
        tools={tools}
        isLoading={isLoading}
        onTestTool={(tool) => setSelectedToolForTest(tool)}
        onDeleteTool={handleDeleteTool}
      />

      {/* Live Test Sandbox Modal */}
      <TestToolModal
        tool={selectedToolForTest}
        isOpen={!!selectedToolForTest}
        onClose={() => setSelectedToolForTest(null)}
      />
    </div>
  );
}
