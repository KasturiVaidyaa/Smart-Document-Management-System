import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    avatarUrl: String,
    personalWorkspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
    },
    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
    },
    notificationPrefs: {
      email: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true },
    },
  },
  { timestamps: true, collection: "users" }
);

export const User = mongoose.model("User", userSchema);
