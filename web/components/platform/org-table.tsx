"use client";

import { DataTable } from "@/components/data/data-table";
import { OrgSummary } from "@/lib/api/platform";
import { Badge } from "@/components/ui/badge";

export function OrgTable({ orgs, isLoading }: { orgs: OrgSummary[], isLoading: boolean }) {
  return (
    <DataTable
      data={orgs}
      isLoading={isLoading}
      keyExtractor={(o) => o.id}
      columns={[
        {
          header: "Organization",
          accessorKey: "name",
          className: "font-medium"
        },
        {
          header: "Members",
          cell: (o) => <span className="text-[--text-muted]">{o.member_count}</span>
        },
        {
          header: "Agents",
          cell: (o) => <span className="text-[--text-muted]">{o.agent_count}</span>
        },
        {
          header: "Status",
          cell: () => <Badge variant="success">Active</Badge>
        }
      ]}
      emptyTitle="No organizations found"
      emptyDescription="Provision your first tenant to get started."
    />
  );
}
