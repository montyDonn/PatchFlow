import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import taskRoutes from "./routes/task.routes";
import notificationRoutes from "./routes/notification.routes";
import moduleRoutes from "./routes/module.routes";
import userRoutes from "./routes/user.routes";
import teamRoutes from "./routes/team.routes";
import reportRoutes from "./routes/report.routes";

const app = express();

app.use(cors());
app.use(express.json());

// Health Check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "PatchFlow API is running" });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/modules", moduleRoutes);
app.use("/api/users", userRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/reports", reportRoutes);

export default app;
