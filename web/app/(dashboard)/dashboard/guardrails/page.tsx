"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, ShieldAlert } from "lucide-react";
import { GuardrailCardGrid } from "@/components/guardrails/guardrail-card-grid";
import { GuardrailTestModal } from "@/components/guardrails/guardrail-test-modal";
import { guardrailsApi, GuardrailSummary } from "@/lib/api/guardrails";
import Link from "next/link";

export default function GuardrailsLibraryPage() {
  const [guardrails, setGuardrails] = useState<GuardrailSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedForTest, setSelectedForTest] = useState<GuardrailSummary | null>(null);

  const fetchGuardrails = async () => {
    try {
      setIsLoading(true);
      const data = await guardrailsApi.list();
      setGuardrails(data);
    } catch (err) {
      console.error("Failed to load guardrails library:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGuardrails();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this guardrail policy? It will be unlinked from all bots and specialist agents.")) {
      return;
    }
    try {
      await guardrailsApi.delete(id);
      setGuardrails((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      alert("Failed to delete guardrail.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Guardrails Library"
        description="Design and manage reusable security policies, PII redactors, budget caps, and AI safety judges across your support agents."
        action={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchGuardrails}
              disabled={isLoading}
              className="gap-2 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            <Link href="/dashboard/guardrails/new">
              <Button className="btn-primary gap-2 text-xs">
                <Plus className="w-4 h-4" /> Create Guardrail Policy
              </Button>
            </Link>
          </div>
        }
      />

      <GuardrailCardGrid
        guardrails={guardrails}
        isLoading={isLoading}
        onTestGuardrail={(g) => setSelectedForTest(g)}
        onDeleteGuardrail={handleDelete}
      />

      {/* Interactive Sandbox Test Modal */}
      <GuardrailTestModal
        guardrail={selectedForTest}
        isOpen={!!selectedForTest}
        onClose={() => setSelectedForTest(null)}
      />
    </div>
  );
}
