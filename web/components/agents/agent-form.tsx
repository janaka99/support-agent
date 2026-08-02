"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Agent, AgentCreate, agentsApi } from "@/lib/api/agents";
import { Tool, toolsApi } from "@/lib/api/tools";
import { GuardrailConfig, defaultGuardrails } from "@/lib/api/guardrails";
import { GuardrailEditor } from "@/components/guardrails/guardrail-editor";
import { GuardrailSelector } from "@/components/guardrails/guardrail-selector";
import { useRouter } from "next/navigation";
import { Wrench, BookOpen, CheckCircle, Sparkles, Globe, Webhook, Code, Cpu, ArrowLeft, Save, Plus, Shield } from "lucide-react";
import Link from "next/link";

interface Props {
  initialData?: Agent;
}

export function AgentForm({ initialData }: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState(initialData?.name || "");
  const [specialization, setSpecialization] = useState(initialData?.specialization || "");
  const [model, setModel] = useState(initialData?.model || "gpt-4o-mini");
  const [temperature, setTemperature] = useState<number>(initialData?.temperature ?? 0.2);
  const [systemPrompt, setSystemPrompt] = useState(initialData?.system_prompt || "");

  // Guardrails State
  const [guardrails, setGuardrails] = useState<GuardrailConfig | undefined>(() => {
    if (!initialData?.guardrails) return undefined;
    if (Array.isArray(initialData.guardrails)) {
      return {
        ...defaultGuardrails,
        custom_rules: initialData.guardrails,
      };
    }
    return initialData.guardrails as GuardrailConfig;
  });

  const [selectedGuardrailIds, setSelectedGuardrailIds] = useState<string[]>(
    initialData?.assigned_guardrails?.map((g) => g.id) || []
  );

  // Available Tools state
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [isLoadingTools, setIsLoadingTools] = useState(true);
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>(() => {
    if (initialData?.assigned_tools) {
      return initialData.assigned_tools.map((t) => t.id);
    }
    return [];
  });

  // Knowledge base state
  const [kbContent, setKbContent] = useState("");
  const [isUploadingKb, setIsUploadingKb] = useState(false);
  const [kbSuccess, setKbSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function loadTools() {
      try {
        setIsLoadingTools(true);
        const data = await toolsApi.list();
        setAvailableTools(data);

        // Fallback match for legacy tool names
        if (initialData && (!initialData.assigned_tools || initialData.assigned_tools.length === 0)) {
          const matchedIds: string[] = [];
          if (initialData.tools) {
            data.forEach((t) => {
              if (initialData.tools?.includes(t.name)) {
                matchedIds.push(t.id);
              }
            });
          }
          if (matchedIds.length > 0) {
            setSelectedToolIds(matchedIds);
          }
        }
      } catch (err) {
        console.error("Failed to load tools:", err);
      } finally {
        setIsLoadingTools(false);
      }
    }
    loadTools();
  }, [initialData]);

  const toggleTool = (toolId: string) => {
    setSelectedToolIds((prev) =>
      prev.includes(toolId) ? prev.filter((id) => id !== toolId) : [...prev, toolId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (!name.trim()) throw new Error("Agent name is required.");
      if (!specialization.trim()) throw new Error("Specialization trigger is required.");
      if (systemPrompt.trim().length < 10) throw new Error("System prompt must be at least 10 characters.");

      const payload: AgentCreate = {
        name: name.trim(),
        specialization: specialization.trim(),
        system_prompt: systemPrompt.trim(),
        model,
        temperature,
        guardrails: guardrails,
        tool_ids: selectedToolIds,
        guardrail_ids: selectedGuardrailIds,
      };

      if (initialData) {
        await agentsApi.update(initialData.id, payload);
      } else {
        await agentsApi.create(payload);
      }

      router.push("/dashboard/agents");
      router.refresh();
    } catch (err: any) {
      setSubmitError(err.message || "Failed to save agent");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadKb = async () => {
    if (!initialData?.id || !kbContent.trim()) return;
    setIsUploadingKb(true);
    setKbSuccess(null);
    try {
      const res = await agentsApi.uploadDocument(initialData.id, kbContent);
      setKbSuccess(`Successfully indexed ${res.chunks_indexed} document chunks.`);
      setKbContent("");
    } catch (err: any) {
      setSubmitError(err.message || "Failed to upload document");
    } finally {
      setIsUploadingKb(false);
    }
  };

  const getToolIcon = (toolType: string) => {
    switch (toolType) {
      case "http_request":
        return <Globe className="w-4 h-4 text-blue-400" />;
      case "webhook":
        return <Webhook className="w-4 h-4 text-purple-400" />;
      case "code_sandbox":
        return <Code className="w-4 h-4 text-emerald-400" />;
      default:
        return <Cpu className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <div className="space-y-8 max-w-4xl pb-12">
      <form onSubmit={handleSubmit} className="space-y-8">
        {submitError && (
          <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {submitError}
          </div>
        )}

        {/* 1. Agent Persona Details */}
        <div className="p-6 rounded-xl border border-border bg-bg-surface space-y-5">
          <h3 className="text-sm font-semibold text-text-primary">Specialist Persona</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs text-text-secondary">
                Agent Name
              </Label>
              <Input
                id="name"
                placeholder="e.g. Order Tracking Specialist"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-bg-base border-border text-xs h-9"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="specialization" className="text-xs text-text-secondary">
                Specialization Trigger
              </Label>
              <Input
                id="specialization"
                placeholder="e.g. shipping, order tracking, carrier delivery"
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                className="bg-bg-base border-border text-xs h-9 font-mono"
                required
              />
              <p className="text-[11px] text-text-muted">
                Keywords used by the Bot Supervisor to route customer queries.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="model" className="text-xs text-text-secondary">
                LLM Model
              </Label>
              <select
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full h-9 rounded-md bg-bg-base border border-border px-3 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="gpt-4o-mini">GPT-4o Mini (Fast & Cost Efficient)</option>
                <option value="gpt-4o">GPT-4o (High Reasoning)</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="temperature" className="text-xs text-text-secondary">
                  Temperature: <span className="font-mono text-accent">{temperature}</span>
                </Label>
              </div>
              <input
                id="temperature"
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full h-2 bg-bg-base rounded-lg appearance-none cursor-pointer accent-accent mt-2"
              />
              <p className="text-[11px] text-text-muted">
                0.0 = Deterministic & Strict, 0.7 = Creative & Conversational
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prompt" className="text-xs text-text-secondary">
              System Prompt (Instructions)
            </Label>
            <Textarea
              id="prompt"
              placeholder="You are an expert customer service specialist for shipping and delivery. You look up order statuses and provide polite, accurate updates..."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="bg-bg-base border-border text-xs min-h-28 font-mono leading-relaxed"
              required
            />
          </div>
        </div>

        {/* 2. Tool Bindings Picker */}
        <div className="p-6 rounded-xl border border-border bg-bg-surface space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Tool Capabilities</h3>
              <p className="text-xs text-text-muted mt-0.5">
                Select which tools from the Tools Hub this specialist agent has permission to invoke.
              </p>
            </div>
            <Link href="/dashboard/tools/new" target="_blank">
              <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" /> Create New Tool
              </Button>
            </Link>
          </div>

          {isLoadingTools ? (
            <div className="p-8 flex justify-center">
              <Spinner size="default" className="text-accent" />
            </div>
          ) : availableTools.length === 0 ? (
            <div className="p-6 text-center rounded-lg border border-dashed border-border bg-bg-base">
              <p className="text-xs text-text-muted">
                No tools found in the Tools Hub. Create custom REST API or webhook tools first.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableTools.map((t) => {
                const isSelected = selectedToolIds.includes(t.id);
                return (
                  <div
                    key={t.id}
                    onClick={() => toggleTool(t.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none ${
                      isSelected
                        ? "border-accent bg-accent-muted/15 shadow-sm"
                        : "border-border bg-bg-base hover:border-border-strong opacity-80 hover:opacity-100"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="mt-1 rounded border-border bg-bg-surface text-accent focus:ring-accent w-4 h-4"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="p-1 rounded bg-bg-elevated border border-border">
                          {getToolIcon(t.tool_type)}
                        </span>
                        <span className="text-xs font-semibold text-text-primary truncate">
                          {t.display_name || t.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-muted mt-1.5 line-clamp-2 leading-relaxed">
                        {t.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Reusable Guardrails Attachment */}
        <GuardrailSelector
          selectedIds={selectedGuardrailIds}
          onChange={setSelectedGuardrailIds}
          title="Attached Safety & Pre-Tool Guardrails"
          description="Enforce parameter limits (e.g. refund limits) or specialist-level compliance before executing tools."
        />

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <Link href="/dashboard/agents">
            <Button type="button" variant="ghost" className="gap-2 text-xs text-text-muted">
              <ArrowLeft className="w-4 h-4" /> Cancel
            </Button>
          </Link>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary gap-2 text-xs"
          >
            {isSubmitting ? <Spinner size="sm" /> : <Save className="w-4 h-4" />}
            <span>{initialData ? "Save Changes" : "Create Agent"}</span>
          </Button>
        </div>
      </form>

      {/* 4. Knowledge Base Upload (for existing agents) */}
      {initialData && (
        <div className="p-6 rounded-xl border border-border bg-bg-surface space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-text-primary">Knowledge Base Context (RAG)</h3>
          </div>
          <p className="text-xs text-text-muted">
            Upload policies, FAQs, or return manuals. They will be chunked and indexed into pgvector for semantic retrieval during conversations.
          </p>

          {kbSuccess && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>{kbSuccess}</span>
            </div>
          )}

          <Textarea
            placeholder="Paste raw markdown, policy documentation, or FAQ content here..."
            value={kbContent}
            onChange={(e) => setKbContent(e.target.value)}
            className="bg-bg-base border-border text-xs min-h-24 font-mono"
          />

          <Button
            type="button"
            onClick={handleUploadKb}
            disabled={isUploadingKb || !kbContent.trim()}
            className="gap-2 text-xs"
            variant="outline"
          >
            {isUploadingKb ? <Spinner size="sm" /> : <Sparkles className="w-3.5 h-3.5 text-accent" />}
            <span>Index into Knowledge Base</span>
          </Button>
        </div>
      )}
    </div>
  );
}
