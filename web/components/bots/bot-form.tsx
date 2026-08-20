"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bot, BotCreate, BotAgentAssociation, botsApi } from "@/lib/api/bots";
import { Agent, agentsApi } from "@/lib/api/agents";
import { GuardrailConfig } from "@/lib/api/guardrails";
import { GuardrailSelector } from "@/components/guardrails/guardrail-selector";
import { ModelSelector } from "@/components/ui/model-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Cpu,
  ArrowLeft,
  Save,
  Sparkles,
  CheckCircle2,
  Plus,
  Trash2,
  Search,
  CheckCheck,
  XCircle,
  MessageCircle,
} from "lucide-react";
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
  const [agentSearch, setAgentSearch] = useState("");

  // Bot Form State
  const [name, setName] = useState(initialBot?.name || "");
  const [description, setDescription] = useState(initialBot?.description || "");
  const [greetingMessage, setGreetingMessage] = useState(
    initialBot?.greeting_message || "Hello! How can I help you today?"
  );
  const [systemPrompt, setSystemPrompt] = useState(
    initialBot?.system_prompt || "You are a helpful and polite AI assistant. Answer user inquiries clearly and accurately according to your instructions and knowledge."
  );
  const [telegramBotToken, setTelegramBotToken] = useState(initialBot?.telegram_bot_token || "");
  const [model, setModel] = useState(initialBot?.model || "gpt-4o-mini");
  const [isActive, setIsActive] = useState(initialBot?.is_active ?? true);
  const [guardrails] = useState<GuardrailConfig | undefined>(initialBot?.guardrails);
  const [selectedGuardrailIds, setSelectedGuardrailIds] = useState<string[]>(
    initialBot?.assigned_guardrails?.map((g) => g.id) || []
  );
  
  const handleRegisterTelegram = async () => {
    if (!initialBot?.id) return;
    if (!telegramBotToken.trim()) {
      alert("Please enter a Telegram Bot Token first.");
      return;
    }
    try {
      const res = await botsApi.registerTelegram(initialBot.id, telegramBotToken.trim());
      alert(`Successfully registered webhook: ${res.webhook_url}`);
    } catch (err: any) {
      alert(`Failed to register Telegram webhook: ${err.message}`);
    }
  };

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
      } catch (err) {
        console.error("Failed to load agents:", err);
      } finally {
        setIsLoadingAgents(false);
      }
    }
    loadAgents();
  }, []);

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

  const selectAllAgents = () => {
    const map: Record<string, { routingHint: string; priority: number }> = {};
    allAgents.forEach((ag, idx) => {
      map[ag.id] = {
        routingHint: selectedAgentMap[ag.id]?.routingHint || ag.specialization || "",
        priority: selectedAgentMap[ag.id]?.priority ?? idx,
      };
    });
    setSelectedAgentMap(map);
  };

  const clearAllAgents = () => {
    setSelectedAgentMap({});
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
        telegram_bot_token: telegramBotToken.trim() || undefined,
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

  const filteredAgents = allAgents.filter((ag) => {
    if (!agentSearch.trim()) return true;
    const query = agentSearch.toLowerCase();
    return (
      ag.name.toLowerCase().includes(query) ||
      ag.specialization.toLowerCase().includes(query) ||
      (ag.system_prompt && ag.system_prompt.toLowerCase().includes(query))
    );
  });

  const assignedCount = Object.keys(selectedAgentMap).length;

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

          <ModelSelector
            value={model}
            onChange={setModel}
            label="Supervisor Router Model"
          />
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
        
        <div className="pt-4 border-t border-border">
          <h4 className="text-xs font-semibold text-text-primary mb-3 flex items-center gap-1.5">
            <MessageCircle className="w-3.5 h-3.5 text-blue-500" />
            Telegram Integration
          </h4>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="telegram" className="text-xs text-text-secondary">
                Telegram Bot Token
              </Label>
              <div className="flex gap-2">
                <Input
                  id="telegram"
                  placeholder="e.g. 123456789:ABCdefGHIjklmNOPqrstUVWxyz"
                  value={telegramBotToken}
                  onChange={(e) => setTelegramBotToken(e.target.value)}
                  className="bg-bg-base border-border text-xs h-9 flex-1"
                />
                {isEditing && (
                  <Button 
                    type="button" 
                    variant="secondary" 
                    size="sm"
                    className="h-9 px-4 text-xs"
                    onClick={handleRegisterTelegram}
                  >
                    Register Webhook
                  </Button>
                )}
              </div>
              <p className="text-[10px] text-text-muted">
                You must save the Bot first before registering the webhook.
              </p>
            </div>
          </div>
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Specialist Agent Team Roster</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Select which specialist agents work for this Bot and configure their routing triggers.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted mr-1">
              <span className="font-semibold text-accent">{assignedCount}</span> of{" "}
              {allAgents.length} assigned
            </span>
            {allAgents.length > 0 && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={selectAllAgents}
                  disabled={assignedCount === allAgents.length}
                  className="h-7 text-[11px] gap-1 px-2.5"
                  title="Assign all specialist agents to this bot"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-accent" />
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearAllAgents}
                  disabled={assignedCount === 0}
                  className="h-7 text-[11px] gap-1 px-2.5 text-rose-400 hover:text-rose-300"
                  title="Remove all specialist agents from this bot"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Clear All
                </Button>
              </>
            )}
          </div>
        </div>

        {allAgents.length > 3 && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input
              placeholder="Search specialist agents by name or specialization..."
              value={agentSearch}
              onChange={(e) => setAgentSearch(e.target.value)}
              className="pl-8 bg-bg-base border-border text-xs h-8"
            />
          </div>
        )}

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
        ) : filteredAgents.length === 0 ? (
          <div className="p-4 text-center rounded-lg border border-border bg-bg-base text-xs text-text-muted">
            No specialist agents match &ldquo;{agentSearch}&rdquo;.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAgents.map((ag) => {
              const isSelected = !!selectedAgentMap[ag.id];
              return (
                <div
                  key={ag.id}
                  onClick={() => toggleAgent(ag)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer select-none ${
                    isSelected
                      ? "border-accent/50 bg-accent/5 shadow-sm ring-1 ring-accent/20"
                      : "border-border bg-bg-base opacity-75 hover:opacity-100 hover:border-border-strong"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="mt-0.5 shrink-0">
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-md bg-accent/20 border border-accent flex items-center justify-center text-accent">
                            <CheckCircle2 className="w-4 h-4 text-accent fill-accent/20" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-md border border-border bg-bg-surface hover:border-text-muted flex items-center justify-center text-transparent">
                            <Plus className="w-3.5 h-3.5 text-text-muted" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold text-text-primary">
                            {ag.name}
                          </h4>
                          <span className="mono text-[10px] px-2 py-0.5 rounded-full bg-bg-elevated text-text-muted border border-border">
                            {ag.specialization}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] font-medium px-2 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Assigned
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-text-secondary mt-1 line-clamp-1">
                          {ag.system_prompt || "No system prompt specified."}
                        </p>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="shrink-0">
                      {isSelected ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleAgent(ag);
                          }}
                          className="h-7 text-[11px] gap-1 px-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleAgent(ag);
                          }}
                          className="h-7 text-[11px] gap-1 px-2 border-accent/40 text-accent hover:bg-accent/10"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Assign
                        </Button>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <div
                      className="mt-3 pt-3 border-t border-border/60"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Label className="text-[11px] text-text-muted flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-accent" />
                        Custom Routing Trigger for this Bot:
                      </Label>
                      <Input
                        placeholder="e.g. Order tracking, delivery estimates, UPS/FedEx status..."
                        value={selectedAgentMap[ag.id]?.routingHint || ""}
                        onChange={(e) => updateRoutingHint(ag.id, e.target.value)}
                        className="mt-1 bg-bg-surface border-border text-xs h-8"
                      />
                    </div>
                  )}
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
