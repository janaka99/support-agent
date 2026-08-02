"use client";

import { Tool } from "@/lib/api/tools";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Trash2, Edit3, Globe, Webhook, Code, Cpu } from "lucide-react";
import Link from "next/link";

interface ToolCardGridProps {
  tools: Tool[];
  isLoading: boolean;
  onTestTool: (tool: Tool) => void;
  onDeleteTool: (toolId: string) => void;
}

export function ToolCardGrid({
  tools,
  isLoading,
  onTestTool,
  onDeleteTool,
}: ToolCardGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-56 rounded-xl border border-border bg-bg-surface/50 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (tools.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-border bg-bg-surface/30">
        <div className="w-12 h-12 rounded-full bg-accent-muted flex items-center justify-center mb-4">
          <Code className="w-6 h-6 text-accent" />
        </div>
        <h3 className="text-base font-semibold text-text-primary">No tools created yet</h3>
        <p className="text-sm text-text-muted mt-1 max-w-md">
          Create reusable HTTP REST APIs, webhooks, or Python tools that can be dynamically bound to any specialist agent.
        </p>
        <Link href="/dashboard/tools/new" className="mt-5">
          <Button className="btn-primary">Create Your First Tool</Button>
        </Link>
      </div>
    );
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "http_request":
        return <Globe className="w-4 h-4 text-blue-400" />;
      case "webhook":
        return <Webhook className="w-4 h-4 text-purple-400" />;
      case "code_sandbox":
        return <Code className="w-4 h-4 text-emerald-400" />;
      default:
        return <Cpu className="w-4 h-4 text-amber-400" />;
    }
  };

  const getMethodColor = (method?: string) => {
    const m = (method || "GET").toUpperCase();
    switch (m) {
      case "GET":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "POST":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "PUT":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "DELETE":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      default:
        return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {tools.map((tool) => {
        const paramKeys = Object.keys(
          tool.parameters_schema?.properties || {}
        );
        const method = tool.config?.method || "GET";
        const url = tool.config?.url;

        return (
          <div
            key={tool.id}
            className="flex flex-col justify-between rounded-xl border border-border bg-bg-surface hover:border-border-strong transition-all duration-200 p-5 group shadow-sm hover:shadow-md"
          >
            <div>
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-lg bg-bg-elevated border border-border shrink-0">
                    {getTypeIcon(tool.tool_type)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-text-primary truncate">
                      {tool.display_name || tool.name}
                    </h3>
                    <p className="mono text-[11px] text-text-muted truncate">
                      {tool.name}
                    </p>
                  </div>
                </div>

                <Badge variant="muted" className="text-[11px] capitalize shrink-0">
                  {tool.tool_type.replace("_", " ")}
                </Badge>
              </div>

              {/* Description */}
              <p className="text-xs text-text-secondary mt-3 line-clamp-2 leading-relaxed">
                {tool.description || "No description provided."}
              </p>

              {/* Target Endpoint / Method */}
              {url && (
                <div className="mt-3.5 p-2 rounded-md bg-bg-base border border-border/80 flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border ${getMethodColor(
                      method
                    )}`}
                  >
                    {method}
                  </span>
                  <span className="mono text-[11px] text-text-muted truncate flex-1">
                    {url}
                  </span>
                </div>
              )}

              {/* Schema Parameters */}
              <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-text-muted mr-1 font-medium">
                  Inputs:
                </span>
                {paramKeys.length > 0 ? (
                  paramKeys.map((k) => (
                    <span
                      key={k}
                      className="mono text-[10px] px-2 py-0.5 rounded-full bg-bg-elevated text-text-secondary border border-border"
                    >
                      ${k}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-text-muted italic">none</span>
                )}
              </div>
            </div>

            {/* Footer / Actions */}
            <div className="mt-5 pt-3.5 border-t border-border flex items-center justify-between">
              <span className="text-[11px] text-text-muted">
                Used by <span className="font-semibold text-text-primary">{tool.agents_count ?? 0}</span> agents
              </span>

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onTestTool(tool)}
                  className="h-7 px-2.5 text-xs gap-1.5 text-accent hover:text-accent hover:bg-accent-muted border-border"
                  title="Run Live Test Sandbox"
                >
                  <Play className="w-3 h-3 fill-accent" />
                  <span>Test</span>
                </Button>

                <Link href={`/dashboard/tools/${tool.id}`}>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-text-muted hover:text-text-primary"
                    title="Edit Tool"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </Button>
                </Link>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDeleteTool(tool.id)}
                  className="h-7 w-7 p-0 text-text-muted hover:text-rose-400"
                  title="Delete Tool"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
