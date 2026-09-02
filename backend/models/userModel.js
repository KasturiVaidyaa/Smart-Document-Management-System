import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["role1", "role2", "role3", "role4"],
      default: "role1",
      required: true,
    },

    // Roles 2 and 3 require admin verification.
    // Role 4 acts as admin. Role 1 is a regular user.
    isVerified: {
      type: Boolean,
      default: function () {
        // By default, auto-verify role1 (regular) and role4 (admin).
        // Roles 2 and 3 will remain unverified until an admin approves.
        return this.role === "role1" || this.role === "role4";
      },
    },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model("User", schema);