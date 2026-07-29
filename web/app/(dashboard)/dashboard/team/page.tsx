"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { TeamTable } from "@/components/team/team-table";
import { InviteMemberDialog } from "@/components/team/invite-member-dialog";
import { orgApi, OrgMember } from "@/lib/api/org";

export default function TeamPage() {
  const [users, setUsers] = useState<OrgMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const data = await orgApi.listMembers();
      setUsers(data);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
      <PageHeader 
        title="Team Members" 
        description="Manage access and permissions for your organization."
        action={
          <Button onClick={() => setIsInviteOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Invite Member
          </Button>
        }
      />
      
      <TeamTable users={users} isLoading={isLoading} onRefresh={fetchUsers} />
      
      <InviteMemberDialog 
        isOpen={isInviteOpen} 
        onClose={() => setIsInviteOpen(false)} 
        onSuccess={fetchUsers}
      />
    </div>
  );
}
