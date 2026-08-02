"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { EscalationTable } from "@/components/escalations/escalation-table";
import { escalationsApi, Escalation } from "@/lib/api/escalations";

export default function EscalationsPage() {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEscalations = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await escalationsApi.list();
      setEscalations(data);
    } catch (err) {
      console.error("Failed to fetch escalations:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEscalations();
  }, [fetchEscalations]);

  const handleResolve = async (id: string) => {
    try {
      await escalationsApi.resolve(id);
      // Refresh list
      await fetchEscalations();
    } catch (err) {
      console.error("Failed to resolve escalation:", err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
      <PageHeader 
        title="Escalations" 
        description="View and resolve conversations escalated by AI agents."
      />
      <EscalationTable 
        escalations={escalations} 
        isLoading={isLoading} 
        onResolve={handleResolve} 
      />
    </div>
  );
}
