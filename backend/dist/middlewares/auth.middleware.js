"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = exports.authenticate = void 0;
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = __importDefault(require("../utils/prisma"));
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ error: "Unauthorized: Missing token" });
        }
        const token = authHeader.split(" ")[1];
        const tokenHash = crypto_1.default.createHash('sha256').update(token).digest('hex');
        const session = await prisma_1.default.session.findFirst({
            where: { tokenHash },
            include: { user: true }
        });
        if (!session || session.expiresAt < new Date() || !session.user.isActive) {
            return res.status(401).json({ error: "Unauthorized: Invalid or expired session" });
        }
        // Opportunistically clean up other expired sessions for this user
        // Fire and forget — don't await, don't let it block the request
        prisma_1.default.session.deleteMany({
            where: {
                userId: session.userId,
                expiresAt: { lt: new Date() },
            },
        }).catch(() => { });
        req.user = { userId: session.user.userId, role: session.user.role, username: session.user.username };
        next();
    }
    catch (error) {
        return res.status(500).json({ error: "Internal server error in authentication" });
    }
};
exports.authenticate = authenticate;
const authorize = (roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: "Forbidden: Insufficient permissions" });
        }
        next();
    };
};
exports.authorize = authorize;
