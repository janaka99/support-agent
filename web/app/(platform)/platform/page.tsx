"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { OrgTable } from "@/components/platform/org-table";
import { ProvisionOrgDialog } from "@/components/platform/provision-org-dialog";
import { platformApi, OrgSummary } from "@/lib/api/platform";

export default function PlatformPage() {
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProvisionOpen, setIsProvisionOpen] = useState(false);

  const fetchOrgs = async () => {
    try {
      setIsLoading(true);
      const data = await platformApi.getOrgs();
      setOrgs(data);
    } catch (err) {
      console.error("Failed to fetch orgs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
      <PageHeader 
        title="Organizations" 
        description="Manage tenants and platform-wide metrics."
        action={
          <Button onClick={() => setIsProvisionOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Provision Org
          </Button>
        }
      />
      
      <OrgTable orgs={orgs} isLoading={isLoading} />
      
      <ProvisionOrgDialog 
        isOpen={isProvisionOpen} 
        onClose={() => setIsProvisionOpen(false)} 
        onSuccess={fetchOrgs}
      />
    </div>
  );
}
