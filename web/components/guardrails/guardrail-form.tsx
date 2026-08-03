"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  GuardrailCreate,
  GuardrailUpdate,
  GuardrailResponse,
  GuardrailType,
  GuardrailStage,
  ActionOnViolation,
  guardrailsApi,
} from "@/lib/api/guardrails";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ModelSelector } from "@/components/ui/model-selector";
import {
  ShieldAlert,
  ShieldCheck,
  Plus,
  Trash2,
  Lock,
  KeyRound,
  FileCode,
  Sparkles,
  Globe,
  ArrowLeft,
  Save,
  CheckCircle2,
  Flame,
  Binary,
  Layers,
  Code2,
} from "lucide-react";
import Link from "next/link";

interface GuardrailFormProps {
  initialData?: GuardrailResponse;
  isEditing?: boolean;
}

export function GuardrailForm({
  initialData,
  isEditing = false,
}: GuardrailFormProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState(initialData?.name || "");
  const [displayName, setDisplayName] = useState(initialData?.display_name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [stage, setStage] = useState<GuardrailStage>(initialData?.stage || "ingress");
  const [guardrailType, setGuardrailType] = useState<GuardrailType>(
    initialData?.guardrail_type || "pii"
  );
  const [actionOnViolation, setActionOnViolation] = useState<ActionOnViolation>(
    initialData?.action_on_violation || "block_and_respond"
  );
  const [refusalMessage, setRefusalMessage] = useState(
    initialData?.refusal_message ||
      "I am unable to fulfill this request as it violates safety guidelines."
  );
  const [isActive, setIsActive] = useState(initialData?.is_active ?? true);

  // ====================================================
  // Type Configurations
  // ====================================================

  // 1. PII
  const [blockCreditCards, setBlockCreditCards] = useState(
    initialData?.config?.block_credit_cards ?? true
  );
  const [blockSsn, setBlockSsn] = useState(
    initialData?.config?.block_ssn ?? true
  );
  const [blockEmails, setBlockEmails] = useState(
    initialData?.config?.block_emails ?? false
  );
  const [blockPhones, setBlockPhones] = useState(
    initialData?.config?.block_phone_numbers ?? false
  );

  // 2. Keywords
  const [blockedKeywords, setBlockedKeywords] = useState<string[]>(
    initialData?.config?.blocked_keywords || []
  );
  const [newKeyword, setNewKeyword] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(
    initialData?.config?.case_sensitive ?? false
  );

  // 3. Regex
  const [regexPatterns, setRegexPatterns] = useState<string[]>(
    initialData?.config?.patterns || []
  );
  const [newRegex, setNewRegex] = useState("");

  // 4. Structure & Size
  const [minChars, setMinChars] = useState(
    initialData?.config?.min_characters ?? ""
  );
  const [maxChars, setMaxChars] = useState(
    initialData?.config?.max_characters ?? 4000
  );
  const [detectRepetition, setDetectRepetition] = useState(
    initialData?.config?.detect_repetition ?? true
  );
  const [maxRepChars, setMaxRepChars] = useState(
    initialData?.config?.max_repeated_chars ?? 15
  );
  const [maxNewlines, setMaxNewlines] = useState(
    initialData?.config?.max_newlines ?? 20
  );

  // 5. Content Moderation
  const [modCategories, setModCategories] = useState<string[]>(
    initialData?.config?.categories || [
      "hate",
      "harassment",
      "self-harm",
      "sexual",
      "violence",
    ]
  );
  const [modThreshold, setModThreshold] = useState(
    initialData?.config?.confidence_threshold ?? 0.7
  );

  // 6. Semantic Embedding
  const [forbiddenTopics, setForbiddenTopics] = useState<string[]>(
    initialData?.config?.forbidden_topics || []
  );
  const [newTopic, setNewTopic] = useState("");
  const [embedThreshold, setEmbedThreshold] = useState(
    initialData?.config?.similarity_threshold ?? 0.75
  );
  const [embedModel, setEmbedModel] = useState(
    initialData?.config?.model || "text-embedding-3-small"
  );

  // 7. LLM Judge
  const [promptInjectionShield, setPromptInjectionShield] = useState(
    initialData?.config?.prompt_injection_shield ?? true
  );
  const [llmRules, setLlmRules] = useState<string[]>(
    initialData?.config?.rules || []
  );
  const [newRule, setNewRule] = useState("");
  const [judgeModel, setJudgeModel] = useState(
    initialData?.config?.model || "gpt-4o-mini"
  );

  // 8. Hallucination Groundedness
  const [hallucinationStrictness, setHallucinationStrictness] = useState<
    "strict" | "moderate"
  >(initialData?.config?.strictness || "moderate");
  const [requireGrounding, setRequireGrounding] = useState(
    initialData?.config?.require_grounding ?? true
  );
  const [hallucinationModel, setHallucinationModel] = useState(
    initialData?.config?.model || "gpt-4o-mini"
  );

  // 9. JSON Schema
  const [schemaJsonText, setSchemaJsonText] = useState(
    initialData?.config?.schema_definition
      ? JSON.stringify(initialData.config.schema_definition, null, 2)
      : JSON.stringify(
          {
            type: "object",
            properties: {
              amount: { type: "number", maximum: 200 },
              reason: { type: "string", minLength: 5 },
            },
            required: ["amount"],
          },
          null,
          2
        )
  );
  const [schemaTarget, setSchemaTarget] = useState<"tool_args" | "assistant_output">(
    initialData?.config?.target || "tool_args"
  );

  // 10. Python Code Sandbox
  const [pythonCode, setPythonCode] = useState(
    initialData?.config?.python_code ||
      `def validate(text: str, tool_calls: list) -> tuple[bool, str]:\n    # Example: reject if text mentions forbidden code\n    if "admin_override" in text:\n        return (False, "Admin override detected in payload")\n    return (True, "")\n`
  );
  const [sandboxTimeout, setSandboxTimeout] = useState(
    initialData?.config?.timeout_seconds ?? 2.0
  );

  // 11. Webhook
  const [webhookUrl, setWebhookUrl] = useState(
    initialData?.config?.url || ""
  );
  const [webhookTimeout, setWebhookTimeout] = useState(
    initialData?.config?.timeout_seconds ?? 3.0
  );

  // Helpers
  const handleAddKeyword = () => {
    const trimmed = newKeyword.trim();
    if (!trimmed) return;
    if (!blockedKeywords.includes(trimmed)) {
      setBlockedKeywords([...blockedKeywords, trimmed]);
    }
    setNewKeyword("");
  };

  const handleRemoveKeyword = (kw: string) => {
    setBlockedKeywords(blockedKeywords.filter((k) => k !== kw));
  };

  const handleAddRegex = () => {
    const trimmed = newRegex.trim();
    if (!trimmed) return;
    if (!regexPatterns.includes(trimmed)) {
      setRegexPatterns([...regexPatterns, trimmed]);
    }
    setNewRegex("");
  };

  const handleRemoveRegex = (pat: string) => {
    setRegexPatterns(regexPatterns.filter((p) => p !== pat));
  };

  const handleAddTopic = () => {
    const trimmed = newTopic.trim();
    if (!trimmed) return;
    if (!forbiddenTopics.includes(trimmed)) {
      setForbiddenTopics([...forbiddenTopics, trimmed]);
    }
    setNewTopic("");
  };

  const handleRemoveTopic = (top: string) => {
    setForbiddenTopics(forbiddenTopics.filter((t) => t !== top));
  };

  const handleAddRule = () => {
    const trimmed = newRule.trim();
    if (!trimmed) return;
    if (!llmRules.includes(trimmed)) {
      setLlmRules([...llmRules, trimmed]);
    }
    setNewRule("");
  };

  const handleRemoveRule = (rule: string) => {
    setLlmRules(llmRules.filter((r) => r !== rule));
  };

  const toggleModCategory = (cat: string) => {
    if (modCategories.includes(cat)) {
      setModCategories(modCategories.filter((c) => c !== cat));
    } else {
      setModCategories([...modCategories, cat]);
    }
  };

  const buildConfig = () => {
    switch (guardrailType) {
      case "pii":
        return {
          block_credit_cards: blockCreditCards,
          block_ssn: blockSsn,
          block_emails: blockEmails,
          block_phone_numbers: blockPhones,
        };
      case "keyword":
        return {
          blocked_keywords: blockedKeywords,
          case_sensitive: caseSensitive,
        };
      case "regex":
        return {
          patterns: regexPatterns,
        };
      case "structure":
        return {
          min_characters: minChars ? Number(minChars) : null,
          max_characters: maxChars ? Number(maxChars) : null,
          detect_repetition: detectRepetition,
          max_repeated_chars: Number(maxRepChars),
          max_newlines: Number(maxNewlines),
        };
      case "moderation":
        return {
          categories: modCategories,
          confidence_threshold: Number(modThreshold),
        };
      case "embedding":
        return {
          forbidden_topics: forbiddenTopics,
          similarity_threshold: Number(embedThreshold),
          model: embedModel,
        };
      case "llm_judge":
        return {
          prompt_injection_shield: promptInjectionShield,
          rules: llmRules,
          model: judgeModel,
        };
      case "hallucination":
        return {
          strictness: hallucinationStrictness,
          require_grounding: requireGrounding,
          model: hallucinationModel,
        };
      case "json_schema":
        let parsedSchema = {};
        try {
          parsedSchema = JSON.parse(schemaJsonText);
        } catch {
          parsedSchema = {};
        }
        return {
          schema_definition: parsedSchema,
          target: schemaTarget,
        };
      case "code_sandbox":
        return {
          python_code: pythonCode,
          timeout_seconds: Number(sandboxTimeout),
        };
      case "webhook":
        return {
          url: webhookUrl,
          timeout_seconds: Number(webhookTimeout),
        };
      default:
        return {};
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !displayName.trim()) {
      setError("Please fill in both slug name and display name.");
      return;
    }

    if (guardrailType === "json_schema") {
      try {
        JSON.parse(schemaJsonText);
      } catch (err) {
        setError("Invalid JSON Schema format. Please check JSON syntax.");
        return;
      }
    }

    try {
      setIsSaving(true);
      setError(null);

      const config = buildConfig();

      if (isEditing && initialData) {
        await guardrailsApi.update(initialData.id, {
          name,
          display_name: displayName,
          description,
          stage,
          guardrail_type: guardrailType,
          action_on_violation: actionOnViolation,
          refusal_message: refusalMessage,
          is_active: isActive,
          config,
        });
      } else {
        await guardrailsApi.create({
          name,
          display_name: displayName,
          description,
          stage,
          guardrail_type: guardrailType,
          action_on_violation: actionOnViolation,
          refusal_message: refusalMessage,
          is_active: isActive,
          config,
        });
      }

      router.push("/dashboard/guardrails");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to save guardrail.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <Link href="/dashboard/guardrails">
          <Button variant="ghost" size="sm" type="button" className="gap-2 text-xs">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Library
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={isSaving}
            className="btn-primary gap-2 text-xs"
          >
            {isSaving ? (
              <>
                <Spinner size="sm" /> Saving...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                {isEditing ? "Save Changes" : "Create Guardrail Policy"}
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: General & Engine Type */}
        <div className="lg:col-span-2 space-y-6">
          {/* General Metadata */}
          <div className="p-6 rounded-2xl bg-bg-surface border border-border/40 space-y-4">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-accent" />
              General Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Display Name</Label>
                <Input
                  required
                  placeholder="e.g. PCI-DSS Payment & PII Shield"
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    if (!isEditing && !name) {
                      setName(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "_")
                          .replace(/^_+|_+$/g, "")
                      );
                    }
                  }}
                  className="text-xs bg-bg-base border-border/40"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Unique Identifier (Slug)</Label>
                <Input
                  required
                  placeholder="e.g. payment_pii_shield"
                  value={name}
                  onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  className="text-xs font-mono bg-bg-base border-border/40"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                rows={2}
                placeholder="Describe what threats or compliance policies this guardrail enforces..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-xs bg-bg-base border-border/40"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/30">
              {/* Interception Stage */}
              <div className="space-y-1.5">
                <Label className="text-xs">Execution Stage</Label>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value as GuardrailStage)}
                  className="w-full h-9 rounded-xl border border-border/40 bg-bg-base px-3 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="ingress">Ingress (User Messages & Perimeter)</option>
                  <option value="pre_tool">Pre-Tool (Before Tools Execute)</option>
                  <option value="egress">Egress (Final Assistant Response)</option>
                </select>
              </div>

              {/* Guardrail Engine Type (11-Engine Suite) */}
              <div className="space-y-1.5">
                <Label className="text-xs">Guardrail Engine Type</Label>
                <select
                  value={guardrailType}
                  onChange={(e) => setGuardrailType(e.target.value as GuardrailType)}
                  className="w-full h-9 rounded-xl border border-border/40 bg-bg-base px-3 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent font-medium text-accent"
                >
                  <optgroup label="Tier 1: Deterministic (0ms Latency)">
                    <option value="pii">PII Redactor / Blocker</option>
                    <option value="keyword">Keyword & Competitor Filter</option>
                    <option value="regex">Custom Regular Expressions</option>
                    <option value="structure">Structure & Message Size Limiter</option>
                  </optgroup>
                  <optgroup label="Tier 2: Specialized AI & Embeddings">
                    <option value="moderation">Content Moderation (OpenAI Safety API)</option>
                    <option value="embedding">Semantic Embedding Cluster Similarity</option>
                  </optgroup>
                  <optgroup label="Tier 3: Reasoning & Groundedness">
                    <option value="llm_judge">LLM Policy & Jailbreak Judge</option>
                    <option value="hallucination">Hallucination & Fact Checker (RAG)</option>
                  </optgroup>
                  <optgroup label="Tier 4: Programmable & Integration">
                    <option value="json_schema">JSON Schema Validator (Tool Args)</option>
                    <option value="code_sandbox">Custom Python Sandbox Script</option>
                    <option value="webhook">Remote Webhook Risk Validator</option>
                  </optgroup>
                </select>
              </div>
            </div>
          </div>

          {/* Engine Dynamic Configuration Panel */}
          <div className="p-6 rounded-2xl bg-bg-surface border border-border/40 space-y-4">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Lock className="w-4 h-4 text-accent" />
              Engine Rules & Thresholds
            </h3>

            {/* 1. PII Redactor */}
            {guardrailType === "pii" && (
              <div className="space-y-4">
                <p className="text-xs text-text-secondary">
                  Zero-latency deterministic filter that detects sensitive customer information.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <label className="flex items-start gap-3 p-3 rounded-xl bg-bg-base border border-border/30 cursor-pointer hover:border-border/60">
                    <input
                      type="checkbox"
                      checked={blockCreditCards}
                      onChange={(e) => setBlockCreditCards(e.target.checked)}
                      className="mt-0.5 rounded border-border text-accent focus:ring-accent"
                    />
                    <div>
                      <div className="text-xs font-semibold text-text-primary">Credit & Debit Cards</div>
                      <div className="text-[11px] text-text-muted">Matches Visa, Mastercard, Amex, Discover</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-xl bg-bg-base border border-border/30 cursor-pointer hover:border-border/60">
                    <input
                      type="checkbox"
                      checked={blockSsn}
                      onChange={(e) => setBlockSsn(e.target.checked)}
                      className="mt-0.5 rounded border-border text-accent focus:ring-accent"
                    />
                    <div>
                      <div className="text-xs font-semibold text-text-primary">Social Security Numbers (SSN)</div>
                      <div className="text-[11px] text-text-muted">Matches standard 9-digit SSN patterns</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-xl bg-bg-base border border-border/30 cursor-pointer hover:border-border/60">
                    <input
                      type="checkbox"
                      checked={blockEmails}
                      onChange={(e) => setBlockEmails(e.target.checked)}
                      className="mt-0.5 rounded border-border text-accent focus:ring-accent"
                    />
                    <div>
                      <div className="text-xs font-semibold text-text-primary">Email Addresses</div>
                      <div className="text-[11px] text-text-muted">Block unsolicited user email inputs</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-xl bg-bg-base border border-border/30 cursor-pointer hover:border-border/60">
                    <input
                      type="checkbox"
                      checked={blockPhones}
                      onChange={(e) => setBlockPhones(e.target.checked)}
                      className="mt-0.5 rounded border-border text-accent focus:ring-accent"
                    />
                    <div>
                      <div className="text-xs font-semibold text-text-primary">Phone Numbers</div>
                      <div className="text-[11px] text-text-muted">Matches standard international phone formats</div>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* 2. Keyword Filter */}
            {guardrailType === "keyword" && (
              <div className="space-y-4">
                <p className="text-xs text-text-secondary">
                  Specify prohibited words, competitor brand names, or profanities.
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Type keyword and press Add..."
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddKeyword();
                      }
                    }}
                    className="text-xs bg-bg-base border-border/40"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handleAddKeyword} className="text-xs gap-1">
                    <Plus className="w-3.5 h-3.5" /> Add
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="case_sensitive"
                    checked={caseSensitive}
                    onChange={(e) => setCaseSensitive(e.target.checked)}
                    className="rounded border-border text-accent focus:ring-accent"
                  />
                  <Label htmlFor="case_sensitive" className="text-xs cursor-pointer">
                    Exact Case Sensitive Matching
                  </Label>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1 min-h-[48px] p-3 rounded-xl bg-bg-base border border-border/30">
                  {blockedKeywords.length === 0 ? (
                    <span className="text-xs text-text-muted italic">No blocked keywords added yet.</span>
                  ) : (
                    blockedKeywords.map((kw) => (
                      <span
                        key={kw}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-red-500/10 text-red-400 border border-red-500/20"
                      >
                        {kw}
                        <button
                          type="button"
                          onClick={() => handleRemoveKeyword(kw)}
                          className="hover:text-red-300 ml-0.5"
                        >
                          &times;
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 3. Regex Patterns */}
            {guardrailType === "regex" && (
              <div className="space-y-4">
                <p className="text-xs text-text-secondary">
                  Evaluate messages against custom regex expressions (e.g. internal employee IDs or token formats).
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. ^ACCT-[0-9]{8}$"
                    value={newRegex}
                    onChange={(e) => setNewRegex(e.target.value)}
                    className="text-xs font-mono bg-bg-base border-border/40"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handleAddRegex} className="text-xs gap-1">
                    <Plus className="w-3.5 h-3.5" /> Add Pattern
                  </Button>
                </div>

                <div className="space-y-2 pt-1">
                  {regexPatterns.map((pat) => (
                    <div
                      key={pat}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-bg-base border border-border/30 font-mono text-xs text-text-primary"
                    >
                      <span>{pat}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveRegex(pat)}
                        className="text-text-muted hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Message Structure & Size */}
            {guardrailType === "structure" && (
              <div className="space-y-4">
                <p className="text-xs text-text-secondary">
                  Enforce message length boundaries and detect repetition spam loops.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Minimum Characters (Optional)</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 2"
                      value={minChars}
                      onChange={(e) => setMinChars(e.target.value)}
                      className="text-xs bg-bg-base border-border/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Maximum Characters</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 4000"
                      value={maxChars}
                      onChange={(e) => setMaxChars(Number(e.target.value))}
                      className="text-xs bg-bg-base border-border/40"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Max Consecutive Repeating Chars</Label>
                    <Input
                      type="number"
                      value={maxRepChars}
                      onChange={(e) => setMaxRepChars(Number(e.target.value))}
                      className="text-xs bg-bg-base border-border/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Max Allowed Line Breaks</Label>
                    <Input
                      type="number"
                      value={maxNewlines}
                      onChange={(e) => setMaxNewlines(Number(e.target.value))}
                      className="text-xs bg-bg-base border-border/40"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={detectRepetition}
                    onChange={(e) => setDetectRepetition(e.target.checked)}
                    className="rounded border-border text-accent focus:ring-accent"
                  />
                  <span className="text-xs text-text-primary">Enable Repetition Spam Filter</span>
                </label>
              </div>
            )}

            {/* 5. Content Moderation */}
            {guardrailType === "moderation" && (
              <div className="space-y-4">
                <p className="text-xs text-text-secondary">
                  Automatically flags hate, harassment, self-harm, sexual, or violent content via OpenAI's Moderation API.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {["hate", "harassment", "self-harm", "sexual", "violence"].map((cat) => (
                    <label
                      key={cat}
                      className="flex items-center gap-2 p-3 rounded-xl bg-bg-base border border-border/30 cursor-pointer hover:border-border/60"
                    >
                      <input
                        type="checkbox"
                        checked={modCategories.includes(cat)}
                        onChange={() => toggleModCategory(cat)}
                        className="rounded border-border text-accent focus:ring-accent"
                      />
                      <span className="text-xs font-semibold text-text-primary capitalize">{cat}</span>
                    </label>
                  ))}
                </div>

                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-xs">
                    <Label>Confidence Threshold</Label>
                    <span className="font-mono text-accent">{modThreshold}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={modThreshold}
                    onChange={(e) => setModThreshold(parseFloat(e.target.value))}
                    className="w-full accent-accent"
                  />
                </div>
              </div>
            )}

            {/* 6. Semantic Embedding */}
            {guardrailType === "embedding" && (
              <div className="space-y-4">
                <p className="text-xs text-text-secondary">
                  Vector distance guardrail that blocks inputs conceptually close to forbidden topic clusters.
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. 'medical diagnosis advice' or 'crypto investment'"
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    className="text-xs bg-bg-base border-border/40"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handleAddTopic} className="text-xs gap-1">
                    <Plus className="w-3.5 h-3.5" /> Add Topic
                  </Button>
                </div>

                <div className="space-y-2">
                  {forbiddenTopics.map((top) => (
                    <div
                      key={top}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-bg-base border border-border/30 text-xs text-text-primary"
                    >
                      <span>{top}</span>
                      <button type="button" onClick={() => handleRemoveTopic(top)} className="text-text-muted hover:text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-xs">
                    <Label>Cosine Similarity Threshold (Default: 0.75)</Label>
                    <span className="font-mono text-accent">{embedThreshold}</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="0.95"
                    step="0.01"
                    value={embedThreshold}
                    onChange={(e) => setEmbedThreshold(parseFloat(e.target.value))}
                    className="w-full accent-accent"
                  />
                </div>
              </div>
            )}

            {/* 7. LLM Judge */}
            {guardrailType === "llm_judge" && (
              <div className="space-y-4">
                <p className="text-xs text-text-secondary">
                  Reasoning AI judge that evaluates conversation context against natural language rules.
                </p>
                <label className="flex items-center gap-2 p-3 rounded-xl bg-bg-base border border-border/30 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={promptInjectionShield}
                    onChange={(e) => setPromptInjectionShield(e.target.checked)}
                    className="rounded border-border text-accent focus:ring-accent"
                  />
                  <div>
                    <div className="text-xs font-semibold text-text-primary">Prompt Injection & Jailbreak Firewall</div>
                    <div className="text-[11px] text-text-muted">Analyzes adversarial attempts to bypass system directives</div>
                  </div>
                </label>

                <div className="space-y-2">
                  <Label className="text-xs">Custom Business Rules</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. Never process refunds exceeding $200"
                      value={newRule}
                      onChange={(e) => setNewRule(e.target.value)}
                      className="text-xs bg-bg-base border-border/40"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={handleAddRule} className="text-xs gap-1">
                      <Plus className="w-3.5 h-3.5" /> Add Rule
                    </Button>
                  </div>

                  <div className="space-y-2 pt-1">
                    {llmRules.map((rule) => (
                      <div
                        key={rule}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-bg-base border border-border/30 text-xs text-text-primary"
                      >
                        <span>{rule}</span>
                        <button type="button" onClick={() => handleRemoveRule(rule)} className="text-text-muted hover:text-red-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <ModelSelector
                    value={judgeModel}
                    onChange={setJudgeModel}
                    label="Judge Model"
                  />
                </div>
              </div>
            )}

            {/* 8. Hallucination Groundedness */}
            {guardrailType === "hallucination" && (
              <div className="space-y-4">
                <p className="text-xs text-text-secondary">
                  Ensures assistant responses only assert claims that are directly supported by retrieved reference documents.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Strictness Level</Label>
                    <select
                      value={hallucinationStrictness}
                      onChange={(e) => setHallucinationStrictness(e.target.value as any)}
                      className="w-full h-9 rounded-xl border border-border/40 bg-bg-base px-3 text-xs text-text-primary"
                    >
                      <option value="moderate">Moderate (Allow general courteous framing)</option>
                      <option value="strict">Strict (100% strict context fidelity)</option>
                    </select>
                  </div>
                  <div>
                    <ModelSelector
                      value={hallucinationModel}
                      onChange={setHallucinationModel}
                      label="Judge Model"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 p-3 rounded-xl bg-bg-base border border-border/30 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireGrounding}
                    onChange={(e) => setRequireGrounding(e.target.checked)}
                    className="rounded border-border text-accent focus:ring-accent"
                  />
                  <span className="text-xs text-text-primary">Require explicit factual support from RAG chunks</span>
                </label>
              </div>
            )}

            {/* 9. JSON Schema */}
            {guardrailType === "json_schema" && (
              <div className="space-y-4">
                <p className="text-xs text-text-secondary">
                  Validates structured payloads (such as tool arguments) against standard Draft-7 JSON Schema.
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs">Validation Target</Label>
                  <select
                    value={schemaTarget}
                    onChange={(e) => setSchemaTarget(e.target.value as any)}
                    className="w-full h-9 rounded-xl border border-border/40 bg-bg-base px-3 text-xs text-text-primary"
                  >
                    <option value="tool_args">Tool Call Arguments (Pre-Tool)</option>
                    <option value="assistant_output">Assistant JSON Output (Egress)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">JSON Schema (Draft-7)</Label>
                  <Textarea
                    rows={8}
                    value={schemaJsonText}
                    onChange={(e) => setSchemaJsonText(e.target.value)}
                    className="text-xs font-mono bg-bg-base border-border/40"
                  />
                </div>
              </div>
            )}

            {/* 10. Code Sandbox */}
            {guardrailType === "code_sandbox" && (
              <div className="space-y-4">
                <p className="text-xs text-text-secondary">
                  Execute custom Python verification logic in a secure sandboxed environment.
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs">Validation Python Function (must define validate(text, tool_calls))</Label>
                  <Textarea
                    rows={8}
                    value={pythonCode}
                    onChange={(e) => setPythonCode(e.target.value)}
                    className="text-xs font-mono bg-bg-base border-border/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Execution Timeout (Seconds)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="10"
                    value={sandboxTimeout}
                    onChange={(e) => setSandboxTimeout(Number(e.target.value))}
                    className="text-xs bg-bg-base border-border/40"
                  />
                </div>
              </div>
            )}

            {/* 11. Webhook */}
            {guardrailType === "webhook" && (
              <div className="space-y-4">
                <p className="text-xs text-text-secondary">
                  Dispatches requests to an external HTTP compliance microservice.
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs">Verification Endpoint URL</Label>
                  <Input
                    type="url"
                    placeholder="https://api.internal.org/v1/compliance-check"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="text-xs font-mono bg-bg-base border-border/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Request Timeout (Seconds)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={webhookTimeout}
                    onChange={(e) => setWebhookTimeout(Number(e.target.value))}
                    className="text-xs bg-bg-base border-border/40"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Violation Action & Refusal Response */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-bg-surface border border-border/40 space-y-4">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-accent" />
              Violation Handling
            </h3>

            <div className="space-y-1.5">
              <Label className="text-xs">Action on Violation</Label>
              <select
                value={actionOnViolation}
                onChange={(e) => setActionOnViolation(e.target.value as ActionOnViolation)}
                className="w-full h-9 rounded-xl border border-border/40 bg-bg-base px-3 text-xs text-text-primary"
              >
                <option value="block_and_respond">Block & Deliver Refusal Response</option>
                <option value="escalate_to_human">Escalate to Human Agent</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Refusal Message to User</Label>
              <Textarea
                rows={4}
                value={refusalMessage}
                onChange={(e) => setRefusalMessage(e.target.value)}
                placeholder="Message presented to user if this policy triggers..."
                className="text-xs bg-bg-base border-border/40"
              />
            </div>

            <div className="pt-3 border-t border-border/30">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent"
                />
                <span className="text-xs font-medium text-text-primary">Policy is Active</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
