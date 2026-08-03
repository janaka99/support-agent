"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  knowledgeBasesApi,
  KnowledgeBase,
  KnowledgeDocument,
  DocumentChunk,
  SemanticSearchResult,
} from "@/lib/api/knowledge-bases";
import { toolsApi } from "@/lib/api/tools";
import {
  BookOpen,
  ArrowLeft,
  Upload,
  FileText,
  Trash2,
  Eye,
  Search,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  RefreshCw,
  X,
  FileUp,
  FileCode,
  Wrench,
  Sliders,
  Copy,
} from "lucide-react";

export default function KnowledgeBaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const kbId = params.id as string;

  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"documents" | "search" | "settings">("documents");

  // Document Upload Modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<"file" | "text">("file");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customDocTitle, setCustomDocTitle] = useState("");
  const [pastedTextContent, setPastedTextContent] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chunk Inspection Modal state
  const [selectedDocForChunks, setSelectedDocForChunks] = useState<KnowledgeDocument | null>(null);
  const [docChunks, setDocChunks] = useState<DocumentChunk[]>([]);
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);

  // Semantic Search Playground state
  const [searchQuery, setSearchQuery] = useState("");
  const [topK, setTopK] = useState(4);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.0);
  const [searchResults, setSearchResults] = useState<SemanticSearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Quick Tool Creation state
  const [isCreatingTool, setIsCreatingTool] = useState(false);
  const [toolCreatedSuccess, setToolCreatedSuccess] = useState(false);

  // KB Settings edit state
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editChunkSize, setEditChunkSize] = useState(500);
  const [editOverlap, setEditOverlap] = useState(50);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const fetchKbAndDocs = async () => {
    try {
      setIsLoading(true);
      const [kbData, docsData] = await Promise.all([
        knowledgeBasesApi.get(kbId),
        knowledgeBasesApi.listDocuments(kbId),
      ]);
      setKb(kbData);
      setDocuments(docsData);
      setEditName(kbData.name);
      setEditDesc(kbData.description || "");
      setEditChunkSize(kbData.chunk_size);
      setEditOverlap(kbData.chunk_overlap);
    } catch (err) {
      console.error("Failed to load knowledge base data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (kbId) {
      fetchKbAndDocs();
    }
  }, [kbId]);

  // Auto-poll when any document is in 'pending' or 'indexing' state
  useEffect(() => {
    const hasActiveJobs = documents.some(
      (d) => d.status === "pending" || d.status === "indexing"
    );
    if (!hasActiveJobs) return;

    const interval = setInterval(async () => {
      try {
        const [docsData, kbData] = await Promise.all([
          knowledgeBasesApi.listDocuments(kbId),
          knowledgeBasesApi.get(kbId),
        ]);
        setDocuments(docsData);
        setKb(kbData);
      } catch (err) {
        console.error("Failed to poll documents:", err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [documents, kbId]);

  const handleCancelDocument = async (docId: string) => {
    try {
      const updated = await knowledgeBasesApi.cancelDocument(kbId, docId);
      setDocuments((prev) => prev.map((d) => (d.id === docId ? updated : d)));
    } catch (err: any) {
      alert(err.message || "Failed to cancel document indexing.");
    }
  };

  const handleRetryDocument = async (docId: string) => {
    try {
      const updated = await knowledgeBasesApi.retryDocument(kbId, docId);
      setDocuments((prev) => prev.map((d) => (d.id === docId ? updated : d)));
    } catch (err: any) {
      alert(err.message || "Failed to retry document indexing.");
    }
  };

  const handleFileUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadMethod === "file") {
      if (!selectedFile) return;
      try {
        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", selectedFile);
        if (customDocTitle.trim()) {
          formData.append("title", customDocTitle.trim());
        }
        await knowledgeBasesApi.uploadDocument(kbId, formData);
        setIsUploadModalOpen(false);
        setSelectedFile(null);
        setCustomDocTitle("");
        await fetchKbAndDocs();
      } catch (err: any) {
        alert(err.message || "Failed to process and index document.");
      } finally {
        setIsUploading(false);
      }
    } else {
      if (!customDocTitle.trim() || !pastedTextContent.trim()) return;
      try {
        setIsUploading(true);
        await knowledgeBasesApi.createTextDocument(kbId, {
          title: customDocTitle.trim(),
          content: pastedTextContent.trim(),
        });
        setIsUploadModalOpen(false);
        setCustomDocTitle("");
        setPastedTextContent("");
        await fetchKbAndDocs();
      } catch (err: any) {
        alert(err.message || "Failed to index text document.");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleDeleteDocument = async (docId: string, docTitle: string) => {
    if (
      !confirm(
        `Are you sure you want to delete '${docTitle}'? This will permanently purge all of its vector embeddings from the knowledge base.`
      )
    ) {
      return;
    }

    try {
      await knowledgeBasesApi.deleteDocument(kbId, docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      if (kb) {
        setKb({
          ...kb,
          document_count: Math.max(0, kb.document_count - 1),
        });
      }
    } catch (err) {
      alert("Failed to delete document.");
    }
  };

  const handleInspectChunks = async (doc: KnowledgeDocument) => {
    setSelectedDocForChunks(doc);
    setIsLoadingChunks(true);
    try {
      const chunks = await knowledgeBasesApi.getDocumentChunks(kbId, doc.id);
      setDocChunks(chunks);
    } catch (err) {
      console.error("Failed to load document chunks:", err);
    } finally {
      setIsLoadingChunks(false);
    }
  };

  const handleRunSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setIsSearching(true);
      const results = await knowledgeBasesApi.search(kbId, {
        query: searchQuery.trim(),
        top_k: topK,
        similarity_threshold: similarityThreshold,
      });
      setSearchResults(results);
    } catch (err: any) {
      alert(err.message || "Search failed.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleCreateRagTool = async () => {
    if (!kb) return;
    try {
      setIsCreatingTool(true);
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

      setToolCreatedSuccess(true);
      setTimeout(() => setToolCreatedSuccess(false), 5000);
    } catch (err: any) {
      alert(err.message || "Failed to create tool in Tools Hub.");
    } finally {
      setIsCreatingTool(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingSettings(true);
      const updated = await knowledgeBasesApi.update(kbId, {
        name: editName,
        description: editDesc,
        chunk_size: editChunkSize,
        chunk_overlap: editOverlap,
      });
      setKb(updated);
      alert("Settings saved successfully.");
    } catch (err: any) {
      alert(err.message || "Failed to save settings.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-32 flex flex-col items-center justify-center space-y-3">
        <Spinner size="lg" className="text-accent" />
        <p className="text-xs text-text-muted">Loading knowledge base...</p>
      </div>
    );
  }

  if (!kb) {
    return (
      <div className="text-center py-20 space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
        <h3 className="text-sm font-semibold text-text-primary">Knowledge Base Not Found</h3>
        <Link href="/dashboard/knowledge-bases">
          <Button size="sm" variant="outline" className="text-xs">
            Back to Knowledge Bases
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/knowledge-bases"
          className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Knowledge Bases</span>
        </Link>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchKbAndDocs}
            className="gap-2 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>

          <Button
            size="sm"
            onClick={handleCreateRagTool}
            disabled={isCreatingTool}
            className="gap-2 text-xs bg-indigo-600/80 hover:bg-indigo-600 text-white border border-indigo-500/30"
          >
            {isCreatingTool ? (
              <Spinner size="sm" />
            ) : toolCreatedSuccess ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                <span>Tool Created in Tools Hub!</span>
              </>
            ) : (
              <>
                <Wrench className="w-3.5 h-3.5" />
                <span>Create Agent Tool</span>
              </>
            )}
          </Button>

          <Button
            size="sm"
            onClick={() => setIsUploadModalOpen(true)}
            className="btn-primary gap-2 text-xs"
          >
            <Upload className="w-3.5 h-3.5" /> Add Documents
          </Button>
        </div>
      </div>

      {/* Hero Card */}
      <div className="bg-bg-surface border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-accent-muted border border-accent/20 text-accent flex items-center justify-center shrink-0 shadow-sm">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-bold text-text-primary">{kb.name}</h1>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-accent-muted text-accent border border-accent/20">
                  {kb.embedding_model}
                </span>
              </div>
              <p className="text-xs text-text-muted max-w-2xl">
                {kb.description || "No description provided."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-bg-base px-4 py-2.5 rounded-xl border border-border text-center">
              <div className="text-sm font-bold text-text-primary">{documents.length}</div>
              <div className="text-[10px] text-text-muted">Documents</div>
            </div>
            <div className="bg-bg-base px-4 py-2.5 rounded-xl border border-border text-center">
              <div className="text-sm font-bold text-text-primary">
                {documents.reduce((acc, d) => acc + d.chunk_count, 0)}
              </div>
              <div className="text-[10px] text-text-muted">Vector Chunks</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-border">
          <button
            onClick={() => setActiveTab("documents")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === "documents"
                ? "bg-accent-muted text-accent border border-accent/30 shadow-sm"
                : "text-text-muted hover:text-text-primary hover:bg-bg-elevated"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Documents ({documents.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("search")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === "search"
                ? "bg-accent-muted text-accent border border-accent/30 shadow-sm"
                : "text-text-muted hover:text-text-primary hover:bg-bg-elevated"
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Semantic Search Playground</span>
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === "settings"
                ? "bg-accent-muted text-accent border border-accent/30 shadow-sm"
                : "text-text-muted hover:text-text-primary hover:bg-bg-elevated"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Documents Management */}
      {activeTab === "documents" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Indexed Documents
            </h3>
            <span className="text-[11px] text-text-muted">
              Deleting an outdated document immediately removes all of its vector chunks.
            </span>
          </div>

          {documents.length === 0 ? (
            <div className="border border-border/80 border-dashed rounded-2xl p-12 text-center bg-bg-surface/30 space-y-4">
              <FileUp className="w-10 h-10 text-text-muted mx-auto" />
              <div className="max-w-sm mx-auto space-y-1">
                <h4 className="text-sm font-semibold text-text-primary">No documents indexed</h4>
                <p className="text-xs text-text-muted">
                  Upload PDF policies, Markdown manuals, or paste raw text to start semantic search.
                </p>
              </div>
              <Button
                onClick={() => setIsUploadModalOpen(true)}
                className="btn-primary gap-2 text-xs"
              >
                <Upload className="w-3.5 h-3.5" /> Upload Document
              </Button>
            </div>
          ) : (
            <div className="bg-bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-bg-base/80 border-b border-border text-text-muted font-medium">
                    <tr>
                      <th className="py-3 px-4">Document Title</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Chunks</th>
                      <th className="py-3 px-4">Indexed Date</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-bg-elevated/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-accent-muted/60 border border-accent/20 text-accent flex items-center justify-center shrink-0">
                              <FileText className="w-3.5 h-3.5" />
                            </div>
                            <span className="font-medium text-text-primary">{doc.title}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-bg-base border border-border text-text-secondary">
                            {doc.source_type}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {doc.status === "ready" ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Ready
                            </span>
                          ) : doc.status === "indexing" ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                              <Spinner size="default" className="w-3 h-3 text-blue-400" />
                              <span>Indexing {doc.processing_progress ? `${doc.processing_progress}%` : ""}</span>
                            </span>
                          ) : doc.status === "pending" ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                              <Clock className="w-3.5 h-3.5 animate-pulse shrink-0" /> Queued
                            </span>
                          ) : doc.status === "cancelled" ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-text-muted bg-bg-elevated px-2 py-0.5 rounded-full border border-border">
                              <X className="w-3.5 h-3.5 shrink-0" /> Cancelled
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 cursor-help"
                              title={doc.error_message || "Document indexing failed"}
                            >
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Failed
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-medium text-text-primary">
                          {doc.chunk_count}
                        </td>
                        <td className="py-3.5 px-4 text-text-muted">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {(doc.status === "pending" || doc.status === "indexing") && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCancelDocument(doc.id)}
                                title="Cancel ongoing indexing"
                                className="text-[11px] gap-1 h-7 px-2 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border-amber-500/20"
                              >
                                <X className="w-3 h-3" />
                                <span>Cancel</span>
                              </Button>
                            )}

                            {(doc.status === "error" || doc.status === "cancelled") && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRetryDocument(doc.id)}
                                title="Retry indexing this document"
                                className="text-[11px] gap-1 h-7 px-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 border-blue-500/20"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Retry</span>
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleInspectChunks(doc)}
                              disabled={doc.status !== "ready" || doc.chunk_count === 0}
                              title="View parsed text chunks"
                              className="text-[11px] gap-1.5 h-7 px-2.5 text-text-secondary hover:text-accent disabled:opacity-40"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Chunks</span>
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteDocument(doc.id, doc.title)}
                              title="Delete document & purge chunks"
                              className="text-[11px] h-7 px-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border-rose-500/20"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Semantic Search Playground */}
      {activeTab === "search" && (
        <div className="space-y-6">
          <div className="bg-bg-surface border border-border rounded-2xl p-6 space-y-5 shadow-sm">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <Search className="w-4 h-4 text-accent" />
                Live Vector Semantic Search
              </h3>
              <p className="text-xs text-text-muted">
                Test your knowledge base retrieval with natural language queries to see top chunk matches and cosine similarity scores.
              </p>
            </div>

            <form onSubmit={handleRunSearch} className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. What is the return window for electronics and are there restocking fees?"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-bg-base border border-border rounded-xl px-4 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/40"
                />
                <Button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="btn-primary gap-2 text-xs shrink-0 px-5"
                >
                  {isSearching ? <Spinner size="sm" /> : <Search className="w-4 h-4" />}
                  Search
                </Button>
              </div>

              <div className="flex items-center gap-6 pt-1 text-xs text-text-secondary">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-text-muted">Top K Matches:</span>
                  <select
                    value={topK}
                    onChange={(e) => setTopK(Number(e.target.value))}
                    className="bg-bg-base border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none"
                  >
                    <option value={2}>2 Chunks</option>
                    <option value={4}>4 Chunks (Default)</option>
                    <option value={8}>8 Chunks</option>
                    <option value={12}>12 Chunks</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-text-muted">Min Similarity:</span>
                  <select
                    value={similarityThreshold}
                    onChange={(e) => setSimilarityThreshold(Number(e.target.value))}
                    className="bg-bg-base border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none"
                  >
                    <option value={0.0}>0.0 (All top matches)</option>
                    <option value={0.3}>0.3 (Low threshold)</option>
                    <option value={0.5}>0.5 (Moderate)</option>
                    <option value={0.7}>0.7 (Strict)</option>
                  </select>
                </div>
              </div>
            </form>
          </div>

          {/* Search Results Display */}
          {searchResults && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Retrieval Results ({searchResults.length} matches)
                </h4>
              </div>

              {searchResults.length === 0 ? (
                <div className="border border-border rounded-xl p-8 text-center bg-bg-surface/50 text-xs text-text-muted">
                  No matching chunks exceeded the similarity threshold.
                </div>
              ) : (
                <div className="space-y-3">
                  {searchResults.map((res, i) => (
                    <div
                      key={res.chunk_id}
                      className="bg-bg-surface border border-border rounded-xl p-4.5 space-y-2.5 transition-all hover:border-accent/30"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-accent-muted text-accent font-mono text-[10px] flex items-center justify-center font-bold">
                            #{i + 1}
                          </span>
                          <span className="text-xs font-semibold text-text-primary">
                            {res.document_title}
                          </span>
                          <span className="text-[10px] font-mono text-text-muted">
                            (Chunk {res.chunk_index})
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <div className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {(res.similarity_score * 100).toFixed(1)}% Similarity
                          </div>
                        </div>
                      </div>

                      <div className="bg-bg-base/70 border border-border/60 rounded-lg p-3 text-xs text-text-secondary leading-relaxed font-mono whitespace-pre-wrap">
                        {res.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Settings */}
      {activeTab === "settings" && (
        <div className="bg-bg-surface border border-border rounded-2xl p-6 space-y-6 max-w-2xl shadow-sm">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-text-primary">Knowledge Base Settings</h3>
            <p className="text-xs text-text-muted">
              Configure chunking parameters and metadata for this repository.
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-primary">Knowledge Base Name</label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-bg-base border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary focus:outline-none focus:border-accent/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-primary">Description</label>
              <textarea
                rows={3}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full bg-bg-base border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary focus:outline-none focus:border-accent/40 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-primary">Target Chunk Size (chars)</label>
                <input
                  type="number"
                  min={100}
                  max={2000}
                  value={editChunkSize}
                  onChange={(e) => setEditChunkSize(Number(e.target.value))}
                  className="w-full bg-bg-base border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-primary">Chunk Overlap (chars)</label>
                <input
                  type="number"
                  min={0}
                  max={500}
                  value={editOverlap}
                  onChange={(e) => setEditOverlap(Number(e.target.value))}
                  className="w-full bg-bg-base border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={isSavingSettings}
                className="btn-primary gap-2 text-xs"
              >
                {isSavingSettings ? <Spinner size="sm" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Save Settings
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Upload / Add Document */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-bg-surface border border-border rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-accent-muted border border-accent/20 text-accent flex items-center justify-center">
                  <Upload className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Add Document</h3>
                  <p className="text-[11px] text-text-muted">
                    Index policies, manuals, or documentation into vector chunks.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="text-text-muted hover:text-text-primary p-1.5 rounded-lg hover:bg-bg-elevated transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Method Switcher */}
              <div className="grid grid-cols-2 gap-2 bg-bg-base p-1 rounded-xl border border-border">
                <button
                  type="button"
                  onClick={() => setUploadMethod("file")}
                  className={`py-1.5 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    uploadMethod === "file"
                      ? "bg-bg-surface text-text-primary shadow-sm"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  <FileUp className="w-3.5 h-3.5" />
                  <span>Upload File (.pdf, .md, .txt)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setUploadMethod("text")}
                  className={`py-1.5 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    uploadMethod === "text"
                      ? "bg-bg-surface text-text-primary shadow-sm"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Paste Text / Markdown</span>
                </button>
              </div>

              <form onSubmit={handleFileUploadSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-primary">
                    Document Title (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Return_Policy_v2.0"
                    value={customDocTitle}
                    onChange={(e) => setCustomDocTitle(e.target.value)}
                    className="w-full bg-bg-base border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary focus:outline-none focus:border-accent/40"
                  />
                </div>

                {uploadMethod === "file" ? (
                  <div className="space-y-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".pdf,.md,.txt,.json,.csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setSelectedFile(file);
                        if (file && !customDocTitle) {
                          setCustomDocTitle(file.name);
                        }
                      }}
                      className="hidden"
                    />

                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-border hover:border-accent/40 rounded-xl p-8 text-center cursor-pointer transition-colors bg-bg-base/50"
                    >
                      {selectedFile ? (
                        <div className="space-y-1.5">
                          <FileText className="w-8 h-8 text-accent mx-auto" />
                          <div className="text-xs font-semibold text-text-primary">
                            {selectedFile.name}
                          </div>
                          <div className="text-[10px] text-text-muted font-mono">
                            {(selectedFile.size / 1024).toFixed(1)} KB
                          </div>
                          <div className="text-[11px] text-accent font-medium pt-1">
                            Click to choose a different file
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="w-8 h-8 text-text-muted mx-auto" />
                          <div className="text-xs font-medium text-text-primary">
                            Click to select a document file
                          </div>
                          <div className="text-[10px] text-text-muted">
                            Supported: PDF (.pdf), Markdown (.md), Plain Text (.txt), CSV, JSON
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-primary">
                      Document Content <span className="text-rose-400">*</span>
                    </label>
                    <textarea
                      rows={8}
                      required
                      placeholder="Paste policy text, customer FAQs, or system guidelines here..."
                      value={pastedTextContent}
                      onChange={(e) => setPastedTextContent(e.target.value)}
                      className="w-full bg-bg-base border border-border rounded-xl p-3 text-xs text-text-primary focus:outline-none focus:border-accent/40 font-mono resize-none leading-relaxed"
                    />
                  </div>
                )}

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsUploadModalOpen(false)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={
                      isUploading ||
                      (uploadMethod === "file" && !selectedFile) ||
                      (uploadMethod === "text" && (!pastedTextContent.trim() || !customDocTitle.trim()))
                    }
                    className="btn-primary gap-2 text-xs"
                  >
                    {isUploading ? <Spinner size="sm" /> : <Upload className="w-3.5 h-3.5" />}
                    {isUploading ? "Chunking & Embedding..." : "Index Document"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Chunk Inspection Drawer / Modal */}
      {selectedDocForChunks && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-bg-surface border border-border rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Layers className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    Document Chunks: {selectedDocForChunks.title}
                  </h3>
                  <p className="text-[11px] text-text-muted">
                    {docChunks.length} vector chunks generated with {kb.chunk_size} char window.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDocForChunks(null)}
                className="text-text-muted hover:text-text-primary p-1.5 rounded-lg hover:bg-bg-elevated transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3.5 flex-1">
              {isLoadingChunks ? (
                <div className="py-16 flex flex-col items-center justify-center space-y-2">
                  <Spinner size="default" className="text-accent" />
                  <p className="text-xs text-text-muted">Loading chunks...</p>
                </div>
              ) : docChunks.length === 0 ? (
                <div className="py-12 text-center text-xs text-text-muted">
                  No chunks found for this document.
                </div>
              ) : (
                docChunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    className="bg-bg-base border border-border rounded-xl p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono font-semibold text-accent">
                        Chunk #{chunk.chunk_index + 1}
                      </span>
                      <span className="font-mono text-text-muted">
                        {chunk.content.length} characters
                      </span>
                    </div>
                    <div className="text-xs text-text-secondary font-mono leading-relaxed bg-bg-surface/60 p-3 rounded-lg border border-border/50 whitespace-pre-wrap">
                      {chunk.content}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-border flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedDocForChunks(null)}
                className="text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
