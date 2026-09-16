import mongoose from "mongoose";

const auditEventSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    actorEmail: String,
    action: { type: String, required: true },
    resourceType: String,
    resourceId: mongoose.Schema.Types.ObjectId,
    metadata: mongoose.Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditEventSchema.index({ workspaceId: 1, createdAt: 1 });
auditEventSchema.index({ resourceId: 1, createdAt: 1 });
auditEventSchema.index({ actorId: 1, createdAt: 1 });

export const AuditEvent = mongoose.model("AuditEvent", auditEventSchema);
