"use client";

import { PageHeader } from "@/components/layout/page-header";
import { ToolForm } from "@/components/tools/tool-form";

export default function NewToolPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Create Custom Tool"
        description="Configure a new REST API endpoint, webhook, or sandboxed execution script for your specialist agents."
      />
      <ToolForm />
    </div>
  );
}
