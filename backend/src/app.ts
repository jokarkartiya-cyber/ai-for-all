import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import rateLimit from "express-rate-limit";
import { config } from "./config";
import { errorHandler, notFoundHandler } from "./middleware/error";
import authRoutes from "./routes/auth";
import chatRoutes from "./routes/chats";
import userRoutes from "./routes/user";
import projectRoutes from "./routes/projects";
import aiRoutes from "./routes/ai";
import adminRoutes from "./routes/admin";
import uploadRoutes from "./routes/upload";

export const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", limiter);

app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "ai for all API is running", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/user", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

app.use(notFoundHandler);
app.use(errorHandler);
