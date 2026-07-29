"use client";

import { DataTable } from "@/components/data/data-table";
import { OrgMember, orgApi } from "@/lib/api/org";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/auth";

interface TeamTableProps {
  users: OrgMember[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function TeamTable({ users, isLoading, onRefresh }: TeamTableProps) {
  const { user: currentUser } = useAuth();

  const handleRemove = async (id: string) => {
    if (!confirm("Are you sure you want to remove this team member?")) return;
    try {
      await orgApi.removeMember(id);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert("Failed to remove member");
    }
  };

  return (
    <DataTable
      data={users}
      isLoading={isLoading}
      keyExtractor={(u) => u.id}
      columns={[
        {
          header: "Email",
          accessorKey: "email",
          className: "font-medium"
        },
        {
          header: "Role",
          cell: (u) => <span className="text-[--text-muted] capitalize">{u.role}</span>
        },
        {
          header: "Status",
          cell: (u) => (
            <Badge variant={u.is_active ? "success" : "muted"}>
              {u.is_active ? "Active" : "Inactive"}
            </Badge>
          )
        },
        {
          header: "Actions",
          className: "text-right",
          cell: (u) => {
            if (u.id === currentUser?.id) return null; // Can't remove yourself
            return (
              <div className="flex justify-end">
                <Button 
                  variant="ghost" 
                  className="h-8 w-8 p-0 text-[--text-muted] hover:text-[--error] hover:bg-red-500/10" 
                  title="Remove Member"
                  onClick={() => handleRemove(u.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          }
        }
      ]}
      emptyTitle="No team members"
      emptyDescription="Invite your first team member to collaborate."
    />
  );
}
