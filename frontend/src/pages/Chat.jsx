import { useEffect, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../utils/api";
import { useWorkspace } from "../context/WorkspaceContext";
import ReactMarkdown from "react-markdown";
import { Edit2, Trash2, Check, X, MoreVertical } from "lucide-react";

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
  const [menuOpenId, setMenuOpenId] = useState(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  const loadSessions = async () => {
    if (!currentWorkspaceId) return;
    const { data } = await api.get(
      `/api/workspaces/${currentWorkspaceId}/chat/sessions`
    );
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
    const docId = searchParams.get("documentId");
    if (docId && currentWorkspaceId) {
      api
        .post(`/api/workspaces/${currentWorkspaceId}/chat/sessions`, {
          scope: "document",
          documentId: docId,
        })
        .then(({ data }) => {
          setSessionId(data.session._id);
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
    
    // Eagerly clear input and show user message in the chat
    setQuestion("");
    setMessages((prev) => [
      ...prev,
      { _id: Date.now().toString(), role: "user", content: questionText },
    ]);
    setSending(true);

    try {
      const { data } = await api.post(`/api/workspaces/${currentWorkspaceId}/chat`, {
        sessionId: sessionId || undefined,
        question: questionText,
      });
      setSessionId(data.session._id);
      await loadSessions();
      await loadMessages(data.session._id);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Chat failed. Is the AI service running?");
      // On error, we could optionally remove the eagerly added message here, 
      // but reloading messages is safer if a sessionId exists.
      if (sessionId) await loadMessages(sessionId);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <aside className="space-y-2">
        <button
          onClick={() => {
            setSessionId("");
            setMessages([]);
          }}
          className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm hover:bg-blue-500"
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
                      setMenuOpenId(null);
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
      <section className="flex min-h-[60vh] flex-col rounded-xl border border-zinc-800 bg-zinc-900">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <p className="text-sm text-zinc-400">
              Ask about files in this workspace. Answers only come from documents you can access.
            </p>
          )}
          {messages.map((m) => (
            <div
              key={m._id}
              className={`rounded-lg px-4 py-3 text-sm shadow-sm ${
                m.role === "user" ? "bg-blue-900/30 ml-8 border border-blue-800/30" : "bg-zinc-800 mr-8 border border-zinc-700/50"
              }`}
            >
              <p className="mb-2 text-[11px] font-semibold tracking-wider uppercase text-zinc-400">
                {m.role === "user" ? "You" : "Assistant"}
              </p>
              
              {m.role === "user" ? (
                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
              ) : (
                <div className="prose prose-invert prose-sm max-w-none leading-relaxed prose-p:leading-relaxed prose-pre:bg-zinc-900/50 prose-pre:border prose-pre:border-zinc-700">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              )}

              {m.citedDocumentIds?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-zinc-700/50 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-zinc-400">Sources:</span>
                  {m.citedDocumentIds.map((id) => (
                    <Link
                      key={id}
                      className="inline-flex items-center rounded bg-zinc-700/50 px-2 py-1 text-xs font-medium text-blue-400 hover:bg-zinc-700 transition-colors border border-zinc-600/50"
                      to={`/app/documents?highlight=${id}`}
                      title="View source document"
                    >
                      Doc {String(id).slice(-6)}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="rounded-lg px-4 py-3 text-sm shadow-sm bg-zinc-800 mr-8 border border-zinc-700/50 flex items-center gap-3 w-fit">
              <div className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]"></span>
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]"></span>
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-bounce"></span>
              </div>
              <span className="text-xs text-zinc-400">Thinking...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={send} className="flex gap-2 border-t border-zinc-800 p-3">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about your documents"
            className="flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />
          <button
            disabled={sending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm hover:bg-blue-500 disabled:opacity-60"
          >
            {sending ? "..." : "Send"}
          </button>
        </form>
      </section>
    </div>
  );
};

export default Chat;
