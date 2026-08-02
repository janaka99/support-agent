"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tool, ToolCreate, toolsApi } from "@/lib/api/tools";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Plus, Trash2, Globe, Webhook, Code, Cpu, ArrowLeft, Save } from "lucide-react";
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

  // Config State
  const [url, setUrl] = useState(initialTool?.config?.url || "");
  const [method, setMethod] = useState(initialTool?.config?.method || "GET");
  const [headersJson, setHeadersJson] = useState(
    JSON.stringify(initialTool?.config?.headers || {}, null, 2)
  );
  const [bodyTemplateJson, setBodyTemplateJson] = useState(
    JSON.stringify(initialTool?.config?.body_template || {}, null, 2)
  );

  // Parameter Schema State
  const [parameters, setParameters] = useState<ParameterRow[]>(() => {
    if (!initialTool?.parameters_schema?.properties) {
      return [{ name: "order_id", type: "string", description: "Order ID number", required: true }];
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

      // Parse JSON headers & body
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

      const payload: ToolCreate = {
        name: slug,
        display_name: displayName.trim() || slug,
        description: description.trim(),
        tool_type: toolType,
        config: {
          url: url.trim(),
          method: method.toUpperCase(),
          headers: parsedHeaders,
          ...(parsedBody && { body_template: parsedBody }),
        },
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
              placeholder="e.g. Check Order Tracking"
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
              placeholder="e.g. check_order_tracking"
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
            placeholder="Explain when and why the agent should invoke this tool. (e.g. 'Use this tool when the customer inquires about their shipping status or tracking number.')"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="bg-bg-base border-border text-xs min-h-20"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-text-secondary">Tool Type</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
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
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. HTTP / Endpoint Configuration */}
      {toolType !== "code_sandbox" && (
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
                required={toolType === "http_request" || toolType === "webhook"}
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

      {/* 3. Input Arguments Schema */}
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

              <div className="sm:col-span-4">
                <Input
                  placeholder="Description for LLM"
                  value={param.description}
                  onChange={(e) => updateParameter(idx, "description", e.target.value)}
                  className="bg-bg-surface border-border text-xs h-8"
                />
              </div>

              <div className="sm:col-span-2 flex items-center gap-1.5">
                <input
                  type="checkbox"
                  id={`req-${idx}`}
                  checked={param.required}
                  onChange={(e) => updateParameter(idx, "required", e.target.checked)}
                  className="rounded border-border bg-bg-surface text-accent focus:ring-accent w-4 h-4"
                />
                <Label htmlFor={`req-${idx}`} className="text-xs text-text-muted cursor-pointer">
                  Required
                </Label>
              </div>

              <div className="sm:col-span-1 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeParameter(idx)}
                  className="h-7 w-7 p-0 text-text-muted hover:text-rose-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-2">
        <Link href="/dashboard/tools">
          <Button type="button" variant="ghost" className="gap-2 text-xs text-text-muted">
            <ArrowLeft className="w-4 h-4" /> Cancel
          </Button>
        </Link>

        <Button type="submit" disabled={isSubmitting} className="btn-primary gap-2 text-xs">
          {isSubmitting ? <Spinner size="sm" /> : <Save className="w-4 h-4" />}
          <span>{isEditing ? "Update Tool" : "Publish Tool"}</span>
        </Button>
      </div>
    </form>
  );
}
