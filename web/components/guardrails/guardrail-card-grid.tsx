"use client";

import { useState, useMemo } from "react";
import { GuardrailSummary, GuardrailStage, GuardrailType } from "@/lib/api/guardrails";
import { GuardrailCard } from "./guardrail-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Search, ShieldAlert, Plus, Filter } from "lucide-react";
import Link from "next/link";

interface GuardrailCardGridProps {
  guardrails: GuardrailSummary[];
  isLoading: boolean;
  onTestGuardrail: (guardrail: GuardrailSummary) => void;
  onDeleteGuardrail: (id: string) => void;
}

export function GuardrailCardGrid({
  guardrails,
  isLoading,
  onTestGuardrail,
  onDeleteGuardrail,
}: GuardrailCardGridProps) {
  const [search, setSearch] = useState("");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");

  const filteredGuardrails = useMemo(() => {
    return guardrails.filter((g) => {
      const matchesSearch =
        g.display_name.toLowerCase().includes(search.toLowerCase()) ||
        g.name.toLowerCase().includes(search.toLowerCase()) ||
        (g.description && g.description.toLowerCase().includes(search.toLowerCase()));

      const matchesStage =
        selectedStage === "all" || g.stage === selectedStage;

      const matchesType =
        selectedType === "all" || g.guardrail_type === selectedType;

      return matchesSearch && matchesStage && matchesType;
    });
  }, [guardrails, search, selectedStage, selectedType]);

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" className="text-accent" />
        <p className="text-xs text-text-muted">Loading guardrails library...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-bg-surface p-3.5 rounded-2xl border border-border/40">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Search guardrails by name, rule, or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs bg-bg-base border-border/40"
          />
        </div>

        {/* Stage Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "all", label: "All Stages" },
            { id: "ingress", label: "Ingress (Perimeter)" },
            { id: "pre_tool", label: "Pre-Tool (Execution)" },
            { id: "egress", label: "Egress (Output)" },
          ].map((stage) => (
            <button
              key={stage.id}
              onClick={() => setSelectedStage(stage.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                selectedStage === stage.id
                  ? "bg-accent text-white shadow-sm font-semibold"
                  : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
              }`}
            >
              {stage.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Content */}
      {filteredGuardrails.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-bg-surface border border-dashed border-border/60 flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent mb-3">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h4 className="text-base font-semibold text-text-primary mb-1">
            No guardrails found
          </h4>
          <p className="text-xs text-text-secondary max-w-sm mb-4">
            {search || selectedStage !== "all"
              ? "No guardrails matched your filter criteria. Try clearing search filters."
              : "Protect your AI touchpoints by creating reusable deterministic or semantic guardrails."}
          </p>
          <Link href="/dashboard/guardrails/new">
            <Button size="sm" className="btn-primary gap-1.5 text-xs">
              <Plus className="w-3.5 h-3.5" />
              Create First Guardrail
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGuardrails.map((guardrail) => (
            <GuardrailCard
              key={guardrail.id}
              guardrail={guardrail}
              onTest={onTestGuardrail}
              onDelete={onDeleteGuardrail}
            />
          ))}
        </div>
      )}
    </div>
  );
}
