import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { Document } from "../models/Document.js";
import { DocumentVersion } from "../models/DocumentVersion.js";
import { AiJob } from "../models/AiJob.js";
import { serializeDocument, reprocessDocument, getDocumentAiStatus } from "../controllers/documentController.js";
import { searchDocuments } from "../controllers/searchController.js";
import { sendChatMessage } from "../controllers/chatController.js";

test("Functional Test Suite — AI Reprocess, AI Status, Search Filters & Multi-Doc Chat", async (t) => {
  const workspaceId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();

  await t.test("1. serializeDocument includes summary, aiCategory, aiKeywords, and version processing", () => {
    const mockDoc = {
      _id: new mongoose.Types.ObjectId(),
      workspaceId,
      name: "Q3_Report.pdf",
      mimeType: "application/pdf",
      extension: "pdf",
      sizeBytes: 1048576,
      versionCount: 1,
      status: "active",
      category: "Finance",
      summary: "This report covers Q3 financial performance and earnings.",
      aiCategory: "Financial Report",
      aiKeywords: ["revenue", "profit", "ebitda"],
      currentVersionId: {
        processing: { extract: "ready", embed: "ready", classify: "ready" },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const serialized = serializeDocument(mockDoc);
    assert.equal(serialized.name, "Q3_Report.pdf");
    assert.equal(serialized.summary, "This report covers Q3 financial performance and earnings.");
    assert.equal(serialized.aiCategory, "Financial Report");
    assert.deepEqual(serialized.aiKeywords, ["revenue", "profit", "ebitda"]);
    assert.deepEqual(serialized.processing, { extract: "ready", embed: "ready", classify: "ready" });
  });

  await t.test("2. reprocessDocument rejects invalid document ID with 400", async () => {
    const req = {
      params: { documentId: "invalid-id" },
      workspace: { _id: workspaceId },
      user: { _id: userId },
    };
    let statusCode = null;
    let jsonBody = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonBody = data;
        return this;
      },
    };

    await reprocessDocument(req, res);
    assert.equal(statusCode, 400);
    assert.equal(jsonBody.message, "Invalid document id");
  });

  await t.test("3. getDocumentAiStatus rejects invalid document ID with 400", async () => {
    const req = {
      params: { documentId: "not-an-objectid" },
      workspace: { _id: workspaceId },
    };
    let statusCode = null;
    let jsonBody = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonBody = data;
        return this;
      },
    };

    await getDocumentAiStatus(req, res);
    assert.equal(statusCode, 400);
    assert.equal(jsonBody.message, "Invalid document id");
  });

  await t.test("4. searchDocuments returns empty arrays when no query and no filters provided", async () => {
    const req = {
      query: {},
      body: {},
      workspace: { _id: workspaceId },
    };
    let jsonBody = null;
    const res = {
      json(data) {
        jsonBody = data;
        return this;
      },
    };

    await searchDocuments(req, res);
    assert.deepEqual(jsonBody, { documents: [], semanticHits: [] });
  });
});
