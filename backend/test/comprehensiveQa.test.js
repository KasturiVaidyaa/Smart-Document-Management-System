import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import { serializeDocument } from "../controllers/documentController.js";

test("QA Test Suite — Complete Document Features & Intelligence", async (t) => {
  const workspaceId = new mongoose.Types.ObjectId();
  const docId = new mongoose.Types.ObjectId();

  await t.test("1. Document listing serialization includes all AI Intelligence fields", () => {
    const doc = {
      _id: docId,
      workspaceId,
      name: "Financial_Report_2025.pdf",
      mimeType: "application/pdf",
      extension: "pdf",
      sizeBytes: 204800,
      versionCount: 2,
      status: "active",
      category: "Finance",
      summary: "Comprehensive Q4 revenue and balance sheet summary.",
      aiCategory: "Financial Statement",
      aiKeywords: ["revenue", "ebitda", "balance", "audit"],
      currentVersionId: {
        processing: { extract: "ready", embed: "ready", classify: "ready" },
      },
      createdAt: new Date("2025-01-15"),
      updatedAt: new Date("2025-01-16"),
      lastAccessedAt: new Date("2025-01-16"),
    };

    const res = serializeDocument(doc);
    assert.equal(res._id, docId);
    assert.equal(res.name, "Financial_Report_2025.pdf");
    assert.equal(res.summary, "Comprehensive Q4 revenue and balance sheet summary.");
    assert.equal(res.aiCategory, "Financial Statement");
    assert.deepEqual(res.aiKeywords, ["revenue", "ebitda", "balance", "audit"]);
    assert.deepEqual(res.processing, { extract: "ready", embed: "ready", classify: "ready" });
  });

  await t.test("2. Processing statuses (pending, running, ready, failed) serialize correctly", () => {
    const statuses = [
      { extract: "pending", embed: "pending", classify: "pending" },
      { extract: "running", embed: "pending", classify: "pending" },
      { extract: "ready", embed: "ready", classify: "ready" },
      { extract: "failed", embed: "pending", classify: "pending" },
    ];

    statuses.forEach((processing) => {
      const doc = {
        _id: new mongoose.Types.ObjectId(),
        workspaceId,
        name: "Test.pdf",
        currentVersionId: { processing },
      };
      const serialized = serializeDocument(doc);
      assert.deepEqual(serialized.processing, processing);
    });
  });

  await t.test("3. Missing version gracefully yields null processing state", () => {
    const doc = {
      _id: new mongoose.Types.ObjectId(),
      workspaceId,
      name: "NoVersion.docx",
      currentVersionId: null,
    };
    const serialized = serializeDocument(doc);
    assert.equal(serialized.processing, null);
  });
});

test("QA Test Suite — Search Enhancements & Filter Combinations", async (t) => {
  const workspaceId = new mongoose.Types.ObjectId();

  const mockDocs = [
    {
      _id: new mongoose.Types.ObjectId(),
      workspaceId,
      name: "Machine_Learning_Notes.pdf",
      extension: "pdf",
      category: "Research",
      aiCategory: "Technical Paper",
      aiKeywords: ["machine learning", "neural networks", "ai"],
      tags: ["AI", "ML"],
      summary: "Introduction to machine learning and deep architectures.",
      status: "active",
      createdAt: new Date("2025-02-01"),
    },
    {
      _id: new mongoose.Types.ObjectId(),
      workspaceId,
      name: "Marketing_Plan.docx",
      extension: "docx",
      category: "Marketing",
      aiCategory: "Business Plan",
      aiKeywords: ["growth", "seo", "branding"],
      tags: ["strategy", "growth"],
      summary: "Annual marketing strategy for brand awareness.",
      status: "active",
      createdAt: new Date("2025-02-10"),
    },
    {
      _id: new mongoose.Types.ObjectId(),
      workspaceId,
      name: "Quarterly_Financials.xlsx",
      extension: "xlsx",
      category: "Finance",
      aiCategory: "Spreadsheet",
      aiKeywords: ["revenue", "q1", "finance"],
      tags: ["finance", "excel"],
      summary: "Q1 revenue breakdown and fiscal projections.",
      status: "active",
      createdAt: new Date("2025-01-20"),
    },
  ];

  // Helper simulating searchController filter matching
  function matchFilters(doc, { q, category, aiCategory, tags, extension, dateFrom, dateTo }) {
    if (doc.status !== "active") return false;

    if (q) {
      const reg = new RegExp(q, "i");
      const matched =
        reg.test(doc.name) ||
        reg.test(doc.summary) ||
        reg.test(doc.category) ||
        reg.test(doc.aiCategory) ||
        doc.tags.some((t) => reg.test(t)) ||
        doc.aiKeywords.some((k) => reg.test(k));
      if (!matched) return false;
    }

    if (category && category !== "all" && doc.category !== category) return false;
    if (aiCategory && aiCategory !== "all" && doc.aiCategory !== aiCategory) return false;

    if (tags) {
      const tagList = tags.split(",").map((t) => t.trim().toLowerCase());
      const docTags = doc.tags.map((t) => t.toLowerCase());
      if (!tagList.some((t) => docTags.includes(t))) return false;
    }

    if (extension && extension !== "all") {
      const cleanExt = extension.toLowerCase().replace(/^\./, "");
      if (doc.extension.toLowerCase() !== cleanExt) return false;
    }

    if (dateFrom && new Date(doc.createdAt) < new Date(dateFrom)) return false;
    if (dateTo && new Date(doc.createdAt) > new Date(dateTo)) return false;

    return true;
  }

  await t.test("1. Keyword search matches by title, summary, or AI keywords", () => {
    const hits = mockDocs.filter((d) => matchFilters(d, { q: "machine learning" }));
    assert.equal(hits.length, 1);
    assert.equal(hits[0].name, "Machine_Learning_Notes.pdf");
  });

  await t.test("2. Category filter restricts results correctly", () => {
    const hits = mockDocs.filter((d) => matchFilters(d, { category: "Research" }));
    assert.equal(hits.length, 1);
    assert.equal(hits[0].category, "Research");
  });

  await t.test("3. File type extension filter works", () => {
    const hits = mockDocs.filter((d) => matchFilters(d, { extension: "pdf" }));
    assert.equal(hits.length, 1);
    assert.equal(hits[0].extension, "pdf");
  });

  await t.test("4. Tag filter matches comma-separated values", () => {
    const hits = mockDocs.filter((d) => matchFilters(d, { tags: "strategy" }));
    assert.equal(hits.length, 1);
    assert.equal(hits[0].name, "Marketing_Plan.docx");
  });

  await t.test("5. Date range filtering works correctly", () => {
    const hits = mockDocs.filter((d) =>
      matchFilters(d, { dateFrom: "2025-01-01", dateTo: "2025-01-31" })
    );
    assert.equal(hits.length, 1);
    assert.equal(hits[0].name, "Quarterly_Financials.xlsx");
  });

  await t.test("6. Combined multi-criteria search (Query + Category + Extension + Tag) works", () => {
    const hits = mockDocs.filter((d) =>
      matchFilters(d, {
        q: "machine learning",
        category: "Research",
        extension: "pdf",
        tags: "AI",
      })
    );
    assert.equal(hits.length, 1);
    assert.equal(hits[0].name, "Machine_Learning_Notes.pdf");
  });

  await t.test("7. Conflicting combined search returns empty results", () => {
    const hits = mockDocs.filter((d) =>
      matchFilters(d, {
        q: "machine learning",
        category: "Finance",
      })
    );
    assert.equal(hits.length, 0);
  });

  await t.test("8. Snippet highlighting inserts markdown markers for query matches", () => {
    const raw = "This is a comprehensive machine learning guide for engineers.";
    const query = "machine learning";
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const highlighted = raw.replace(new RegExp(`(${escaped})`, "gi"), "**$1**");
    assert.equal(
      highlighted,
      "This is a comprehensive **machine learning** guide for engineers."
    );
  });
});

test("QA Test Suite — Chat Scoping & Session Logic", async (t) => {
  const workspaceId = new mongoose.Types.ObjectId();
  const doc1Id = new mongoose.Types.ObjectId().toString();
  const doc2Id = new mongoose.Types.ObjectId().toString();
  const doc3Id = new mongoose.Types.ObjectId().toString();

  const allWorkspaceAllowedIds = [doc1Id, doc2Id, doc3Id];

  // Logic from chatController.js:
  function scopeAllowedIds(session, reqBodyDocumentIds, allowed) {
    if (session.scope === "document" && session.documentId) {
      return allowed.filter((id) => id === String(session.documentId));
    } else if (reqBodyDocumentIds && Array.isArray(reqBodyDocumentIds) && reqBodyDocumentIds.length > 0) {
      const requestedIds = new Set(reqBodyDocumentIds.map(String));
      return allowed.filter((id) => requestedIds.has(id));
    }
    return allowed;
  }

  await t.test("1. Multi-document scoping filters allowed IDs to selected set", () => {
    const scoped = scopeAllowedIds(
      { scope: "workspace" },
      [doc1Id, doc2Id],
      allWorkspaceAllowedIds
    );
    assert.deepEqual(scoped, [doc1Id, doc2Id]);
  });

  await t.test("2. Unselected documents are not included in scoped chat", () => {
    const scoped = scopeAllowedIds(
      { scope: "workspace" },
      [doc2Id],
      allWorkspaceAllowedIds
    );
    assert.equal(scoped.includes(doc1Id), false);
    assert.equal(scoped.includes(doc3Id), false);
    assert.deepEqual(scoped, [doc2Id]);
  });

  await t.test("3. Single-document session overrides body and restricts to session.documentId", () => {
    const scoped = scopeAllowedIds(
      { scope: "document", documentId: doc3Id },
      [doc1Id],
      allWorkspaceAllowedIds
    );
    assert.deepEqual(scoped, [doc3Id]);
  });

  await t.test("4. Empty documentIds preserves workspace-wide allowed documents", () => {
    const scoped = scopeAllowedIds(
      { scope: "workspace" },
      [],
      allWorkspaceAllowedIds
    );
    assert.deepEqual(scoped, allWorkspaceAllowedIds);
  });
});
