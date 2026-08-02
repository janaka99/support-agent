"use client";

import { GuardrailSummary } from "@/lib/api/guardrails";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShieldAlert,
  ShieldCheck,
  Play,
  Pencil,
  Trash2,
  Lock,
  Sparkles,
  KeyRound,
  FileCode,
  Globe,
  Bot,
  Cpu,
  Flame,
  Binary,
  Layers,
  Code2,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

interface GuardrailCardProps {
  guardrail: GuardrailSummary;
  onTest: (guardrail: GuardrailSummary) => void;
  onDelete: (id: string) => void;
  onToggleActive?: (id: string, active: boolean) => void;
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

const stageColors: Record<string, string> = {
  ingress: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  pre_tool: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  egress: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

export function GuardrailCard({
  guardrail,
  onTest,
  onDelete,
  onToggleActive,
}: GuardrailCardProps) {
  const Icon = typeIcons[guardrail.guardrail_type] || ShieldAlert;

  return (
    <div className="group relative flex flex-col justify-between p-5 rounded-2xl bg-bg-surface border border-border/40 hover:border-accent/40 shadow-sm hover:shadow-md transition-all duration-200">
      <div>
        {/* Header Badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                stageColors[guardrail.stage] || "bg-bg-elevated text-text-secondary"
              }`}
            >
              Stage: {guardrail.stage.toUpperCase()}
            </span>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-bg-elevated text-text-secondary border border-border/40 capitalize">
              {guardrail.guardrail_type.replace("_", " ")}
            </span>
          </div>

          <Badge
            variant={guardrail.is_active ? "success" : "muted"}
            className="text-[10px] uppercase font-semibold tracking-wider"
          >
            {guardrail.is_active ? "Active" : "Disabled"}
          </Badge>
        </div>

        {/* Title & Icon (Clickable to Edit) */}
        <Link
          href={`/dashboard/guardrails/${guardrail.id}`}
          className="flex items-start gap-3 mb-2 group/title"
        >
          <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0 group-hover/title:bg-accent group-hover/title:text-white transition-colors">
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-text-primary text-base leading-tight group-hover/title:text-accent transition-colors flex items-center gap-1.5 truncate">
              <span>{guardrail.display_name}</span>
            </h3>
            <span className="text-xs text-text-muted font-mono">{guardrail.name}</span>
          </div>
        </Link>

        {/* Description */}
        <p className="text-xs text-text-secondary line-clamp-2 mt-2">
          {guardrail.description || "No description provided."}
        </p>

        {/* Action on Violation Badge */}
        <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
          <span className="font-medium text-text-secondary">On Violation:</span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-bg-base border border-border/30 text-text-primary">
            {guardrail.action_on_violation === "escalate_to_human"
              ? "Human Escalation"
              : "Block & Refuse"}
          </span>
        </div>

        {/* Association Counts */}
        <div className="mt-3 pt-3 border-t border-border/30 flex items-center gap-4 text-xs text-text-muted">
          <div className="flex items-center gap-1.5" title="Attached to Bots">
            <Bot className="w-3.5 h-3.5 text-accent" />
            <span>{guardrail.linked_bots_count ?? 0} Bots</span>
          </div>
          <div className="flex items-center gap-1.5" title="Attached to Specialists">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span>{guardrail.linked_agents_count ?? 0} Agents</span>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="mt-5 pt-3 border-t border-border/30 flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onTest(guardrail)}
          className="gap-1.5 text-xs h-8 text-text-secondary hover:text-accent"
        >
          <Play className="w-3 h-3 fill-current" />
          Test Sandbox
        </Button>

        <div className="flex items-center gap-1.5">
          <Link href={`/dashboard/guardrails/${guardrail.id}`}>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-xs h-8 text-text-primary hover:text-accent hover:border-accent"
            >
              <Pencil className="w-3 h-3" />
              <span>Edit Policy</span>
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(guardrail.id)}
            className="h-8 w-8 p-0 text-red-400/70 hover:text-red-400 hover:bg-red-500/10"
            title="Delete Guardrail"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
