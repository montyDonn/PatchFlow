import bcrypt from "bcrypt";
import crypto from "crypto";
import prisma from "../utils/prisma";
import { Role } from "../utils/constants";

export class AuthService {
  static async register(username: string, passwordRaw: string, name: string, role?: string) {
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      throw new Error("User already exists");
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(passwordRaw, salt);

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        salt,
        name,
        role: role || Role.DEVELOPER,
      },
    });

    console.log('[AuthService.register] User created:', user.userId);
    return this.createSession(user.userId, user.username, user.role);
  }

  static async login(username: string, passwordRaw: string) {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !user.isActive) {
      throw new Error("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(passwordRaw, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error("Invalid credentials");
    }

    // Delete all expired sessions for this user to keep the table clean
    await prisma.session.deleteMany({
      where: {
        userId: user.userId,
        expiresAt: { lt: new Date() },
      },
    });

    return this.createSession(user.userId, user.username, user.role);
  }

  private static async createSession(userId: string, username: string, role: string) {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    // Expires in 7 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt
      }
    });

    return { user: { userId, username, role }, token };
  }

  static async getUsers() {
    return prisma.user.findMany({
      select: { userId: true, username: true, name: true, role: true, isActive: true }
    });
  }
}
