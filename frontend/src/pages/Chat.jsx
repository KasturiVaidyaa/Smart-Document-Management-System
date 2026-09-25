import { useEffect, useState, useRef, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../utils/api";
import { useWorkspace } from "../context/WorkspaceContext";
import ReactMarkdown from "react-markdown";
import {
  Edit2, Trash2, Check, X, Files, FileText, FolderOpen,
  ChevronDown, ChevronUp, MessageSquare, Send, Plus, Bot,
  Layers, Sparkles,
} from "lucide-react";

// ── Scope badge helper ───────────────────────────────────────────────────────
const ScopeBadge = ({ scope, name }) => {
  const map = {
    workspace: { label: "All docs", cls: "bg-zinc-800 text-zinc-400", icon: <Layers className="h-3 w-3" /> },
    document:  { label: name || "1 doc", cls: "bg-blue-900/30 text-blue-300", icon: <FileText className="h-3 w-3" /> },
    folder:    { label: name || "Folder", cls: "bg-violet-900/30 text-violet-300", icon: <FolderOpen className="h-3 w-3" /> },
    multi:     { label: name || "Selected docs", cls: "bg-indigo-900/30 text-indigo-300", icon: <Files className="h-3 w-3" /> },
  };
  const { label, cls, icon } = map[scope] || map.workspace;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {icon}{label}
    </span>
  );
};

const Chat = () => {
  const { currentWorkspaceId } = useWorkspace();
  const [searchParams] = useSearchParams();

  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const deepLinkHandled = useRef(false);

  // Rename
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editTitle, setEditTitle] = useState("");

  // Scope selector state
  const [scopeMode, setScopeMode] = useState("workspace"); // "workspace" | "docs" | "folder"
  const [allDocuments, setAllDocuments] = useState([]);
  const [allFolders, setAllFolders] = useState([]);
  const [selectedDocIds, setSelectedDocIds] = useState(new Set());
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [showScopeSelector, setShowScopeSelector] = useState(false);
  const [docSearchQuery, setDocSearchQuery] = useState("");

  // Folder summarize
  const [summarizing, setSummarizing] = useState(false);
  const [folderSummary, setFolderSummary] = useState("");

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); };
  useEffect(() => { scrollToBottom(); }, [messages, sending]);

  const loadDocuments = useCallback(async () => {
    if (!currentWorkspaceId) return;
    try {
      const { data } = await api.get(`/api/workspaces/${currentWorkspaceId}/documents`);
      setAllDocuments(data.documents || []);
    } catch { /* silent */ }
  }, [currentWorkspaceId]);

  const loadFolders = useCallback(async () => {
    if (!currentWorkspaceId) return;
    try {
      const { data } = await api.get(`/api/workspaces/${currentWorkspaceId}/folders`);
      setAllFolders(data.folders || []);
    } catch { /* silent */ }
  }, [currentWorkspaceId]);

  const loadSessions = useCallback(async () => {
    if (!currentWorkspaceId) return;
    const { data } = await api.get(`/api/workspaces/${currentWorkspaceId}/chat/sessions`);
    setSessions(data.sessions || []);
  }, [currentWorkspaceId]);

  const loadMessages = useCallback(async (id) => {
    if (!currentWorkspaceId || !id) { setMessages([]); return; }
    const { data } = await api.get(`/api/workspaces/${currentWorkspaceId}/chat/sessions/${id}/messages`);
    setMessages(data.messages || []);
  }, [currentWorkspaceId]);

  // Boot: load sessions, docs, folders; handle URL deep-links
  useEffect(() => {
    if (!currentWorkspaceId) return;
    loadSessions().catch(() => {});
    loadDocuments().catch(() => {});
    loadFolders().catch(() => {});

    const docId = searchParams.get("documentId");
    const folderId = searchParams.get("folderId");

    // Guard: only handle deep-link once (React StrictMode fires effects twice)
    if (deepLinkHandled.current) return;
    if (!docId && !folderId) return;
    deepLinkHandled.current = true;

    if (docId) {
      api
        .post(`/api/workspaces/${currentWorkspaceId}/chat/sessions`, {
          scope: "document",
          documentId: docId,
        })
        .then(({ data }) => {
          setSessionId(data.session._id);
          setScopeMode("docs");
          setSelectedDocIds(new Set([docId]));
          return loadSessions();
        })
        .catch((err) => toast.error(err?.response?.data?.message || "Could not start document chat"));
    } else if (folderId) {
      api
        .post(`/api/workspaces/${currentWorkspaceId}/chat/sessions`, {
          scope: "folder",
          folderId,
        })
        .then(({ data }) => {
          setSessionId(data.session._id);
          setScopeMode("folder");
          setSelectedFolderId(folderId);
          return loadSessions();
        })
        .catch((err) => toast.error(err?.response?.data?.message || "Could not start folder chat"));
    }
  }, [currentWorkspaceId]);

  useEffect(() => {
    loadMessages(sessionId).catch(() => {});
  }, [sessionId, currentWorkspaceId]);

  const clearScope = () => {
    setSelectedDocIds(new Set());
    setSelectedFolderId("");
    setScopeMode("workspace");
    setFolderSummary("");
  };

  const startNewChat = () => {
    setSessionId("");
    setMessages([]);
    clearScope();
  };

  const deleteSession = async (id) => {
    if (!currentWorkspaceId) return;
    try {
      await api.delete(`/api/workspaces/${currentWorkspaceId}/chat/sessions/${id}`);
      setSessions((s) => s.filter((x) => x._id !== id));
      if (sessionId === id) { setSessionId(""); setMessages([]); clearScope(); }
      toast.success("Chat deleted");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete chat");
    }
  };

  const renameSession = async (id) => {
    if (!currentWorkspaceId || !editTitle.trim()) { setEditingSessionId(null); return; }
    try {
      const { data } = await api.patch(
        `/api/workspaces/${currentWorkspaceId}/chat/sessions/${id}`,
        { title: editTitle.trim() }
      );
      setSessions((s) => s.map((x) => (x._id === id ? data.session : x)));
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to rename");
    } finally {
      setEditingSessionId(null);
    }
  };

  // Build payload body for current scope
  const buildScopePayload = () => {
    if (scopeMode === "folder" && selectedFolderId) {
      return { folderId: selectedFolderId };
    }
    if (scopeMode === "docs" && selectedDocIds.size > 0) {
      return { documentIds: Array.from(selectedDocIds) };
    }
    return {};
  };

  const send = async (e) => {
    e?.preventDefault();
    const questionText = question.trim();
    if (!questionText || !currentWorkspaceId) return;

    setQuestion("");
    setMessages((prev) => [
      ...prev,
      { _id: Date.now().toString(), role: "user", content: questionText },
      { _id: "temp-ai", role: "assistant", content: "", citedDocumentIds: [] },
    ]);
    setSending(true);
    try {
      const payload = {
        sessionId: sessionId || undefined,
        question: questionText,
        ...buildScopePayload(),
      };

      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5005";
      const token = localStorage.getItem("token");

      const res = await fetch(`${baseUrl}/api/workspaces/${currentWorkspaceId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Chat request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let aiContent = "";
      let isComplete = false;
      let finalSessionId = null;
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === "text") {
              aiContent += parsed.content;
              setMessages((prev) =>
                prev.map((m) =>
                  m._id === "temp-ai" ? { ...m, content: aiContent } : m
                )
              );
            } else if (parsed.type === "meta") {
              setMessages((prev) =>
                prev.map((m) =>
                  m._id === "temp-ai"
                    ? { ...m, citedDocumentIds: parsed.citedDocumentIds || [] }
                    : m
                )
              );
            } else if (parsed.type === "error") {
              toast.error(parsed.content);
            } else if (parsed.type === "complete") {
              isComplete = true;
              finalSessionId = parsed.session._id;
            }
          } catch (e) {
            // ignore partial line parse errors
          }
        }
      }

      if (buffer.trim()) {
         try {
            const parsed = JSON.parse(buffer);
            if (parsed.type === "complete") {
              isComplete = true;
              finalSessionId = parsed.session._id;
            }
         } catch(e) {}
      }

      if (isComplete && finalSessionId) {
        setSessionId(finalSessionId);
        await loadSessions();
        await loadMessages(finalSessionId);
      }
    } catch (err) {
      toast.error(err?.message || err?.response?.data?.message || "Chat failed. Is the AI service running?");
      setMessages((prev) => prev.filter((m) => m._id !== "temp-ai"));
      if (sessionId) await loadMessages(sessionId).catch(() => {});
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const toggleDoc = (id) => {
    setSelectedDocIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  // Folder summarize
  const handleSummarizeFolder = async () => {
    if (!selectedFolderId || !currentWorkspaceId) return;
    setSummarizing(true);
    setFolderSummary("");
    try {
      const { data } = await api.post(
        `/api/workspaces/${currentWorkspaceId}/folders/${selectedFolderId}/summarize`
      );
      setFolderSummary(data.summary || "No summary generated.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "AI summarization failed");
    } finally {
      setSummarizing(false);
    }
  };

  const docNameMap = Object.fromEntries(allDocuments.map((d) => [String(d._id), d.name]));
  const folderNameMap = Object.fromEntries(allFolders.map((f) => [String(f._id), f.name]));
  const filteredDocs = allDocuments.filter((d) =>
    docSearchQuery ? d.name.toLowerCase().includes(docSearchQuery.toLowerCase()) : true
  );

  // Current scope label for placeholder
  const scopeLabel =
    scopeMode === "folder" && selectedFolderId
      ? `folder "${folderNameMap[selectedFolderId] || "selected"}"`
      : scopeMode === "docs" && selectedDocIds.size > 0
      ? `${selectedDocIds.size} selected document${selectedDocIds.size > 1 ? "s" : ""}`
      : "all workspace documents";

  return (
    <div className="flex h-[calc(100vh-56px-40px)] gap-0 rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900/50">

      {/* ── Session sidebar ─────────────────────────────── */}
      <aside className="hidden sm:flex flex-col w-56 border-r border-zinc-800 bg-zinc-950/50 shrink-0">
        <div className="p-3 border-b border-zinc-800">
          <button
            onClick={startNewChat}
            className="flex items-center justify-center gap-2 w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            <Plus className="h-4 w-4" /> New chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {sessions.length === 0 && (
            <p className="text-xs text-zinc-600 text-center py-4 px-2">No chat history yet</p>
          )}
          {sessions.map((s) => {
            const scopeName =
              s.scope === "document" ? s.documentId?.name :
              s.scope === "folder" ? s.folderId?.name : undefined;
            return (
              <div
                key={s._id}
                className={`group flex flex-col rounded-lg px-2 py-1.5 text-xs transition-colors cursor-pointer ${
                  sessionId === s._id
                    ? "bg-blue-600/15 text-blue-300 ring-1 ring-blue-500/20"
                    : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200"
                }`}
              >
                {editingSessionId === s._id ? (
                  <div className="flex w-full items-center gap-1">
                    <input
                      type="text"
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") renameSession(s._id);
                        if (e.key === "Escape") setEditingSessionId(null);
                      }}
                      className="flex-1 min-w-0 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500 rounded"
                    />
                    <button onClick={() => renameSession(s._id)} className="text-blue-400 hover:text-blue-300"><Check size={12} /></button>
                    <button onClick={() => setEditingSessionId(null)} className="text-zinc-500 hover:text-zinc-300"><X size={12} /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 w-full">
                    <button onClick={() => setSessionId(s._id)} className="flex-1 truncate text-left">
                      <MessageSquare className="inline h-3 w-3 mr-1 opacity-50" />
                      {s.title}
                    </button>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0">
                      <button
                        onClick={() => { setEditTitle(s.title); setEditingSessionId(s._id); }}
                        className="p-0.5 rounded text-zinc-500 hover:text-blue-400 hover:bg-zinc-700"
                      ><Edit2 size={11} /></button>
                      <button
                        onClick={() => { if (window.confirm("Delete this chat?")) deleteSession(s._id); }}
                        className="p-0.5 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-700"
                      ><Trash2 size={11} /></button>
                    </div>
                  </div>
                )}
                {s.scope && s.scope !== "workspace" && (
                  <div className="mt-1 pl-4">
                    <ScopeBadge scope={s.scope} name={scopeName} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────── */}
      <section className="flex flex-1 flex-col min-w-0">

        {/* Scope selector bar */}
        <div className="border-b border-zinc-800 shrink-0">
          <button
            type="button"
            onClick={() => setShowScopeSelector((v) => !v)}
            className={`w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium transition-colors ${
              scopeMode !== "workspace"
                ? "text-blue-300 bg-blue-900/10"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30"
            }`}
          >
            <span className="flex items-center gap-2">
              {scopeMode === "folder" ? <FolderOpen className="h-3.5 w-3.5" /> : <Files className="h-3.5 w-3.5" />}
              Scope: {scopeLabel} · Click to change
            </span>
            {showScopeSelector ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {showScopeSelector && (
            <div className="border-t border-zinc-800 bg-zinc-950/50 p-3 space-y-3">
              {/* Mode tabs */}
              <div className="flex gap-1.5">
                {[
                  { id: "workspace", label: "All docs", icon: <Layers className="h-3.5 w-3.5" /> },
                  { id: "docs",      label: "Pick docs", icon: <Files className="h-3.5 w-3.5" /> },
                  { id: "folder",    label: "By folder", icon: <FolderOpen className="h-3.5 w-3.5" /> },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { setScopeMode(m.id); setSelectedDocIds(new Set()); setSelectedFolderId(""); setFolderSummary(""); }}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                      scopeMode === m.id
                        ? "bg-blue-600/20 border-blue-500/50 text-blue-300"
                        : "bg-zinc-800/50 border-zinc-700 text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {m.icon}{m.label}
                  </button>
                ))}
                {scopeMode !== "workspace" && (
                  <button
                    type="button"
                    onClick={clearScope}
                    className="ml-auto text-xs text-zinc-500 hover:text-rose-400 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Doc picker */}
              {scopeMode === "docs" && (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={docSearchQuery}
                    onChange={(e) => setDocSearchQuery(e.target.value)}
                    placeholder="Filter documents…"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500"
                  />
                  <div className="max-h-44 overflow-y-auto space-y-0.5">
                    {filteredDocs.map((doc) => {
                      const checked = selectedDocIds.has(String(doc._id));
                      return (
                        <label
                          key={doc._id}
                          className={`flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer text-xs transition-colors ${
                            checked ? "bg-blue-900/20 text-blue-200" : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleDoc(String(doc._id))}
                            className="accent-blue-500"
                          />
                          <FileText className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                          <span className="truncate">{doc.name}</span>
                        </label>
                      );
                    })}
                    {filteredDocs.length === 0 && <p className="text-xs text-zinc-600 py-2 text-center">No documents</p>}
                  </div>
                  {selectedDocIds.size > 0 && (
                    <p className="text-[11px] text-blue-400">
                      {selectedDocIds.size} document{selectedDocIds.size > 1 ? "s" : ""} selected — AI answers from these only.
                    </p>
                  )}
                </div>
              )}

              {/* Folder picker */}
              {scopeMode === "folder" && (
                <div className="space-y-2">
                  <div className="max-h-44 overflow-y-auto space-y-0.5">
                    {allFolders.length === 0 && (
                      <p className="text-xs text-zinc-600 py-2 text-center">No folders in workspace</p>
                    )}
                    {allFolders.map((folder) => {
                      const selected = selectedFolderId === String(folder._id);
                      return (
                        <button
                          key={folder._id}
                          type="button"
                          onClick={() => { setSelectedFolderId(String(folder._id)); setFolderSummary(""); }}
                          className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-left transition-colors ${
                            selected ? "bg-violet-900/25 text-violet-200 border border-violet-700/40" : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                          }`}
                        >
                          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                          <span className="truncate">{folder.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedFolderId && (
                    <div className="space-y-2">
                      <p className="text-[11px] text-violet-400">
                        AI will answer using documents inside "{folderNameMap[selectedFolderId]}" (including subfolders).
                      </p>
                      {/* Folder summarize */}
                      <button
                        type="button"
                        onClick={handleSummarizeFolder}
                        disabled={summarizing}
                        className="flex items-center gap-2 rounded-lg border border-violet-600/30 bg-violet-600/10 px-3 py-1.5 text-xs font-medium text-violet-300 hover:bg-violet-600/20 disabled:opacity-50 transition-colors"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        {summarizing ? "Generating summary…" : "Summarize this folder"}
                      </button>
                      {folderSummary && (
                        <div className="rounded-lg border border-violet-800/40 bg-violet-950/30 p-3 text-xs text-violet-200 leading-relaxed">
                          <p className="text-[10px] font-semibold uppercase text-violet-500 mb-1">AI Folder Summary</p>
                          <ReactMarkdown>{folderSummary}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
              <div className="rounded-2xl bg-blue-600/10 border border-blue-500/20 p-5 mb-4">
                <Bot className="h-10 w-10 text-blue-400 mx-auto" />
              </div>
              <h2 className="text-lg font-semibold text-zinc-200 mb-2">AI Document Assistant</h2>
              <p className="text-sm text-zinc-500 max-w-xs leading-relaxed">
                Ask questions about your documents. Scope your chat to specific documents or folders for focused answers.
              </p>
              {scopeMode !== "workspace" && (
                <div className="mt-3">
                  <ScopeBadge
                    scope={scopeMode === "folder" ? "folder" : "multi"}
                    name={
                      scopeMode === "folder"
                        ? folderNameMap[selectedFolderId]
                        : `${selectedDocIds.size} docs`
                    }
                  />
                </div>
              )}
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m._id}
              className={`flex flex-col max-w-[85%] ${m.role === "user" ? "ml-auto items-end" : "mr-auto items-start"}`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1 px-1">
                {m.role === "user" ? "You" : "AI Assistant"}
              </p>
              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                m.role === "user"
                  ? "bg-blue-600/20 border border-blue-600/30 text-zinc-100 rounded-tr-sm"
                  : "bg-zinc-800 border border-zinc-700/50 text-zinc-200 rounded-tl-sm"
              }`}>
                {m.role === "user" ? (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                ) : (
                  <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-zinc-900/60 prose-pre:border prose-pre:border-zinc-700 prose-code:text-blue-300 prose-code:bg-zinc-800/60 prose-code:px-1 prose-code:rounded">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                )}
              </div>

              {/* Source citations */}
              {m.citedDocumentIds?.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 px-1">
                  <span className="text-[11px] text-zinc-600">Sources:</span>
                  {m.citedDocumentIds.map((id) => (
                    <Link
                      key={id}
                      className="inline-flex items-center gap-1 rounded-lg bg-zinc-800/60 border border-zinc-700/50 px-2 py-0.5 text-[11px] font-medium text-blue-400 hover:bg-zinc-700 transition-colors"
                      to={`/app/documents?highlight=${id}`}
                    >
                      <FileText className="h-3 w-3" />
                      {docNameMap[String(id)]
                        ? docNameMap[String(id)].slice(0, 28) + (docNameMap[String(id)].length > 28 ? "…" : "")
                        : `…${String(id).slice(-6)}`}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}

          {sending && !messages.some((m) => m._id === "temp-ai" && m.content) && (
            <div className="flex items-start gap-2 mr-auto max-w-[85%]">
              <div className="rounded-2xl rounded-tl-sm bg-zinc-800 border border-zinc-700/50 px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 rounded-full bg-blue-500 animate-bounce" />
                </div>
                <span className="text-xs text-zinc-500">Thinking…</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={(e) => { send(e); }} className="flex items-end gap-2 border-t border-zinc-800 p-3 shrink-0">
          <textarea
            ref={textareaRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={`Ask about ${scopeLabel}… (Enter to send)`}
            className="flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-800 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-colors min-h-[42px] max-h-32"
            style={{ height: "42px" }}
            onInput={(e) => {
              e.target.style.height = "42px";
              e.target.style.height = Math.min(e.target.scrollHeight, 128) + "px";
            }}
          />
          <button
            type="submit"
            disabled={sending || !question.trim()}
            className="flex items-center justify-center rounded-xl bg-blue-600 p-2.5 text-white shadow-lg shadow-blue-900/30 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </section>
    </div>
  );
};

export default Chat;
