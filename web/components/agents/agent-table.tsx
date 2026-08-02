"use client";

import { DataTable } from "@/components/data/data-table";
import { Agent } from "@/lib/api/agents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Edit2, Bot as BotIcon, Wrench } from "lucide-react";

export function AgentTable({
  agents,
  isLoading,
}: {
  agents: Agent[];
  isLoading: boolean;
}) {
  return (
    <DataTable
      data={agents}
      isLoading={isLoading}
      keyExtractor={(a) => a.id}
      columns={[
        {
          header: "Specialist Name",
          accessorKey: "name",
          className: "font-semibold text-text-primary",
        },
        {
          header: "Specialization",
          cell: (a) => (
            <span className="mono text-xs text-text-secondary">
              {a.specialization}
            </span>
          ),
        },
        {
          header: "Assigned Tools",
          cell: (a) => (
            <div className="flex items-center gap-1.5 flex-wrap">
              {a.assigned_tools && a.assigned_tools.length > 0 ? (
                a.assigned_tools.slice(0, 3).map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-1 mono text-[10px] px-2 py-0.5 rounded-md bg-bg-elevated text-text-secondary border border-border"
                  >
                    <Wrench className="w-2.5 h-2.5 text-accent" />
                    {t.display_name || t.name}
                  </span>
                ))
              ) : (
                <span className="text-xs text-text-muted italic">No tools</span>
              )}
              {a.assigned_tools && a.assigned_tools.length > 3 && (
                <span className="text-[10px] text-text-muted">
                  +{a.assigned_tools.length - 3} more
                </span>
              )}
            </div>
          ),
        },
        {
          header: "Shared Across Bots",
          cell: (a) => (
            <div className="flex items-center gap-1.5 flex-wrap">
              {a.linked_bot_names && a.linked_bot_names.length > 0 ? (
                a.linked_bot_names.map((bName, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-accent-muted text-accent border border-accent/20 font-medium"
                  >
                    <BotIcon className="w-2.5 h-2.5" />
                    {bName}
                  </span>
                ))
              ) : (
                <span className="text-xs text-text-muted italic">Standalone</span>
              )}
            </div>
          ),
        },
        {
          header: "Model",
          cell: (a) => (
            <Badge variant="muted" className="mono text-[10px]">
              {a.model}
            </Badge>
          ),
        },
        {
          header: "Actions",
          className: "text-right",
          cell: (a) => (
            <div className="flex justify-end">
              <Link href={`/dashboard/agents/${a.id}`}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-text-muted hover:text-text-primary"
                  title="Edit Agent & Tools"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          ),
        },
      ]}
      emptyTitle="No specialist agents found"
      emptyDescription="Create your first AI support agent to get started."
    />
  );
}
