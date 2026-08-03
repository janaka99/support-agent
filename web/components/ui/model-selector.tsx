"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Sparkles,
  Search,
  Check,
  ChevronDown,
  Cpu,
  Wrench,
  Eye,
  Brain,
  Zap,
  DollarSign,
  AlertTriangle,
  Layers,
  Edit3,
  X,
} from "lucide-react";
import { ModelInfo, modelsApi } from "@/lib/api/models";
import { cn } from "@/lib/utils";

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  requireTools?: boolean;
  label?: string;
  className?: string;
}

export function ModelSelector({
  value,
  onChange,
  requireTools = false,
  label = "LLM Model",
  className,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string>("all");
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customModelInput, setCustomModelInput] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch catalog on mount
  useEffect(() => {
    async function loadModels() {
      try {
        setIsLoading(true);
        const data = await modelsApi.list();
        setModels(data);
      } catch (err) {
        console.error("Failed to load models catalog:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadModels();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Find currently selected model metadata
  const selectedModel = useMemo(() => {
    const found = models.find((m) => m.id.toLowerCase() === value?.toLowerCase());
    if (found) return found;
    if (!value) return null;
    return {
      id: value,
      name: value.split("/").pop() || value,
      provider: value.includes("/") ? value.split("/")[0] : "custom",
      provider_name: value.includes("/") ? value.split("/")[0].toUpperCase() : "Custom",
      context_window: 128000,
      supports_tools: true,
      supports_vision: false,
      supports_structured: true,
      prompt_cost_per_million: 0.5,
      completion_cost_per_million: 1.5,
      tags: ["Custom"],
      is_default: false,
    } as ModelInfo;
  }, [models, value]);

  // Distinct providers list
  const providers = useMemo(() => {
    const set = new Set<string>();
    models.forEach((m) => set.add(m.provider));
    return ["all", ...Array.from(set)];
  }, [models]);

  // Filtered models list
  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      const matchesProvider =
        selectedProvider === "all" || m.provider.toLowerCase() === selectedProvider.toLowerCase();
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.provider_name.toLowerCase().includes(q) ||
        m.tags.some((t) => t.toLowerCase().includes(q));
      return matchesProvider && matchesSearch;
    });
  }, [models, selectedProvider, searchQuery]);

  const handleSelectModel = (modelId: string) => {
    onChange(modelId);
    setIsOpen(false);
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (customModelInput.trim()) {
      onChange(customModelInput.trim());
      setIsOpen(false);
      setCustomModelInput("");
    }
  };

  const hasToolWarning = requireTools && selectedModel && !selectedModel.supports_tools;

  return (
    <div className={cn("space-y-1.5 relative", className)} ref={dropdownRef}>
      <div className="flex items-center justify-between">
        <label className="text-xs text-text-secondary font-medium">{label}</label>
        {selectedModel && (
          <span className="text-[11px] text-text-muted font-mono">
            ${selectedModel.prompt_cost_per_million.toFixed(2)} in / $
            {selectedModel.completion_cost_per_million.toFixed(2)} out per 1M
          </span>
        )}
      </div>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full h-10 rounded-lg bg-bg-base border border-border px-3 text-xs flex items-center justify-between text-text-primary hover:border-border-strong transition-colors focus:outline-none focus:ring-1 focus:ring-accent",
          isOpen && "ring-1 ring-accent border-accent",
          hasToolWarning && "border-amber-500/50"
        )}
      >
        <div className="flex items-center space-x-2.5 overflow-hidden">
          <div className="w-5 h-5 rounded bg-bg-elevated border border-border flex items-center justify-center flex-shrink-0">
            <Cpu className="w-3 h-3 text-accent" />
          </div>
          <div className="flex items-center space-x-2 truncate">
            <span className="font-semibold text-text-primary truncate">
              {selectedModel?.name || value || "Select Model"}
            </span>
            <span className="text-[10px] text-text-muted font-mono px-1.5 py-0.5 rounded bg-bg-surface border border-border flex-shrink-0">
              {selectedModel?.provider_name || "Custom"}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-shrink-0">
          {selectedModel?.supports_tools && (
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center space-x-1">
              <Wrench className="w-2.5 h-2.5" />
              <span>Tools</span>
            </span>
          )}
          <ChevronDown
            className={cn("w-4 h-4 text-text-secondary transition-transform", isOpen && "rotate-180")}
          />
        </div>
      </button>

      {/* Tool Compatibility Warning */}
      {hasToolWarning && (
        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-start space-x-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Warning:</strong> Selected model ({selectedModel?.name}) does not natively support tool calling.
            Specialist agent tools may fail to execute.
          </span>
        </div>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl bg-bg-surface border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Header Controls */}
          <div className="p-3 border-b border-border space-y-2.5 bg-bg-surface">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => setIsCustomMode(false)}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-md font-medium transition-colors",
                    !isCustomMode
                      ? "bg-accent text-white"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
                  )}
                >
                  Curated Catalog ({models.length})
                </button>
                <button
                  type="button"
                  onClick={() => setIsCustomMode(true)}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-md font-medium transition-colors flex items-center space-x-1",
                    isCustomMode
                      ? "bg-accent text-white"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
                  )}
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Custom / OpenRouter</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-text-muted hover:text-text-primary p-1 rounded-md hover:bg-bg-elevated"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!isCustomMode ? (
              <>
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search model name, slug, or tags (e.g. claude, llama, fast, reasoning)..."
                    className="w-full h-8 pl-8 pr-3 bg-bg-base border border-border rounded-md text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary text-[10px]"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Provider Filter Tabs */}
                <div className="flex items-center space-x-1 overflow-x-auto pb-1 scrollbar-none text-[11px]">
                  {providers.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSelectedProvider(p)}
                      className={cn(
                        "px-2 py-0.5 rounded-full capitalize whitespace-nowrap border transition-colors",
                        selectedProvider === p
                          ? "bg-accent/20 text-accent border-accent/40 font-medium"
                          : "bg-bg-base text-text-secondary border-border hover:border-border-strong hover:text-text-primary"
                      )}
                    >
                      {p === "all" ? "All Providers" : p}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          {/* Body Content */}
          {isCustomMode ? (
            <form onSubmit={handleApplyCustom} className="p-4 space-y-3.5 bg-bg-base">
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-text-primary">Custom Model ID / OpenRouter Route</h4>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  Enter any model identifier from OpenRouter (e.g.{" "}
                  <code className="text-accent font-mono">meta-llama/llama-3.3-70b-instruct</code>,{" "}
                  <code className="text-accent font-mono">deepseek/deepseek-r1</code>), local Ollama (e.g.{" "}
                  <code className="text-accent font-mono">ollama/llama3.2:3b</code>), or self-hosted vLLM endpoint.
                </p>
              </div>

              <input
                type="text"
                value={customModelInput}
                onChange={(e) => setCustomModelInput(e.target.value)}
                placeholder="e.g. openrouter/anthropic/claude-3.7-sonnet"
                className="w-full h-9 px-3 bg-bg-surface border border-border rounded-md text-xs font-mono text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                autoFocus
              />

              <div className="flex items-center justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCustomMode(false)}
                  className="px-3 py-1.5 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-bg-surface"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!customModelInput.trim()}
                  className="px-3.5 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  Use Custom Model
                </button>
              </div>
            </form>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-border/40 p-1.5">
              {isLoading ? (
                <div className="p-6 text-center text-xs text-text-muted">Loading models catalog...</div>
              ) : filteredModels.length === 0 ? (
                <div className="p-6 text-center space-y-1.5">
                  <p className="text-xs text-text-secondary">No models match your search.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomModelInput(searchQuery);
                      setIsCustomMode(true);
                    }}
                    className="text-xs text-accent hover:underline font-medium"
                  >
                    Use &quot;{searchQuery}&quot; as a custom model identifier →
                  </button>
                </div>
              ) : (
                filteredModels.map((m) => {
                  const isSelected = m.id.toLowerCase() === value?.toLowerCase();
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSelectModel(m.id)}
                      className={cn(
                        "w-full p-2.5 rounded-lg text-left transition-colors flex items-start justify-between group",
                        isSelected
                          ? "bg-accent/10 border border-accent/30"
                          : "hover:bg-bg-elevated/70 border border-transparent"
                      )}
                    >
                      <div className="space-y-1 min-w-0 pr-3">
                        <div className="flex items-center space-x-2">
                          <span
                            className={cn(
                              "text-xs font-semibold truncate",
                              isSelected ? "text-accent" : "text-text-primary group-hover:text-text-primary"
                            )}
                          >
                            {m.name}
                          </span>
                          <span className="text-[10px] text-text-muted font-mono px-1 py-0.2 rounded bg-bg-base border border-border">
                            {m.provider_name}
                          </span>
                          {m.tags.map((tag) => (
                            <span
                              key={tag}
                              className={cn(
                                "text-[9px] px-1.5 py-0.2 rounded font-medium",
                                tag === "Recommended"
                                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                  : tag === "Fast" || tag === "Ultra Fast"
                                  ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                                  : tag === "Reasoning" || tag === "Thinking"
                                  ? "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                                  : "bg-bg-base text-text-secondary border border-border"
                              )}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>

                        {m.description && (
                          <p className="text-[11px] text-text-muted line-clamp-1 leading-snug">{m.description}</p>
                        )}

                        <div className="flex items-center space-x-3 text-[10px] text-text-muted pt-0.5">
                          <span className="flex items-center space-x-1">
                            <Layers className="w-2.5 h-2.5" />
                            <span>{(m.context_window / 1000).toFixed(0)}k context</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <DollarSign className="w-2.5 h-2.5" />
                            <span>
                              ${m.prompt_cost_per_million.toFixed(2)} / ${m.completion_cost_per_million.toFixed(2)} per 1M
                            </span>
                          </span>
                          {m.supports_tools && (
                            <span className="flex items-center space-x-0.5 text-emerald-400">
                              <Wrench className="w-2.5 h-2.5" />
                              <span>Tool calling</span>
                            </span>
                          )}
                          {m.supports_vision && (
                            <span className="flex items-center space-x-0.5 text-blue-400">
                              <Eye className="w-2.5 h-2.5" />
                              <span>Vision</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center flex-shrink-0 mt-0.5 text-white">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
