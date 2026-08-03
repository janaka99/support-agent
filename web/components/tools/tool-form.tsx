"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Tool, ToolCreate, toolsApi } from "@/lib/api/tools";
import { knowledgeBasesApi, KnowledgeBase } from "@/lib/api/knowledge-bases";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Plus,
  Trash2,
  Globe,
  Webhook,
  Code,
  Cpu,
  BookOpen,
  ArrowLeft,
  Save,
  Sliders,
} from "lucide-react";
import Link from "next/link";

interface ParameterRow {
  name: string;
  type: "string" | "integer" | "number" | "boolean";
  description: string;
  required: boolean;
}

interface ToolFormProps {
  initialTool?: Tool;
  isEditing?: boolean;
}

export function ToolForm({ initialTool, isEditing = false }: ToolFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState(initialTool?.name || "");
  const [displayName, setDisplayName] = useState(initialTool?.display_name || "");
  const [description, setDescription] = useState(initialTool?.description || "");
  const [toolType, setToolType] = useState(initialTool?.tool_type || "http_request");

  // HTTP Config State
  const [url, setUrl] = useState(initialTool?.config?.url || "");
  const [method, setMethod] = useState(initialTool?.config?.method || "GET");
  const [headersJson, setHeadersJson] = useState(
    JSON.stringify(initialTool?.config?.headers || {}, null, 2)
  );
  const [bodyTemplateJson, setBodyTemplateJson] = useState(
    JSON.stringify(initialTool?.config?.body_template || {}, null, 2)
  );

  // RAG Retriever State
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [isLoadingKbs, setIsLoadingKbs] = useState(false);
  const [selectedKbId, setSelectedKbId] = useState(initialTool?.config?.kb_id || "");
  const [topK, setTopK] = useState(initialTool?.config?.top_k || 4);
  const [similarityThreshold, setSimilarityThreshold] = useState(
    initialTool?.config?.similarity_threshold || 0.0
  );

  // Load KBs when RAG is selected or on mount
  useEffect(() => {
    async function loadKbs() {
      try {
        setIsLoadingKbs(true);
        const data = await knowledgeBasesApi.list();
        setKnowledgeBases(data);
        if (!selectedKbId && data.length > 0) {
          setSelectedKbId(data[0].id);
        }
      } catch (err) {
        console.error("Failed to fetch knowledge bases for tool form:", err);
      } finally {
        setIsLoadingKbs(false);
      }
    }
    loadKbs();
  }, []);

  // Parameter Schema State
  const [parameters, setParameters] = useState<ParameterRow[]>(() => {
    if (!initialTool?.parameters_schema?.properties) {
      return [{ name: "query", type: "string", description: "Search query string", required: true }];
    }
    const props = initialTool.parameters_schema.properties;
    const reqSet = new Set(initialTool.parameters_schema.required || []);
    return Object.entries(props).map(([k, v]: [string, any]) => ({
      name: k,
      type: v.type || "string",
      description: v.description || "",
      required: reqSet.has(k),
    }));
  });

  const addParameter = () => {
    setParameters((prev) => [
      ...prev,
      { name: "", type: "string", description: "", required: false },
    ]);
  };

  const removeParameter = (index: number) => {
    setParameters((prev) => prev.filter((_, i) => i !== index));
  };

  const updateParameter = (index: number, field: keyof ParameterRow, value: any) => {
    setParameters((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Validate Name
      const slug = name.trim().toLowerCase().replace(/\s+/g, "_");
      if (!slug) {
        throw new Error("Tool slug identifier is required.");
      }

      // Build Parameters Schema
      const schemaProperties: Record<string, any> = {};
      const requiredFields: string[] = [];

      for (const p of parameters) {
        if (!p.name.trim()) continue;
        schemaProperties[p.name.trim()] = {
          type: p.type,
          description: p.description,
        };
        if (p.required) {
          requiredFields.push(p.name.trim());
        }
      }

      const parametersSchema = {
        type: "object",
        properties: schemaProperties,
        required: requiredFields,
      };

      let config: Record<string, any> = {};

      if (toolType === "rag_retriever") {
        if (!selectedKbId) {
          throw new Error("Please select a target Knowledge Base for this RAG tool.");
        }
        config = {
          kb_id: selectedKbId,
          top_k: Number(topK),
          similarity_threshold: Number(similarityThreshold),
        };
      } else if (toolType === "http_request" || toolType === "webhook") {
        let parsedHeaders = {};
        let parsedBody = undefined;
        try {
          parsedHeaders = JSON.parse(headersJson || "{}");
        } catch {
          throw new Error("Invalid JSON formatted HTTP Headers.");
        }

        if (method !== "GET" && bodyTemplateJson.trim()) {
          try {
            parsedBody = JSON.parse(bodyTemplateJson);
          } catch {
            throw new Error("Invalid JSON formatted Body Template.");
          }
        }

        config = {
          url: url.trim(),
          method: method.toUpperCase(),
          headers: parsedHeaders,
          ...(parsedBody && { body_template: parsedBody }),
        };
      }

      const payload: ToolCreate = {
        name: slug,
        display_name: displayName.trim() || slug,
        description: description.trim(),
        tool_type: toolType,
        config,
        parameters_schema: parametersSchema,
      };

      if (isEditing && initialTool) {
        await toolsApi.update(initialTool.id, payload);
      } else {
        await toolsApi.create(payload);
      }

      router.push("/dashboard/tools");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to save tool.");
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

      {/* 1. General Identification */}
      <div className="p-6 rounded-xl border border-border bg-bg-surface space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">Tool Metadata</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="display-name" className="text-xs text-text-secondary">
              Display Name
            </Label>
            <Input
              id="display-name"
              placeholder="e.g. Search Company Policies"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="bg-bg-base border-border text-xs h-9"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs text-text-secondary">
              Slug Identifier (used by LLM)
            </Label>
            <Input
              id="name"
              placeholder="e.g. search_company_policies"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isEditing}
              className="bg-bg-base border-border text-xs h-9 font-mono"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description" className="text-xs text-text-secondary">
            Tool Instructions (Prompt description for LLM)
          </Label>
          <Textarea
            id="description"
            placeholder="Explain when and why the agent should invoke this tool. (e.g. 'Use this tool when the customer inquires about return windows, warranty policies, or terms.')"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="bg-bg-base border-border text-xs min-h-20"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-text-secondary">Tool Type</Label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { id: "rag_retriever", label: "Knowledge Base (RAG)", icon: BookOpen },
              { id: "http_request", label: "REST API", icon: Globe },
              { id: "webhook", label: "Webhook", icon: Webhook },
              { id: "code_sandbox", label: "Python Sandbox", icon: Code },
              { id: "builtin", label: "Builtin System", icon: Cpu },
            ].map((t) => {
              const Icon = t.icon;
              const isSelected = toolType === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setToolType(t.id)}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-xs font-medium transition-all ${
                    isSelected
                      ? "border-accent bg-accent-muted text-accent"
                      : "border-border bg-bg-base text-text-muted hover:text-text-primary"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. RAG Knowledge Base Configuration */}
      {toolType === "rag_retriever" && (
        <div className="p-6 rounded-xl border border-border bg-bg-surface space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              Knowledge Base Target
            </h3>
            <Link
              href="/dashboard/knowledge-bases"
              className="text-xs text-accent hover:underline inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Manage Knowledge Bases
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs text-text-secondary">Target Knowledge Base</Label>
              {isLoadingKbs ? (
                <div className="h-9 bg-bg-base border border-border rounded-md flex items-center px-3 text-xs text-text-muted">
                  <Spinner size="sm" className="mr-2" /> Loading KBs...
                </div>
              ) : knowledgeBases.length === 0 ? (
                <div className="text-xs text-rose-400 p-2 border border-rose-500/20 bg-rose-500/10 rounded-md">
                  No Knowledge Bases found. Please create one first.
                </div>
              ) : (
                <select
                  value={selectedKbId}
                  onChange={(e) => setSelectedKbId(e.target.value)}
                  className="w-full h-9 rounded-md bg-bg-base border border-border px-3 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  {knowledgeBases.map((kb) => (
                    <option key={kb.id} value={kb.id}>
                      {kb.name} ({kb.document_count} docs)
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs text-text-secondary">Top K Matches</Label>
              <select
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
                className="w-full h-9 rounded-md bg-bg-base border border-border px-3 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value={2}>2 Chunks</option>
                <option value={4}>4 Chunks (Recommended)</option>
                <option value={8}>8 Chunks</option>
              </select>
            </div>

            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs text-text-secondary">Min Similarity Threshold</Label>
              <select
                value={similarityThreshold}
                onChange={(e) => setSimilarityThreshold(Number(e.target.value))}
                className="w-full h-9 rounded-md bg-bg-base border border-border px-3 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value={0.0}>0.0 (All top matches)</option>
                <option value={0.3}>0.3 (Low threshold)</option>
                <option value={0.5}>0.5 (Moderate)</option>
                <option value={0.7}>0.7 (Strict)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 3. HTTP / Endpoint Configuration */}
      {(toolType === "http_request" || toolType === "webhook") && (
        <div className="p-6 rounded-xl border border-border bg-bg-surface space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">Endpoint Configuration</h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5 md:col-span-1">
              <Label htmlFor="method" className="text-xs text-text-secondary">
                HTTP Method
              </Label>
              <select
                id="method"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full h-9 rounded-md bg-bg-base border border-border px-3 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>

            <div className="space-y-1.5 md:col-span-3">
              <Label htmlFor="url" className="text-xs text-text-secondary">
                Endpoint URL (supports <span className="font-mono">{`{param}`}</span> placeholders)
              </Label>
              <Input
                id="url"
                placeholder="https://api.example.com/v1/orders/{order_id}"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="bg-bg-base border-border text-xs h-9 font-mono"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="headers" className="text-xs text-text-secondary">
                HTTP Headers (JSON)
              </Label>
              <Textarea
                id="headers"
                value={headersJson}
                onChange={(e) => setHeadersJson(e.target.value)}
                className="bg-bg-base border-border text-xs font-mono min-h-24"
                placeholder={`{\n  "Authorization": "Bearer key_123"\n}`}
              />
            </div>

            {method !== "GET" && (
              <div className="space-y-1.5">
                <Label htmlFor="body" className="text-xs text-text-secondary">
                  Body Template (JSON)
                </Label>
                <Textarea
                  id="body"
                  value={bodyTemplateJson}
                  onChange={(e) => setBodyTemplateJson(e.target.value)}
                  className="bg-bg-base border-border text-xs font-mono min-h-24"
                  placeholder={`{\n  "order_id": "{order_id}",\n  "status": "refunded"\n}`}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Input Arguments Schema */}
      <div className="p-6 rounded-xl border border-border bg-bg-surface space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Input Parameter Schema</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Define the typed arguments the LLM will extract from customer messages to invoke this tool.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addParameter}
            className="gap-1.5 text-xs text-accent border-accent/20 bg-accent-muted hover:bg-accent-muted/80"
          >
            <Plus className="w-3.5 h-3.5" /> Add Parameter
          </Button>
        </div>

        <div className="space-y-3">
          {parameters.map((param, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-lg border border-border bg-bg-base grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
            >
              <div className="sm:col-span-3">
                <Input
                  placeholder="Parameter name"
                  value={param.name}
                  onChange={(e) => updateParameter(idx, "name", e.target.value)}
                  className="bg-bg-surface border-border text-xs h-8 font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <select
                  value={param.type}
                  onChange={(e) => updateParameter(idx, "type", e.target.value)}
                  className="w-full h-8 rounded-md bg-bg-surface border border-border px-2 text-xs text-text-primary focus:outline-none"
                >
                  <option value="string">string</option>
                  <option value="integer">integer</option>
                  <option value="number">number</option>
                  <option value="boolean">boolean</option>
                </select>
              </div>

              <div className="sm:col-span-5">
                <Input
                  placeholder="Prompt description for argument"
                  value={param.description}
                  onChange={(e) => updateParameter(idx, "description", e.target.value)}
                  className="bg-bg-surface border-border text-xs h-8"
                />
              </div>

              <div className="sm:col-span-1 flex items-center justify-center">
                <label className="flex items-center gap-1 text-[11px] text-text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={param.required}
                    onChange={(e) => updateParameter(idx, "required", e.target.checked)}
                    className="rounded border-border"
                  />
                  <span>Req</span>
                </label>
              </div>

              <div className="sm:col-span-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => removeParameter(idx)}
                  className="text-text-muted hover:text-rose-400 p-1 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Submit Button */}
      <div className="flex items-center justify-end gap-3">
        <Link href="/dashboard/tools">
          <Button type="button" variant="outline" size="sm" className="text-xs">
            Cancel
          </Button>
        </Link>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary gap-2 text-xs h-9 px-5"
        >
          {isSubmitting ? <Spinner size="sm" /> : <Save className="w-3.5 h-3.5" />}
          {isEditing ? "Save Tool Changes" : "Create Tool"}
        </Button>
      </div>
    </form>
  );
}
