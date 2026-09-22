import mongoose from "mongoose";

const userDocumentStateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
    },
    isFavorite: { type: Boolean, default: false },
    lastOpenedAt: Date,
  },
  { timestamps: true }
);

userDocumentStateSchema.index({ userId: 1, documentId: 1 }, { unique: true });

export const UserDocumentState = mongoose.model(
  "UserDocumentState",
  userDocumentStateSchema
);
