"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const task_routes_1 = __importDefault(require("./routes/task.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const module_routes_1 = __importDefault(require("./routes/module.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const team_routes_1 = __importDefault(require("./routes/team.routes"));
const report_routes_1 = __importDefault(require("./routes/report.routes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Health Check
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", message: "PatchFlow API is running" });
});
// API Routes
app.use("/api/auth", auth_routes_1.default);
app.use("/api/tasks", task_routes_1.default);
app.use("/api/notifications", notification_routes_1.default);
app.use("/api/modules", module_routes_1.default);
app.use("/api/users", user_routes_1.default);
app.use("/api/teams", team_routes_1.default);
app.use("/api/reports", report_routes_1.default);
exports.default = app;
