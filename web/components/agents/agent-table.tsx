"use client";

import { DataTable } from "@/components/data/data-table";
import { Agent } from "@/lib/api/agents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Edit2 } from "lucide-react";

export function AgentTable({ agents, isLoading }: { agents: Agent[], isLoading: boolean }) {
  return (
    <DataTable
      data={agents}
      isLoading={isLoading}
      keyExtractor={(a) => a.id}
      columns={[
        {
          header: "Name",
          accessorKey: "name",
          className: "font-medium"
        },
        {
          header: "Specialization",
          cell: (a) => <span className="text-[--text-muted]">{a.specialization}</span>
        },
        {
          header: "Model",
          cell: (a) => <Badge variant="accent">{a.model}</Badge>
        },
        {
          header: "Actions",
          className: "text-right",
          cell: (a) => (
            <div className="flex justify-end">
              <Link href={`/dashboard/agents/${a.id}`}>
                <Button variant="ghost" className="h-8 w-8 p-0" title="Edit Agent">
                  <Edit2 className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          )
        }
      ]}
      emptyTitle="No agents found"
      emptyDescription="Create your first AI support agent to get started."
    />
  );
}
