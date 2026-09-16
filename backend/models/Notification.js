import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
    },
    type: {
      type: String,
      enum: [
        "shared",
        "permission_changed",
        "new_version",
        "access_expiring",
        "link_expiring",
        "access_requested",
        "access_expired",
      ],
      required: true,
    },
    payload: mongoose.Schema.Types.Mixed,
    readAt: Date,
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });

export const Notification = mongoose.model("Notification", notificationSchema);
