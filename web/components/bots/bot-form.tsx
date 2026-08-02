"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bot, BotCreate, BotAgentAssociation, botsApi } from "@/lib/api/bots";
import { Agent, agentsApi } from "@/lib/api/agents";
import { GuardrailConfig } from "@/lib/api/guardrails";
import { GuardrailEditor } from "@/components/guardrails/guardrail-editor";
import { GuardrailSelector } from "@/components/guardrails/guardrail-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Bot as BotIcon, Cpu, ArrowLeft, Save, Sparkles, CheckSquare, Square, Shield } from "lucide-react";
import Link from "next/link";

interface BotFormProps {
  initialBot?: Bot;
  isEditing?: boolean;
}

export function BotForm({ initialBot, isEditing = false }: BotFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Available Agents list
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);

  // Bot Form State
  const [name, setName] = useState(initialBot?.name || "");
  const [description, setDescription] = useState(initialBot?.description || "");
  const [greetingMessage, setGreetingMessage] = useState(
    initialBot?.greeting_message || "Hello! How can I help you today?"
  );
  const [systemPrompt, setSystemPrompt] = useState(
    initialBot?.system_prompt || "You are an intelligent supervisor router directing customer queries to the right specialist."
  );
  const [model, setModel] = useState(initialBot?.model || "gpt-4o-mini");
  const [isActive, setIsActive] = useState(initialBot?.is_active ?? true);
  const [guardrails, setGuardrails] = useState<GuardrailConfig | undefined>(initialBot?.guardrails);
  const [selectedGuardrailIds, setSelectedGuardrailIds] = useState<string[]>(
    initialBot?.assigned_guardrails?.map((g) => g.id) || []
  );

  // Selected Specialist Agents with routing hints & priorities
  const [selectedAgentMap, setSelectedAgentMap] = useState<Record<string, { routingHint: string; priority: number }>>(() => {
    const map: Record<string, { routingHint: string; priority: number }> = {};
    if (initialBot?.agents) {
      initialBot.agents.forEach((a, idx) => {
        map[a.agent_id] = {
          routingHint: a.routing_hint || a.specialization || "",
          priority: a.priority ?? idx,
        };
      });
    }
    return map;
  });

  useEffect(() => {
    async function loadAgents() {
      try {
        setIsLoadingAgents(true);
        const data = await agentsApi.list();
        setAllAgents(data);

        // If creating new bot and nothing selected, default to selecting all agents
        if (!initialBot && data.length > 0) {
          const map: Record<string, { routingHint: string; priority: number }> = {};
          data.forEach((ag, idx) => {
            map[ag.id] = {
              routingHint: ag.specialization || "",
              priority: idx,
            };
          });
          setSelectedAgentMap(map);
        }
      } catch (err) {
        console.error("Failed to load agents:", err);
      } finally {
        setIsLoadingAgents(false);
      }
    }
    loadAgents();
  }, [initialBot]);

  const toggleAgent = (agent: Agent) => {
    setSelectedAgentMap((prev) => {
      const copy = { ...prev };
      if (copy[agent.id]) {
        delete copy[agent.id];
      } else {
        copy[agent.id] = {
          routingHint: agent.specialization || "",
          priority: Object.keys(copy).length,
        };
      }
      return copy;
    });
  };

  const updateRoutingHint = (agentId: string, hint: string) => {
    setSelectedAgentMap((prev) => {
      if (!prev[agentId]) return prev;
      return {
        ...prev,
        [agentId]: { ...prev[agentId], routingHint: hint },
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (!name.trim()) {
        throw new Error("Bot name is required.");
      }

      const agentLinks: BotAgentAssociation[] = Object.entries(selectedAgentMap).map(
        ([agentId, meta]) => ({
          agent_id: agentId,
          routing_hint: meta.routingHint,
          priority: meta.priority,
        })
      );

      const payload: BotCreate = {
        name: name.trim(),
        description: description.trim() || undefined,
        greeting_message: greetingMessage.trim() || undefined,
        system_prompt: systemPrompt.trim() || undefined,
        model,
        is_active: isActive,
        guardrails: guardrails,
        agent_links: agentLinks,
        guardrail_ids: selectedGuardrailIds,
      };

      if (isEditing && initialBot) {
        await botsApi.update(initialBot.id, payload);
      } else {
        await botsApi.create(payload);
      }

      router.push("/dashboard/bots");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to save Bot.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl pb-12">
      {error && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
          {error}
        </div>
      )}

      {/* 1. General Bot Metadata */}
      <div className="p-6 rounded-xl border border-border bg-bg-surface space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">Bot Touchpoint Details</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="bot-name" className="text-xs text-text-secondary">
              Bot Name
            </Label>
            <Input
              id="bot-name"
              placeholder="e.g. Storefront Support Bot"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-bg-base border-border text-xs h-9"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="supervisor-model" className="text-xs text-text-secondary">
              Supervisor Router LLM Model
            </Label>
            <select
              id="supervisor-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full h-9 rounded-md bg-bg-base border border-border px-3 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="gpt-4o-mini">GPT-4o Mini (Fast & Low Cost)</option>
              <option value="gpt-4o">GPT-4o (High Intelligence)</option>
              <option value="gpt-4-turbo">GPT-4 Turbo</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description" className="text-xs text-text-secondary">
            Description
          </Label>
          <Input
            id="description"
            placeholder="e.g. Primary website customer support assistant for order tracking, FAQs, and returns."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="bg-bg-base border-border text-xs h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="greeting" className="text-xs text-text-secondary">
            Greeting Message
          </Label>
          <Input
            id="greeting"
            placeholder="e.g. Hello! I am your AI assistant. How can I help you today?"
            value={greetingMessage}
            onChange={(e) => setGreetingMessage(e.target.value)}
            className="bg-bg-base border-border text-xs h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="prompt" className="text-xs text-text-secondary">
            Supervisor Routing Guidelines (System Prompt)
          </Label>
          <Textarea
            id="prompt"
            placeholder="Custom instructions for the supervisor router on when and how to direct user messages to each specialist agent."
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="bg-bg-base border-border text-xs min-h-20"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="is-active"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded border-border bg-bg-base text-accent focus:ring-accent w-4 h-4"
          />
          <Label htmlFor="is-active" className="text-xs text-text-secondary cursor-pointer">
            Bot is active and accepting customer conversations
          </Label>
        </div>
      </div>

      {/* 2. Assemble Specialist Agent Team */}
      <div className="p-6 rounded-xl border border-border bg-bg-surface space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Specialist Agent Team Roster</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Select which specialist agents work for this Bot and configure their routing triggers.
            </p>
          </div>
          <span className="text-xs text-text-muted">
            <span className="font-semibold text-accent">{Object.keys(selectedAgentMap).length}</span> agents assigned
          </span>
        </div>

        {isLoadingAgents ? (
          <div className="p-8 flex justify-center">
            <Spinner size="default" className="text-accent" />
          </div>
        ) : allAgents.length === 0 ? (
          <div className="p-6 text-center rounded-lg border border-dashed border-border bg-bg-base">
            <p className="text-xs text-text-muted">
              No specialist agents found. Create agents first in the Agents Studio.
            </p>
            <Link href="/dashboard/agents/new" className="mt-3 inline-block">
              <Button size="sm" variant="outline" className="text-xs gap-1.5">
                <Cpu className="w-3.5 h-3.5" /> Create Agent
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {allAgents.map((ag) => {
              const isSelected = !!selectedAgentMap[ag.id];
              return (
                <div
                  key={ag.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isSelected
                      ? "border-accent/40 bg-accent-muted/10 shadow-sm"
                      : "border-border bg-bg-base opacity-75 hover:opacity-100"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleAgent(ag)}
                      className="mt-0.5 text-accent focus:outline-none"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 fill-accent/20 text-accent" />
                      ) : (
                        <Square className="w-5 h-5 text-text-muted hover:text-text-primary" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-text-primary truncate">
                          {ag.name}
                        </h4>
                        <span className="mono text-[10px] px-2 py-0.5 rounded-full bg-bg-elevated text-text-muted border border-border">
                          {ag.specialization}
                        </span>
                      </div>

                      <p className="text-xs text-text-secondary mt-1 line-clamp-1">
                        {ag.system_prompt}
                      </p>

                      {isSelected && (
                        <div className="mt-3 pt-3 border-t border-border/60 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                          <div className="sm:col-span-12">
                            <Label className="text-[11px] text-text-muted">
                              Custom Routing Hint for this Bot:
                            </Label>
                            <Input
                              placeholder="e.g. Order tracking, delivery estimates, UPS/FedEx status..."
                              value={selectedAgentMap[ag.id]?.routingHint || ""}
                              onChange={(e) => updateRoutingHint(ag.id, e.target.value)}
                              className="mt-1 bg-bg-surface border-border text-xs h-8"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Reusable First-Class Guardrails Library Selector */}
      <GuardrailSelector
        selectedIds={selectedGuardrailIds}
        onChange={setSelectedGuardrailIds}
        title="Attached Perimeter Guardrails"
        description="Select reusable guardrail policies from your library to attach to this Bot touchpoint."
      />

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Link href="/dashboard/bots">
          <Button type="button" variant="ghost" className="gap-2 text-xs text-text-muted">
            <ArrowLeft className="w-4 h-4" /> Cancel
          </Button>
        </Link>

        <Button type="submit" disabled={isSubmitting} className="btn-primary gap-2 text-xs">
          {isSubmitting ? <Spinner size="sm" /> : <Save className="w-4 h-4" />}
          <span>{isEditing ? "Update Bot" : "Create Bot"}</span>
        </Button>
      </div>
    </form>
  );
}
