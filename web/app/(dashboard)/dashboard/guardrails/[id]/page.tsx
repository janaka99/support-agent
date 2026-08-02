"use client";

import { useEffect, useState, use } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { GuardrailForm } from "@/components/guardrails/guardrail-form";
import { guardrailsApi, GuardrailResponse } from "@/lib/api/guardrails";
import { Spinner } from "@/components/ui/spinner";

export default function EditGuardrailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const [guardrail, setGuardrail] = useState<GuardrailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGuardrail = async () => {
      try {
        setIsLoading(true);
        const data = await guardrailsApi.get(resolvedParams.id);
        setGuardrail(data);
      } catch (err: any) {
        setError(err?.message || "Failed to load guardrail details.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchGuardrail();
  }, [resolvedParams.id]);

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" className="text-accent" />
        <p className="text-xs text-text-muted">Loading policy configuration...</p>
      </div>
    );
  }

  if (error || !guardrail) {
    return (
      <div className="p-8 text-center rounded-2xl bg-bg-surface border border-red-500/20 text-red-400">
        <p className="text-sm font-semibold">Error loading guardrail</p>
        <p className="text-xs text-text-muted mt-1">{error || "Guardrail not found"}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title={`Edit: ${guardrail.display_name}`}
        description={`Manage configuration, rules, and actions for ${guardrail.name}.`}
      />
      <GuardrailForm initialData={guardrail} isEditing={true} />
    </div>
  );
}
