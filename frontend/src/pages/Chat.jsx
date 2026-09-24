import { useEffect, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../utils/api";
import { useWorkspace } from "../context/WorkspaceContext";
import ReactMarkdown from "react-markdown";
import { Edit2, Trash2, Check, X, Files, FileText, ChevronDown, ChevronUp } from "lucide-react";

const Chat = () => {
  const { currentWorkspaceId } = useWorkspace();
  const [searchParams] = useSearchParams();
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editTitle, setEditTitle] = useState("");

  // Multi-document scope state
  const [allDocuments, setAllDocuments] = useState([]);
  const [selectedDocIds, setSelectedDocIds] = useState(new Set());
  const [showDocSelector, setShowDocSelector] = useState(false);
  const [docSearchQuery, setDocSearchQuery] = useState("");

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  // Fetch all documents once for the multi-doc selector
  const loadDocuments = async () => {
    if (!currentWorkspaceId) return;
    try {
      const { data } = await api.get(`/api/workspaces/${currentWorkspaceId}/documents`);
      setAllDocuments(data.documents || []);
    } catch {
      // silently ignore
    }
  };

  const loadSessions = async () => {
    if (!currentWorkspaceId) return;
    const { data } = await api.get(`/api/workspaces/${currentWorkspaceId}/chat/sessions`);
    setSessions(data.sessions || []);
  };

  const loadMessages = async (id) => {
    if (!currentWorkspaceId || !id) {
      setMessages([]);
      return;
    }
    const { data } = await api.get(
      `/api/workspaces/${currentWorkspaceId}/chat/sessions/${id}/messages`
    );
    setMessages(data.messages || []);
  };

  useEffect(() => {
    loadSessions().catch(() => {});
    loadDocuments().catch(() => {});
    const docId = searchParams.get("documentId");
    if (docId && currentWorkspaceId) {
      api
        .post(`/api/workspaces/${currentWorkspaceId}/chat/sessions`, {
          scope: "document",
          documentId: docId,
        })
        .then(({ data }) => {
          setSessionId(data.session._id);
          // Pre-select the document in the multi-doc selector
          setSelectedDocIds(new Set([docId]));
          return loadSessions();
        })
        .catch((error) =>
          toast.error(error?.response?.data?.message || "Could not start document chat")
        );
    }
  }, [currentWorkspaceId]);

  useEffect(() => {
    loadMessages(sessionId).catch(() => {});
  }, [sessionId, currentWorkspaceId]);

  const deleteSession = async (id) => {
    if (!currentWorkspaceId) return;
    try {
      await api.delete(`/api/workspaces/${currentWorkspaceId}/chat/sessions/${id}`);
      setSessions(sessions.filter((s) => s._id !== id));
      if (sessionId === id) {
        setSessionId("");
        setMessages([]);
      }
      toast.success("Chat deleted");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete chat");
    }
  };

  const renameSession = async (id) => {
    if (!currentWorkspaceId || !editTitle.trim()) {
      setEditingSessionId(null);
      return;
    }
    try {
      const { data } = await api.patch(
        `/api/workspaces/${currentWorkspaceId}/chat/sessions/${id}`,
        { title: editTitle.trim() }
      );
      setSessions(sessions.map((s) => (s._id === id ? data.session : s)));
      toast.success("Chat renamed");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to rename chat");
    } finally {
      setEditingSessionId(null);
    }
  };

  const send = async (e) => {
    e.preventDefault();
    const questionText = question.trim();
    if (!questionText || !currentWorkspaceId) return;

    setQuestion("");
    setMessages((prev) => [
      ...prev,
      { _id: Date.now().toString(), role: "user", content: questionText },
    ]);
    setSending(true);

    try {
      const payload = {
        sessionId: sessionId || undefined,
        question: questionText,
      };

      // Add selected document IDs for multi-doc scoped chat
      if (selectedDocIds.size > 0) {
        payload.documentIds = Array.from(selectedDocIds);
      }

      const { data } = await api.post(
        `/api/workspaces/${currentWorkspaceId}/chat`,
        payload
      );
      setSessionId(data.session._id);
      await loadSessions();
      await loadMessages(data.session._id);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Chat failed. Is the AI service running?");
      if (sessionId) await loadMessages(sessionId);
    } finally {
      setSending(false);
    }
  };

  // Document selector helpers
  const toggleDocSelection = (docId) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  // Build a name map for citation display
  const docNameMap = Object.fromEntries(allDocuments.map((d) => [String(d._id), d.name]));

  const filteredDocs = allDocuments.filter((d) =>
    docSearchQuery
      ? d.name.toLowerCase().includes(docSearchQuery.toLowerCase())
      : true
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      {/* Sidebar: session list */}
      <aside className="space-y-2">
        <button
          onClick={() => {
            setSessionId("");
            setMessages([]);
          }}
          className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm hover:bg-blue-500 transition-colors"
        >
          New chat
        </button>
        {sessions.map((s) => (
          <div
            key={s._id}
            className={`group flex items-center justify-between rounded-md px-3 py-2 text-sm ${
              sessionId === s._id ? "bg-zinc-800" : "hover:bg-zinc-800"
            }`}
          >
            {editingSessionId === s._id ? (
              <div className="flex w-full items-center gap-2">
                <input
                  type="text"
                  autoFocus
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") renameSession(s._id);
                    if (e.key === "Escape") setEditingSessionId(null);
                  }}
                  className="w-full bg-zinc-900 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 rounded"
                />
                <button onClick={() => renameSession(s._id)} className="text-blue-400 hover:text-blue-300">
                  <Check size={14} />
                </button>
                <button onClick={() => setEditingSessionId(null)} className="text-zinc-400 hover:text-zinc-300">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setSessionId(s._id)}
                  className="flex-1 truncate text-left"
                >
                  {s.title}
                </button>
                <div className="relative ml-2 flex items-center opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => {
                      setEditTitle(s.title);
                      setEditingSessionId(s._id);
                    }}
                    className="p-1 text-zinc-400 hover:text-blue-400"
                    title="Rename"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm("Delete this chat?")) {
                        deleteSession(s._id);
                      }
                    }}
                    className="p-1 text-zinc-400 hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </aside>

      {/* Main Chat Area */}
      <section className="flex min-h-[60vh] flex-col rounded-xl border border-zinc-800 bg-zinc-900">
        {/* Multi-document selector panel */}
        <div className="border-b border-zinc-800">
          <button
            type="button"
            onClick={() => setShowDocSelector((v) => !v)}
            className={`w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium transition-colors ${
              selectedDocIds.size > 0
                ? "text-blue-300 bg-blue-900/10"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <span className="flex items-center gap-2">
              <Files className="h-3.5 w-3.5" />
              {selectedDocIds.size > 0
                ? `Scoped to ${selectedDocIds.size} document${selectedDocIds.size > 1 ? "s" : ""}`
                : "All workspace documents · Click to scope chat"}
            </span>
            {showDocSelector ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {showDocSelector && (
            <div className="border-t border-zinc-800 bg-zinc-950/50 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={docSearchQuery}
                  onChange={(e) => setDocSearchQuery(e.target.value)}
                  placeholder="Filter documents..."
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500"
                />
                {selectedDocIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedDocIds(new Set())}
                    className="text-xs text-zinc-400 hover:text-rose-400 transition-colors whitespace-nowrap"
                  >
                    Clear selection
                  </button>
                )}
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                {filteredDocs.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-2 text-center">No documents found</p>
                ) : (
                  filteredDocs.map((doc) => {
                    const checked = selectedDocIds.has(String(doc._id));
                    return (
                      <label
                        key={doc._id}
                        className={`flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer text-xs transition-colors ${
                          checked ? "bg-blue-900/20 text-blue-200" : "text-zinc-300 hover:bg-zinc-800/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDocSelection(String(doc._id))}
                          className="accent-blue-500 rounded"
                        />
                        <FileText className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                        <span className="truncate">{doc.name}</span>
                        {doc.aiCategory && (
                          <span className="ml-auto shrink-0 rounded-full bg-indigo-900/40 border border-indigo-700/50 px-1.5 text-[10px] text-indigo-300">
                            {doc.aiCategory}
                          </span>
                        )}
                      </label>
                    );
                  })
                )}
              </div>

              {selectedDocIds.size > 0 && (
                <p className="text-[11px] text-blue-400 pt-1">
                  AI will answer from {selectedDocIds.size} selected document{selectedDocIds.size > 1 ? "s" : ""} only.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <p className="text-sm text-zinc-400">
              Ask about files in this workspace. Answers only come from documents you can access.
              {selectedDocIds.size > 0 && (
                <span className="block mt-1 text-blue-400 text-xs">
                  Currently scoped to {selectedDocIds.size} selected document{selectedDocIds.size > 1 ? "s" : ""}.
                </span>
              )}
            </p>
          )}
          {messages.map((m) => (
            <div
              key={m._id}
              className={`rounded-lg px-4 py-3 text-sm shadow-sm ${
                m.role === "user"
                  ? "bg-blue-900/30 ml-8 border border-blue-800/30"
                  : "bg-zinc-800 mr-8 border border-zinc-700/50"
              }`}
            >
              <p className="mb-2 text-[11px] font-semibold tracking-wider uppercase text-zinc-400">
                {m.role === "user" ? "You" : "Assistant"}
              </p>

              {m.role === "user" ? (
                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
              ) : (
                <div className="prose prose-invert prose-sm max-w-none leading-relaxed prose-p:leading-relaxed prose-pre:bg-zinc-900/50 prose-pre:border prose-pre:border-zinc-700 prose-table:text-xs prose-th:bg-zinc-800/60 prose-code:text-blue-300 prose-code:bg-zinc-800/60 prose-code:px-1 prose-code:rounded">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              )}

              {/* Source Citations — show document names if available */}
              {m.citedDocumentIds?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-zinc-700/50 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-zinc-400">Sources:</span>
                  {m.citedDocumentIds.map((id) => (
                    <Link
                      key={id}
                      className="inline-flex items-center gap-1 rounded bg-zinc-700/50 px-2 py-1 text-xs font-medium text-blue-400 hover:bg-zinc-700 transition-colors border border-zinc-600/50"
                      to={`/app/documents?highlight=${id}`}
                      title="View source document"
                    >
                      <FileText className="h-3 w-3" />
                      {docNameMap[String(id)]
                        ? docNameMap[String(id)].length > 30
                          ? docNameMap[String(id)].slice(0, 30) + "…"
                          : docNameMap[String(id)]
                        : `Doc …${String(id).slice(-6)}`}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="rounded-lg px-4 py-3 text-sm shadow-sm bg-zinc-800 mr-8 border border-zinc-700/50 flex items-center gap-3 w-fit">
              <div className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]" />
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]" />
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-bounce" />
              </div>
              <span className="text-xs text-zinc-400">Thinking...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={send} className="flex gap-2 border-t border-zinc-800 p-3">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={
              selectedDocIds.size > 0
                ? `Ask about ${selectedDocIds.size} selected document${selectedDocIds.size > 1 ? "s" : ""}…`
                : "Ask a question about your documents"
            }
            className="flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />
          <button
            disabled={sending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm hover:bg-blue-500 disabled:opacity-60 transition-colors"
          >
            {sending ? "..." : "Send"}
          </button>
        </form>
      </section>
    </div>
  );
};

export default Chat;
