"use client";

import { useEffect, useState } from "react";
import { GuardrailSummary, guardrailsApi } from "@/lib/api/guardrails";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  ShieldAlert,
  ShieldCheck,
  Plus,
  Check,
  X,
  Lock,
  Sparkles,
  KeyRound,
  Globe,
  FileCode,
  Pencil,
  ExternalLink,
  Flame,
  Binary,
  Layers,
  Code2,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

interface GuardrailSelectorProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  title?: string;
  description?: string;
  stageFilter?: "ingress" | "pre_tool" | "egress";
}

const typeIcons: Record<string, any> = {
  pii: Lock,
  keyword: KeyRound,
  regex: FileCode,
  structure: Layers,
  moderation: Flame,
  embedding: Binary,
  llm_judge: Sparkles,
  hallucination: CheckCircle2,
  json_schema: FileCode,
  code_sandbox: Code2,
  webhook: Globe,
};

export function GuardrailSelector({
  selectedIds,
  onChange,
  title = "Attach Reusable Guardrails",
  description = "Select safety and compliance policies from your library to attach to this node.",
  stageFilter,
}: GuardrailSelectorProps) {
  const [guardrails, setGuardrails] = useState<GuardrailSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchGuardrails = async () => {
      try {
        setIsLoading(true);
        const data = await guardrailsApi.list(stageFilter ? { stage: stageFilter } : undefined);
        setGuardrails(data);
      } catch (err) {
        console.error("Failed to load guardrails for selector:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchGuardrails();
  }, [stageFilter]);

  const toggleGuardrail = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="space-y-3 p-4 rounded-2xl bg-bg-surface border border-border/40">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-accent" />
            {title}
          </h4>
          <p className="text-[11px] text-text-secondary mt-0.5">{description}</p>
        </div>
        <Link href="/dashboard/guardrails/new" target="_blank">
          <Button variant="ghost" size="sm" type="button" className="text-[11px] h-7 gap-1 text-accent">
            <Plus className="w-3 h-3" /> New Policy
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="py-4 flex items-center justify-center gap-2">
          <Spinner size="sm" className="text-accent" />
          <span className="text-[11px] text-text-muted">Loading available policies...</span>
        </div>
      ) : guardrails.length === 0 ? (
        <div className="p-4 text-center rounded-xl bg-bg-base border border-dashed border-border/50">
          <p className="text-xs text-text-muted">No guardrails found in your library.</p>
          <Link href="/dashboard/guardrails/new" className="text-xs text-accent hover:underline mt-1 inline-block">
            Create your first guardrail &rarr;
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {guardrails.map((g) => {
            const isSelected = selectedIds.includes(g.id);
            const Icon = typeIcons[g.guardrail_type] || ShieldAlert;

            return (
              <div
                key={g.id}
                onClick={() => toggleGuardrail(g.id)}
                className={`group/item flex items-start justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                  isSelected
                    ? "bg-accent/10 border-accent/40 shadow-xs"
                    : "bg-bg-base border-border/40 hover:border-border/80"
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs ${
                      isSelected
                        ? "bg-accent text-white"
                        : "bg-bg-elevated text-text-secondary border border-border/40"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-text-primary block truncate">
                        {g.display_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-bg-elevated text-text-muted uppercase">
                        {g.stage}
                      </span>
                      <span className="text-[10px] text-text-muted capitalize">
                        {g.guardrail_type.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 ml-2">
                  <Link
                    href={`/dashboard/guardrails/${g.id}`}
                    target="_blank"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1 rounded-md text-text-muted hover:text-accent hover:bg-bg-elevated opacity-0 group-hover/item:opacity-100 transition-opacity"
                    title="Edit policy configuration (opens in new tab)"
                  >
                    <Pencil className="w-3 h-3" />
                  </Link>

                  <div
                    className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                      isSelected
                        ? "bg-accent border-accent text-white"
                        : "border-border/60 bg-bg-surface"
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
