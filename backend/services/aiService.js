import axios from "axios";

const aiUrl = () => process.env.AI_SERVICE_URL || "http://localhost:8100";
const aiToken = () =>
  process.env.AI_INTERNAL_TOKEN || process.env.INTERNAL_TOKEN || "";

const client = () =>
  axios.create({
    baseURL: aiUrl(),
    timeout: 180000,
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Token": aiToken(),
    },
  });

export const PROCESSABLE_EXTENSIONS = new Set([
  "pdf",
  "docx",
  "pptx",
  "txt",
  "md",
]);

export function isProcessable(extension = "") {
  return PROCESSABLE_EXTENSIONS.has(String(extension).replace(".", "").toLowerCase());
}

export async function processDocumentJob(payload, { retries = 1 } = {}) {
  if (!aiToken()) {
    throw new Error("AI_INTERNAL_TOKEN is not set");
  }

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const { data } = await client().post("/jobs/process", payload);
      return data;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/** Standard RAG chat with conversation history */
export async function ragChat(payload) {
  const { data } = await client().post("/rag/chat", payload);
  return data;
}

/** Streaming RAG chat */
export async function ragChatStream(payload, res) {
  const aiBaseUrl = process.env.AI_SERVICE_URL || "http://localhost:8100";
  const token = process.env.AI_INTERNAL_TOKEN || process.env.INTERNAL_TOKEN || "";

  const response = await fetch(`${aiBaseUrl}/rag/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Token": token,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`AI Service stream failed: ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");

  let fullAnswer = "";
  let meta = null;
  let hasError = false;
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunkStr = decoder.decode(value, { stream: true });
    // Forward raw JSON lines to frontend
    res.write(chunkStr);

    buffer += chunkStr;
    const lines = buffer.split("\n");
    
    // Keep the last element in the buffer since it might not have a newline at the end
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === "text" && parsed.content) {
          fullAnswer += parsed.content;
        } else if (parsed.type === "meta") {
          meta = parsed;
        } else if (parsed.type === "error") {
          hasError = true;
          fullAnswer += parsed.content;
        }
      } catch (e) {
        // Log it if needed, but it shouldn't happen now since we split by \n properly
      }
    }
  }

  // Handle any remaining buffer
  if (buffer.trim()) {
    try {
      const parsed = JSON.parse(buffer);
      if (parsed.type === "text" && parsed.content) {
        fullAnswer += parsed.content;
      } else if (parsed.type === "meta") {
        meta = parsed;
      }
    } catch (e) {}
  }

  return { answer: fullAnswer, meta, hasError };
}

/** Semantic / vector document search */
export async function ragSearch(payload) {
  const { data } = await client().post("/rag/search", payload);
  return data;
}

/**
 * Ask the AI to summarize a set of documents (e.g., all docs in a folder).
 * @param {{ workspaceId: string, documentIds: string[], prompt?: string }} payload
 */
export async function ragSummarize(payload) {
  const { data } = await client().post("/rag/summarize", payload);
  return data;
}

/**
 * Ask the AI to suggest tags/keywords for a document based on its content.
 * @param {{ workspaceId: string, documentId: string }} payload
 */
export async function ragSuggestTags(payload) {
  const { data } = await client().post("/rag/suggest-tags", payload);
  return data;
}

/**
 * Ask the AI to classify/categorize a document.
 * @param {{ workspaceId: string, documentId: string, categories: string[] }} payload
 */
export async function ragClassify(payload) {
  const { data } = await client().post("/rag/classify", payload);
  return data;
}
