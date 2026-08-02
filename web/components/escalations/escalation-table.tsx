"use client";

import { DataTable } from "@/components/data/data-table";
import { Escalation } from "@/lib/api/escalations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MessageSquare, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function EscalationTable({ 
  escalations, 
  isLoading,
  onResolve
}: { 
  escalations: Escalation[], 
  isLoading: boolean,
  onResolve: (id: string) => void
}) {
  return (
    <DataTable
      data={escalations}
      isLoading={isLoading}
      keyExtractor={(e) => e.id}
      columns={[
        {
          header: "Status",
          cell: (e) => (
            <Badge variant={e.status === 'pending' ? 'error' : 'success'}>
              {e.status}
            </Badge>
          )
        },
        {
          header: "Conversation",
          cell: (e) => <span className="font-medium text-[--text-primary]">{e.conversation_title}</span>
        },
        {
          header: "Reason",
          cell: (e) => <span className="text-[--text-secondary] text-sm line-clamp-2" title={e.reason}>{e.reason}</span>
        },
        {
          header: "Created",
          cell: (e) => <span className="text-[--text-secondary] text-sm">{formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}</span>
        },
        {
          header: "Actions",
          className: "text-right",
          cell: (e) => (
            <div className="flex justify-end gap-2">
              <Link href={`/dashboard/chat/${e.conversation_id}`}>
                <Button variant="outline" size="sm" className="gap-2 text-[--text-secondary]">
                  <MessageSquare className="w-4 h-4" /> View Chat
                </Button>
              </Link>
              {e.status === 'pending' && (
                <Button variant="default" size="sm" className="gap-2" onClick={() => onResolve(e.id)}>
                  <CheckCircle className="w-4 h-4" /> Resolve
                </Button>
              )}
            </div>
          )
        }
      ]}
      emptyTitle="No escalations"
      emptyDescription="Hooray! No pending escalations require your attention."
    />
  );
}
