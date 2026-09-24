import TryCatch from "../utils/TryCatch.js";
import { Document } from "../models/Document.js";
import { allowedDocumentIds } from "../services/aiJobs.js";
import { ragSearch } from "../services/aiService.js";

/**
 * GET /api/workspaces/:workspaceId/search
 *
 * Combines:
 *  1. Metadata regex search (name, tags, category, aiCategory, summary, aiKeywords)
 *  2. Optional metadata filters (category, aiCategory, tags, extension, dateFrom, dateTo)
 *  3. Existing semantic/vector RAG search (preserved as-is)
 *
 * Query params:
 *  q           — search query (required for semantic search; optional for filter-only)
 *  category    — exact match on document.category
 *  aiCategory  — exact match on document.aiCategory
 *  tags        — comma-separated tag values
 *  extension   — file extension (e.g. "pdf", "docx")
 *  dateFrom    — ISO date string, createdAt >= dateFrom
 *  dateTo      — ISO date string, createdAt <= dateTo
 */
export const searchDocuments = TryCatch(async (req, res) => {
  const q = String(req.query.q || req.body.query || "").trim();

  // --- Build metadata filter ---
  const filter = {
    workspaceId: req.workspace._id,
    status: "active",
  };

  // Text search using regex (preserved from original)
  if (q) {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [
      { name: regex },
      { tags: regex },
      { category: regex },
      { aiCategory: regex },
      { summary: regex },
      { aiKeywords: regex },
    ];
  }

  // Category filter
  const categoryFilter = req.query.category;
  if (categoryFilter && categoryFilter !== "all" && categoryFilter !== "") {
    filter.category = categoryFilter;
  }

  // AI Category filter
  const aiCategoryFilter = req.query.aiCategory;
  if (aiCategoryFilter && aiCategoryFilter !== "all" && aiCategoryFilter !== "") {
    filter.aiCategory = aiCategoryFilter;
  }

  // Tags filter (comma-separated)
  const tagsFilter = req.query.tags;
  if (tagsFilter && tagsFilter !== "") {
    const tagList = tagsFilter.split(",").map((t) => t.trim()).filter(Boolean);
    if (tagList.length > 0) {
      filter.tags = { $in: tagList };
    }
  }

  // Extension filter
  const extensionFilter = req.query.extension;
  if (extensionFilter && extensionFilter !== "all" && extensionFilter !== "") {
    filter.extension = extensionFilter.toLowerCase().replace(/^\./, "");
  }

  // Date range filter
  const dateFrom = req.query.dateFrom;
  const dateTo = req.query.dateTo;
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  // If no query and no filters at all, return empty
  if (!q && !categoryFilter && !aiCategoryFilter && !tagsFilter && !extensionFilter && !dateFrom && !dateTo) {
    return res.json({ documents: [], semanticHits: [] });
  }

  const metadataDocs = await Document.find(filter)
    .sort({ updatedAt: -1 })
    .limit(50);

  // --- Semantic / vector search (preserved from original) ---
  let semanticHits = [];
  if (q) {
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
  }

  // Merge metadata results and semantic hits (deduplicated)
  const byId = new Map(metadataDocs.map((d) => [String(d._id), d]));
  const extraIds = semanticHits
    .map((h) => h.documentId)
    .filter((id) => id && !byId.has(id));

  if (extraIds.length) {
    // Apply metadata filters to semantic hits too (scope to workspace + active)
    const extraFilter = {
      _id: { $in: extraIds },
      workspaceId: req.workspace._id,
      status: "active",
    };
    if (categoryFilter && categoryFilter !== "all") extraFilter.category = categoryFilter;
    if (aiCategoryFilter && aiCategoryFilter !== "all") extraFilter.aiCategory = aiCategoryFilter;
    if (extensionFilter && extensionFilter !== "all") extraFilter.extension = extensionFilter.toLowerCase().replace(/^\./, "");
    if (dateFrom || dateTo) extraFilter.createdAt = filter.createdAt;

    const extra = await Document.find(extraFilter);
    extra.forEach((d) => byId.set(String(d._id), d));
  }

  const documents = [
    ...metadataDocs.map((d) => serializeSearchDoc(d, null, q)),
    ...semanticHits
      .filter((hit) => byId.has(hit.documentId))
      .filter((hit) => !metadataDocs.some((d) => String(d._id) === hit.documentId))
      .map((hit) => serializeSearchDoc(byId.get(hit.documentId), hit, q)),
  ];

  res.json({ documents, semanticHits });
});

/**
 * Builds a snippet from the document summary/content with optional query highlighting markers.
 * Returns the snippet string (plain text with **term** bold markers around matches).
 */
function buildSnippet(doc, hit, query) {
  const raw = hit?.snippet || doc.summary || doc.name || "";
  if (!query || !raw) return raw;

  // Highlight query terms in the snippet using simple marker tags
  try {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return raw.replace(new RegExp(`(${escaped})`, "gi"), "**$1**");
  } catch {
    return raw;
  }
}

function serializeSearchDoc(doc, hit, query) {
  return {
    _id: doc._id,
    name: doc.name,
    mimeType: doc.mimeType,
    extension: doc.extension || null,
    summary: doc.summary || null,
    category: doc.category || null,
    aiCategory: doc.aiCategory || null,
    aiKeywords: doc.aiKeywords || [],
    tags: doc.tags || [],
    snippet: buildSnippet(doc, hit, query),
    score: hit?.score || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    sizeBytes: doc.sizeBytes || 0,
    processing: doc.processing || null,
  };
}
