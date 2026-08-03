"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { knowledgeBasesApi, KnowledgeBase, KnowledgeBaseCreate } from "@/lib/api/knowledge-bases";
import { toolsApi } from "@/lib/api/tools";
import {
  BookOpen,
  Plus,
  RefreshCw,
  Search,
  FileText,
  Layers,
  Wrench,
  Trash2,
  ExternalLink,
  Sparkles,
  Sliders,
  X,
  CheckCircle2,
} from "lucide-react";

export default function KnowledgeBasesPage() {
  const router = useRouter();
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [creatingToolForKbId, setCreatingToolForKbId] = useState<string | null>(null);
  const [toolCreatedSuccess, setToolCreatedSuccess] = useState<string | null>(null);

  // New KB Form state
  const [formData, setFormData] = useState<KnowledgeBaseCreate>({
    name: "",
    description: "",
    embedding_model: "text-embedding-3-small",
    chunk_size: 500,
    chunk_overlap: 50,
  });

  const fetchKnowledgeBases = async () => {
    try {
      setIsLoading(true);
      const data = await knowledgeBasesApi.list();
      setKnowledgeBases(data);
    } catch (err) {
      console.error("Failed to fetch knowledge bases:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKnowledgeBases();
  }, []);

  const handleCreateKnowledgeBase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      setIsCreating(true);
      const newKb = await knowledgeBasesApi.create(formData);
      setIsCreateModalOpen(false);
      setFormData({
        name: "",
        description: "",
        embedding_model: "text-embedding-3-small",
        chunk_size: 500,
        chunk_overlap: 50,
      });
      // Navigate to detail page immediately so they can upload their first document
      router.push(`/dashboard/knowledge-bases/${newKb.id}`);
    } catch (err: any) {
      alert(err.message || "Failed to create knowledge base.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteKnowledgeBase = async (kbId: string, kbName: string) => {
    if (
      !confirm(
        `Are you sure you want to delete '${kbName}'? All associated documents and vector chunks will be permanently removed.`
      )
    ) {
      return;
    }

    try {
      await knowledgeBasesApi.delete(kbId);
      setKnowledgeBases((prev) => prev.filter((k) => k.id !== kbId));
    } catch (err) {
      alert("Failed to delete knowledge base.");
    }
  };

  const handleQuickCreateTool = async (kb: KnowledgeBase) => {
    try {
      setCreatingToolForKbId(kb.id);
      const toolSlug = `search_${kb.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "knowledge_base"}`;

      await toolsApi.create({
        name: toolSlug,
        display_name: `Search ${kb.name}`,
        description: kb.description
          ? `Search ${kb.name} knowledge base: ${kb.description}`
          : `Search ${kb.name} knowledge base for policies, guides, and reference documents.`,
        tool_type: "rag_retriever",
        config: {
          kb_id: kb.id,
          top_k: 4,
          similarity_threshold: 0.0,
        },
        parameters_schema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The question or search query to look up in the knowledge base.",
            },
          },
          required: ["query"],
        },
      });

      setToolCreatedSuccess(kb.id);
      setTimeout(() => setToolCreatedSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || "Failed to create RAG search tool.");
    } finally {
      setCreatingToolForKbId(null);
    }
  };

  const filteredKbs = knowledgeBases.filter((kb) => {
    const q = searchQuery.toLowerCase();
    return (
      kb.name.toLowerCase().includes(q) ||
      (kb.description && kb.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Knowledge Bases"
        description="Organize documents, policies, and reference guides into vector repositories and connect them to specialist agents as callable search tools."
        action={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchKnowledgeBases}
              disabled={isLoading}
              className="gap-2 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="btn-primary gap-2 text-xs"
            >
              <Plus className="w-4 h-4" /> New Knowledge Base
            </Button>
          </div>
        }
      />

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search knowledge bases by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-bg-surface border border-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/40 transition-all"
          />
        </div>
      </div>

      {/* Grid of Knowledge Bases */}
      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-3">
          <Spinner size="lg" className="text-accent" />
          <p className="text-xs text-text-muted">Loading knowledge bases...</p>
        </div>
      ) : filteredKbs.length === 0 ? (
        <div className="border border-border/80 border-dashed rounded-2xl p-12 text-center bg-bg-surface/30 backdrop-blur-sm space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-accent-muted border border-accent/20 text-accent flex items-center justify-center mx-auto shadow-sm">
            <BookOpen className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-sm font-semibold text-text-primary">
              {searchQuery ? "No matching knowledge bases found" : "No Knowledge Bases yet"}
            </h3>
            <p className="text-xs text-text-muted leading-relaxed">
              {searchQuery
                ? "Try adjusting your search query."
                : "Create your first knowledge base to upload policy PDFs, Markdown guides, or FAQ lists and empower your agents with accurate semantic search."}
            </p>
          </div>
          {!searchQuery && (
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="btn-primary gap-2 text-xs text-center"
            >
              <Plus className="w-4 h-4" /> Create First Knowledge Base
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredKbs.map((kb) => (
            <div
              key={kb.id}
              className="group relative bg-bg-surface border border-border hover:border-accent/30 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 hover:shadow-lg hover:shadow-accent/5"
            >
              <div className="space-y-4">
                {/* Header: Title & Model */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent-muted border border-accent/20 text-accent flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors truncate">
                        {kb.name}
                      </h3>
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-text-muted">
                        <Sparkles className="w-3 h-3 text-accent" />
                        {kb.embedding_model}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteKnowledgeBase(kb.id, kb.name)}
                    title="Delete Knowledge Base"
                    className="text-text-muted hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Description */}
                <p className="text-xs text-text-secondary line-clamp-2 min-h-[2rem]">
                  {kb.description || "No description provided."}
                </p>

                {/* Stats Badges */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60">
                  <div className="flex items-center gap-2 bg-bg-base/60 px-3 py-2 rounded-lg border border-border/40">
                    <FileText className="w-3.5 h-3.5 text-accent" />
                    <div>
                      <div className="text-[11px] font-semibold text-text-primary">
                        {kb.document_count}
                      </div>
                      <div className="text-[10px] text-text-muted">Documents</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-bg-base/60 px-3 py-2 rounded-lg border border-border/40">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    <div>
                      <div className="text-[11px] font-semibold text-text-primary">
                        {kb.total_chunks}
                      </div>
                      <div className="text-[10px] text-text-muted">Vector Chunks</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-5 mt-4 border-t border-border/60 flex items-center justify-between gap-2">
                <Link
                  href={`/dashboard/knowledge-bases/${kb.id}`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-bg-elevated/70 text-text-primary hover:bg-bg-elevated hover:text-accent border border-border transition-all"
                >
                  <span>Manage & Search</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuickCreateTool(kb)}
                  disabled={creatingToolForKbId === kb.id}
                  title="Create a callable RAG Tool in Tools Hub for this Knowledge Base"
                  className="gap-1.5 text-xs text-text-secondary hover:text-accent shrink-0"
                >
                  {creatingToolForKbId === kb.id ? (
                    <Spinner size="sm" />
                  ) : toolCreatedSuccess === kb.id ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Created!</span>
                    </>
                  ) : (
                    <>
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Create Tool</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Knowledge Base Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-accent-muted border border-accent/20 text-accent flex items-center justify-center">
                  <BookOpen className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    Create Knowledge Base
                  </h3>
                  <p className="text-[11px] text-text-muted">
                    Set up a new isolated domain knowledge repository.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-text-muted hover:text-text-primary p-1.5 rounded-lg hover:bg-bg-elevated transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateKnowledgeBase} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-primary">
                  Knowledge Base Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Return & Warranty Policies"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-bg-base border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/40"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-primary">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Explain what topics or documents this knowledge base covers so agents know when to query it..."
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-bg-base border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/40 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-primary">
                    Embedding Model
                  </label>
                  <select
                    value={formData.embedding_model}
                    onChange={(e) => setFormData({ ...formData, embedding_model: e.target.value })}
                    className="w-full bg-bg-base border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary focus:outline-none focus:border-accent/40"
                  >
                    <option value="text-embedding-3-small">text-embedding-3-small (Fast & Cost-effective)</option>
                    <option value="text-embedding-3-large">text-embedding-3-large (Highest Accuracy)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-primary flex items-center justify-between">
                    <span>Chunk Size (chars)</span>
                    <span className="text-[11px] font-mono text-accent">{formData.chunk_size}</span>
                  </label>
                  <input
                    type="number"
                    min={100}
                    max={2000}
                    step={50}
                    value={formData.chunk_size}
                    onChange={(e) => setFormData({ ...formData, chunk_size: Number(e.target.value) })}
                    className="w-full bg-bg-base border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary focus:outline-none focus:border-accent/40"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-accent-muted/40 border border-accent/20 flex items-start gap-2.5 text-[11px] text-text-secondary leading-relaxed">
                <Sliders className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <span>
                  After creating this knowledge base, you can upload PDFs, Markdown guides, and raw text. You can also view chunks, delete obsolete versions, or generate a callable RAG tool with 1 click.
                </span>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isCreating || !formData.name.trim()}
                  className="btn-primary gap-2 text-xs"
                >
                  {isCreating ? <Spinner size="sm" /> : <Plus className="w-3.5 h-3.5" />}
                  Create & Open
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
