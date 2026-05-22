"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = __importDefault(require("../utils/prisma"));
const constants_1 = require("../utils/constants");
class AuthService {
    static async register(username, passwordRaw, name, role) {
        const existingUser = await prisma_1.default.user.findUnique({ where: { username } });
        if (existingUser) {
            throw new Error("User already exists");
        }
        const salt = await bcrypt_1.default.genSalt(12);
        const passwordHash = await bcrypt_1.default.hash(passwordRaw, salt);
        const user = await prisma_1.default.user.create({
            data: {
                username,
                passwordHash,
                salt,
                name,
                role: role || constants_1.Role.DEVELOPER,
            },
        });
        console.log('[AuthService.register] User created:', user.userId);
        return this.createSession(user.userId, user.username, user.role);
    }
    static async login(username, passwordRaw) {
        const user = await prisma_1.default.user.findUnique({ where: { username } });
        if (!user || !user.isActive) {
            throw new Error("Invalid credentials");
        }
        const isPasswordValid = await bcrypt_1.default.compare(passwordRaw, user.passwordHash);
        if (!isPasswordValid) {
            throw new Error("Invalid credentials");
        }
        // Delete all expired sessions for this user to keep the table clean
        await prisma_1.default.session.deleteMany({
            where: {
                userId: user.userId,
                expiresAt: { lt: new Date() },
            },
        });
        return this.createSession(user.userId, user.username, user.role);
    }
    static async createSession(userId, username, role) {
        const token = crypto_1.default.randomBytes(32).toString('hex');
        const tokenHash = crypto_1.default.createHash('sha256').update(token).digest('hex');
        // Expires in 7 days
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        await prisma_1.default.session.create({
            data: {
                userId,
                tokenHash,
                expiresAt
            }
        });
        return { user: { userId, username, role }, token };
    }
    static async getUsers() {
        return prisma_1.default.user.findMany({
            select: { userId: true, username: true, name: true, role: true, isActive: true }
        });
    }
}
exports.AuthService = AuthService;
