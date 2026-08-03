"use client";

import { useEffect, useState, useMemo } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import { modelsApi, ModelInfo } from "@/lib/api/models";
import {
  Plus,
  Search,
  Cpu,
  Check,
  Wrench,
  Eye,
  Brain,
  Zap,
  DollarSign,
  Trash2,
  Edit2,
  RefreshCw,
  Sparkles,
  Layers,
  CheckCircle2,
  XCircle,
} from "lucide-react";

const PROVIDER_OPTIONS = [
  { id: "all", label: "All Providers" },
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "google", label: "Google" },
  { id: "deepseek", label: "DeepSeek" },
  { id: "groq", label: "Groq" },
  { id: "meta", label: "Meta" },
  { id: "mistral", label: "Mistral" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "custom", label: "Custom / Self-Hosted" },
];

export default function PlatformModelsPage() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Create / Edit modal state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelInfo | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form fields
  const [formModelId, setFormModelId] = useState("");
  const [formName, setFormName] = useState("");
  const [formProvider, setFormProvider] = useState("openai");
  const [formContextWindow, setFormContextWindow] = useState(128000);
  const [formSupportsTools, setFormSupportsTools] = useState(true);
  const [formSupportsVision, setFormSupportsVision] = useState(false);
  const [formSupportsStructured, setFormSupportsStructured] = useState(true);
  const [formPromptCost, setFormPromptCost] = useState(0.50);
  const [formCompletionCost, setFormCompletionCost] = useState(1.50);
  const [formDescription, setFormDescription] = useState("");
  const [formTags, setFormTags] = useState("");

  // Delete state
  const [modelToDelete, setModelToDelete] = useState<ModelInfo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchModels = async () => {
    try {
      setIsLoading(true);
      const data = await modelsApi.list();
      setModels(data);
    } catch (err: any) {
      console.error("Failed to fetch models:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const openCreateDialog = () => {
    setEditingModel(null);
    setFormModelId("");
    setFormName("");
    setFormProvider("openai");
    setFormContextWindow(128000);
    setFormSupportsTools(true);
    setFormSupportsVision(false);
    setFormSupportsStructured(true);
    setFormPromptCost(0.50);
    setFormCompletionCost(1.50);
    setFormDescription("");
    setFormTags("Recommended, Fast");
    setErrorMessage(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (model: ModelInfo) => {
    setEditingModel(model);
    setFormModelId(model.id);
    setFormName(model.name);
    setFormProvider(model.provider);
    setFormContextWindow(model.context_window);
    setFormSupportsTools(model.supports_tools);
    setFormSupportsVision(model.supports_vision);
    setFormSupportsStructured(model.supports_structured);
    setFormPromptCost(model.prompt_cost_per_million);
    setFormCompletionCost(model.completion_cost_per_million);
    setFormDescription(model.description || "");
    setFormTags(model.tags ? model.tags.join(", ") : "");
    setErrorMessage(null);
    setIsDialogOpen(true);
  };

  const handleSaveModel = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formModelId.trim() || !formName.trim()) {
      setErrorMessage("Model Identifier and Name are required.");
      return;
    }

    try {
      setIsSaving(true);
      const tagsArray = formTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      if (editingModel) {
        // Update existing model
        await modelsApi.update(editingModel.id, {
          name: formName.trim(),
          provider: formProvider,
          provider_name: PROVIDER_OPTIONS.find((p) => p.id === formProvider)?.label || formProvider,
          context_window: Number(formContextWindow),
          supports_tools: formSupportsTools,
          supports_vision: formSupportsVision,
          supports_structured: formSupportsStructured,
          prompt_cost_per_million: Number(formPromptCost),
          completion_cost_per_million: Number(formCompletionCost),
          description: formDescription.trim() || undefined,
          tags: tagsArray,
        });
      } else {
        // Create new model
        await modelsApi.create({
          model_id: formModelId.trim(),
          name: formName.trim(),
          provider: formProvider,
          provider_name: PROVIDER_OPTIONS.find((p) => p.id === formProvider)?.label || formProvider,
          context_window: Number(formContextWindow),
          supports_tools: formSupportsTools,
          supports_vision: formSupportsVision,
          supports_structured: formSupportsStructured,
          prompt_cost_per_million: Number(formPromptCost),
          completion_cost_per_million: Number(formCompletionCost),
          description: formDescription.trim() || undefined,
          tags: tagsArray,
          is_active: true,
        });
      }

      setIsDialogOpen(false);
      await fetchModels();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save model.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteModel = async () => {
    if (!modelToDelete) return;
    try {
      setIsDeleting(true);
      await modelsApi.delete(modelToDelete.id);
      setModelToDelete(null);
      await fetchModels();
    } catch (err: any) {
      console.error("Failed to delete model:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered list
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
        (m.tags && m.tags.some((t) => t.toLowerCase().includes(q)));
      return matchesProvider && matchesSearch;
    });
  }, [models, selectedProvider, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
      <PageHeader
        title="AI Models Catalog"
        description="Platform-wide model registry. Superadmins can add, update pricing, and manage model availability across all organizations."
        action={
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={fetchModels} disabled={isLoading} className="gap-2">
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button onClick={openCreateDialog} className="gap-2">
              <Plus className="w-4 h-4" /> Add Model to Platform
            </Button>
          </div>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-bg-surface/50 backdrop-blur-md border-border-subtle flex items-center gap-4">
          <div className="p-3 rounded-xl bg-accent-muted text-accent">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-text-muted font-medium">Catalog Models</p>
            <p className="text-2xl font-bold text-text-primary tracking-tight">{models.length}</p>
          </div>
        </Card>

        <Card className="p-4 bg-bg-surface/50 backdrop-blur-md border-border-subtle flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-text-muted font-medium">Tool Calling Support</p>
            <p className="text-2xl font-bold text-text-primary tracking-tight">
              {models.filter((m) => m.supports_tools).length}
            </p>
          </div>
        </Card>

        <Card className="p-4 bg-bg-surface/50 backdrop-blur-md border-border-subtle flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
            <Eye className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-text-muted font-medium">Multimodal / Vision</p>
            <p className="text-2xl font-bold text-text-primary tracking-tight">
              {models.filter((m) => m.supports_vision).length}
            </p>
          </div>
        </Card>

        <Card className="p-4 bg-bg-surface/50 backdrop-blur-md border-border-subtle flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-text-muted font-medium">Avg. In/Out Cost</p>
            <p className="text-xl font-bold text-text-primary tracking-tight">
              ${(models.reduce((acc, m) => acc + m.prompt_cost_per_million, 0) / (models.length || 1)).toFixed(2)} / 1M
            </p>
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Provider Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
          {PROVIDER_OPTIONS.map((p) => {
            const isSelected = selectedProvider === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedProvider(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isSelected
                    ? "bg-accent text-white shadow-sm"
                    : "bg-bg-subtle/60 text-text-muted hover:text-text-primary hover:bg-bg-subtle"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Search catalog models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-bg-surface/60 text-xs"
          />
        </div>
      </div>

      {/* Models Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Spinner size="lg" className="text-accent" />
          <p className="text-sm text-text-muted font-medium">Loading database model catalog...</p>
        </div>
      ) : filteredModels.length === 0 ? (
        <div className="text-center py-16 bg-bg-surface/30 rounded-2xl border border-border-subtle">
          <Cpu className="w-12 h-12 text-text-muted/40 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-text-primary">No models found</h3>
          <p className="text-xs text-text-muted mt-1 max-w-md mx-auto">
            No models match the selected provider filter or search query. Click "Add Model to Platform" to register one.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredModels.map((model) => (
            <Card
              key={model.id}
              className="p-5 bg-bg-surface/60 backdrop-blur-md border-border-subtle hover:border-accent/40 transition-all flex flex-col justify-between group shadow-sm hover:shadow-md"
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-text-primary text-base tracking-tight">{model.name}</h4>
                      {model.is_default && (
                        <Badge variant="accent" className="text-[10px] px-1.5 py-0 font-semibold">
                          Default
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs font-mono text-text-muted mt-0.5">{model.id}</p>
                  </div>
                  <Badge variant="muted" className="text-[11px] font-medium uppercase tracking-wider">
                    {model.provider_name || model.provider}
                  </Badge>
                </div>

                {/* Description */}
                {model.description && (
                  <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                    {model.description}
                  </p>
                )}

                {/* Capability Badges */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {model.supports_tools && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Wrench className="w-3 h-3" /> Tools
                    </span>
                  )}
                  {model.supports_vision && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <Eye className="w-3 h-3" /> Vision
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <Layers className="w-3 h-3" /> {(model.context_window / 1000).toFixed(0)}k Context
                  </span>
                  {model.tags?.map((t) => (
                    <span
                      key={t}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-bg-subtle text-text-muted border border-border-subtle"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Bottom Meta & Action Controls */}
              <div className="pt-4 mt-4 border-t border-border-subtle flex items-center justify-between">
                <div className="text-xs">
                  <span className="text-text-muted font-normal">Pricing: </span>
                  <span className="font-semibold text-text-primary">
                    ${model.prompt_cost_per_million.toFixed(2)}
                  </span>
                  <span className="text-text-muted"> / </span>
                  <span className="font-semibold text-text-primary">
                    ${model.completion_cost_per_million.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-text-muted font-normal"> / 1M</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(model)}
                    className="h-8 w-8 p-0 text-text-muted hover:text-text-primary"
                    title="Edit model"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setModelToDelete(model)}
                    className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    title="Delete model"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xl bg-bg-surface border-border-subtle">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-text-primary flex items-center gap-2">
              <Cpu className="w-5 h-5 text-accent" />
              {editingModel ? "Edit AI Model" : "Add Model to Platform Catalog"}
            </DialogTitle>
            <DialogDescription className="text-xs text-text-muted">
              {editingModel
                ? "Update pricing, context limits, and capabilities for this model."
                : "Register a new model in the PostgreSQL catalog so all agents can immediately use it without server redeployment."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveModel} className="space-y-4 pt-2">
            {errorMessage && (
              <div className="p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg">
                {errorMessage}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Model Identifier (Slug) *</label>
                <Input
                  placeholder="e.g. anthropic/claude-3-7-sonnet"
                  value={formModelId}
                  onChange={(e) => setFormModelId(e.target.value)}
                  disabled={Boolean(editingModel)}
                  required
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Display Name *</label>
                <Input
                  placeholder="e.g. Claude 3.7 Sonnet"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Provider</label>
                <select
                  value={formProvider}
                  onChange={(e) => setFormProvider(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border-subtle bg-bg-base px-3 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="groq">Groq</option>
                  <option value="meta">Meta</option>
                  <option value="mistral">Mistral</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="custom">Custom / Self-Hosted</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Context Window (Tokens)</label>
                <Input
                  type="number"
                  placeholder="128000"
                  value={formContextWindow}
                  onChange={(e) => setFormContextWindow(Number(e.target.value))}
                  required
                  className="text-xs font-mono"
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Prompt Cost ($ / 1M tokens)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.50"
                  value={formPromptCost}
                  onChange={(e) => setFormPromptCost(Number(e.target.value))}
                  required
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Completion Cost ($ / 1M tokens)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="1.50"
                  value={formCompletionCost}
                  onChange={(e) => setFormCompletionCost(Number(e.target.value))}
                  required
                  className="text-xs font-mono"
                />
              </div>
            </div>

            {/* Capability Toggles */}
            <div className="space-y-2 pt-1">
              <label className="text-xs font-medium text-text-secondary">Model Capabilities</label>
              <div className="grid grid-cols-3 gap-2">
                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border-subtle bg-bg-base/50 cursor-pointer text-xs hover:border-accent/40">
                  <input
                    type="checkbox"
                    checked={formSupportsTools}
                    onChange={(e) => setFormSupportsTools(e.target.checked)}
                    className="rounded border-border-subtle text-accent focus:ring-accent"
                  />
                  <span>Tool Calling</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border-subtle bg-bg-base/50 cursor-pointer text-xs hover:border-accent/40">
                  <input
                    type="checkbox"
                    checked={formSupportsVision}
                    onChange={(e) => setFormSupportsVision(e.target.checked)}
                    className="rounded border-border-subtle text-accent focus:ring-accent"
                  />
                  <span>Vision / Multimodal</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border-subtle bg-bg-base/50 cursor-pointer text-xs hover:border-accent/40">
                  <input
                    type="checkbox"
                    checked={formSupportsStructured}
                    onChange={(e) => setFormSupportsStructured(e.target.checked)}
                    className="rounded border-border-subtle text-accent focus:ring-accent"
                  />
                  <span>Structured Output</span>
                </label>
              </div>
            </div>

            {/* Description & Tags */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Description</label>
              <Input
                placeholder="Short summary of strengths and ideal use cases"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Tags (Comma-separated)</label>
              <Input
                placeholder="Recommended, Fast, Reasoning"
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving} className="gap-2">
                {isSaving && <Spinner size="sm" />}
                {editingModel ? "Save Changes" : "Create Model"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(modelToDelete)}
        onOpenChange={(open) => !open && setModelToDelete(null)}
        onConfirm={handleDeleteModel}
        title="Delete Model from Platform Catalog?"
        description={`Are you sure you want to delete '${modelToDelete?.name}' (${modelToDelete?.id})? This model will be removed from the platform catalog.`}
        confirmText="Delete Model"
        variant="destructive"
      />
    </div>
  );
}
