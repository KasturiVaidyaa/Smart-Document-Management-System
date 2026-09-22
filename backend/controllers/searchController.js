import TryCatch from "../utils/TryCatch.js";
import { Document } from "../models/Document.js";
import { allowedDocumentIds } from "../services/aiJobs.js";
import { ragSearch } from "../services/aiService.js";

export const searchDocuments = TryCatch(async (req, res) => {
  const q = String(req.query.q || req.body.query || "").trim();
  if (!q) {
    return res.json({ documents: [], semanticHits: [] });
  }

  const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const metadataDocs = await Document.find({
    workspaceId: req.workspace._id,
    status: "active",
    $or: [
      { name: regex },
      { tags: regex },
      { category: regex },
      { aiCategory: regex },
      { summary: regex },
    ],
  })
    .sort({ updatedAt: -1 })
    .limit(50);

  let semanticHits = [];
  try {
    const allowed = await allowedDocumentIds(req.workspace._id);
    const data = await ragSearch({
      workspaceId: String(req.workspace._id),
      allowedDocumentIds: allowed,
      query: q,
    });
    semanticHits = data.hits || [];
  } catch (error) {
    console.error("Semantic search skipped:", error.message);
  }

  const byId = new Map(metadataDocs.map((d) => [String(d._id), d]));
  const extraIds = semanticHits
    .map((h) => h.documentId)
    .filter((id) => id && !byId.has(id));
  if (extraIds.length) {
    const extra = await Document.find({
      _id: { $in: extraIds },
      workspaceId: req.workspace._id,
      status: "active",
    });
    extra.forEach((d) => byId.set(String(d._id), d));
  }

  const documents = [
    ...metadataDocs.map((d) => serializeSearchDoc(d, null)),
    ...semanticHits
      .filter((hit) => byId.has(hit.documentId))
      .filter((hit) => !metadataDocs.some((d) => String(d._id) === hit.documentId))
      .map((hit) => serializeSearchDoc(byId.get(hit.documentId), hit)),
  ];

  res.json({ documents, semanticHits });
});

function serializeSearchDoc(doc, hit) {
  return {
    _id: doc._id,
    name: doc.name,
    mimeType: doc.mimeType,
    summary: doc.summary,
    aiCategory: doc.aiCategory,
    snippet: hit?.snippet || doc.summary || "",
    score: hit?.score,
  };
}
