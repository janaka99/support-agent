"use client";

import { DataTable, RowAction } from "@/components/data/data-table";
import { OrgSummary, platformApi } from "@/lib/api/platform";
import { Badge } from "@/components/ui/badge";
import { Eye, Ban, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "../ui/confirm-dialog";

export function OrgTable({
  orgs,
  isLoading,
}: {
  orgs: OrgSummary[];
  isLoading: boolean;
}) {
  const [deleteTarget, setDeleteTarget] = useState<OrgSummary | null>(null);

  const rowActions = (org: OrgSummary): RowAction<OrgSummary>[] => [
    {
      label: "View details",
      icon: Eye,
      onClick: (o) => {
        // TODO: wire to your org detail route, e.g. router.push(`/platform/${o.id}`)
        console.log("View org", o.id);
      },
    },
    {
      label: "Suspend organization",
      icon: Ban,
      onClick: (o) => {
        // TODO: wire to platformApi.suspendOrg(o.id)
        console.log("Suspend org", o.id);
      },
    },
    { isSeparator: true },
    {
      label: "Delete organization",
      icon: Trash2,
      destructive: true,
      onClick: (o) => setDeleteTarget(o),
    },
  ];

  return (
    <>
      <DataTable
        data={orgs}
        isLoading={isLoading}
        keyExtractor={(o) => o.id}
        pageSize={10}
        actions={rowActions}
        columns={[
          {
            header: "Organization",
            accessorKey: "name",
            className: "font-medium",
          },
          {
            header: "Members",
            cell: (o) => (
              <span className="text-text-secondary">{o.member_count}</span>
            ),
          },
          {
            header: "Agents",
            cell: (o) => (
              <span className="text-text-secondary">{o.agent_count}</span>
            ),
          },
          {
            header: "Status",
            cell: () => <Badge variant="success">Active</Badge>,
          },
        ]}
        emptyTitle="No organizations found"
        emptyDescription="Provision your first tenant to get started."
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name}?`}
        description="This can't be undone. All members and agent data for this organization will be permanently removed."
        confirmText="Delete organization"
        variant="destructive"
        onConfirm={async () => {
          await platformApi.deleteOrg(deleteTarget!.id);
          platformApi.getOrgs();
        }}
      />
    </>
  );
}
