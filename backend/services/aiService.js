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

export async function ragChat(payload) {
  const { data } = await client().post("/rag/chat", payload);
  return data;
}

export async function ragSearch(payload) {
  const { data } = await client().post("/rag/search", payload);
  return data;
}
