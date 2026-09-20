import "./config/env.js";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import connectDb from "./database/db.js";
import "./models/index.js";
import authRoutes from "./routes/authRoutes.js";
import workspaceRoutes from "./routes/workspaceRoutes.js";
import shareRoutes from "./routes/shareRoutes.js";
import { requeueStuckJobs } from "./services/aiJobs.js";

const port = process.env.PORT || 5005;
const clientOrigin =
  process.env.CLIENT_ORIGIN || process.env.CLIENT_URL || "http://localhost:5173";

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        origin === clientOrigin ||
        /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "express" });
});

app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/share", shareRoutes);

connectDb().then(() => {
  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
  setInterval(() => {
    requeueStuckJobs().catch((err) =>
      console.error("Stuck AI job sweep failed:", err.message)
    );
  }, 5 * 60 * 1000);
});
