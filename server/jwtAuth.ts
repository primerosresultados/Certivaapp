import type { Request, Response, NextFunction, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import type { User, UserRole } from "@shared/schema";

// Define the user type for Express augmentation
interface AuthenticatedUser {
  id: string;
  email: string;
  passwordHash: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: string;
  businessId: string | null;
  isActive: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

// Augment Express Request type globally
declare global {
  namespace Express {
    interface Request {
      jwtPayload?: JWTPayload;
      user?: AuthenticatedUser;
    }
  }
}

const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  console.warn("WARNING: SESSION_SECRET not set. Using insecure default for development only.");
}
const EFFECTIVE_SECRET = JWT_SECRET || "certifiqr-dev-secret-not-for-production";
const JWT_EXPIRES_IN = "1h"; // Shorter access token for security
const REFRESH_EXPIRES_IN = "7d";
const SALT_ROUNDS = 10;

// Token blacklist for logout (in production, use Redis or database)
const revokedTokens = new Set<string>();

export function revokeToken(token: string): void {
  revokedTokens.add(token);
  // Clean up old tokens periodically (simple cleanup)
  if (revokedTokens.size > 10000) {
    revokedTokens.clear();
  }
}

export function isTokenRevoked(token: string): boolean {
  return revokedTokens.has(token);
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  businessId: string | null;
  type: "access" | "refresh";
}

// Type for user without password hash (safe for API responses)
export type SafeUser = Omit<User, "passwordHash">;

// Request types for use in routes
export type RequestWithJWT = Request & { jwtPayload: JWTPayload };
export type RequestWithUser = Request & { jwtPayload: JWTPayload; user: User };

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(user: User): string {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role as UserRole,
    businessId: user.businessId,
    type: "access",
  };
  return jwt.sign(payload, EFFECTIVE_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function generateRefreshToken(user: User): string {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role as UserRole,
    businessId: user.businessId,
    type: "refresh",
  };
  return jwt.sign(payload, EFFECTIVE_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    // Check if token is revoked
    if (isTokenRevoked(token)) {
      return null;
    }
    return jwt.verify(token, EFFECTIVE_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload || payload.type !== "access") {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  req.jwtPayload = payload;
  next();
};

export function requireRole(...allowedRoles: UserRole[]): RequestHandler {
  return async (req, res, next) => {
    try {
      if (!req.jwtPayload) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const user = await storage.getUser(req.jwtPayload.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      if (!user.isActive) {
        return res.status(403).json({ message: "Account is deactivated" });
      }
      
      // Superadmin always has access
      if (user.role === "superadmin") {
        req.user = user;
        return next();
      }
      
      if (!allowedRoles.includes(user.role as UserRole)) {
        return res.status(403).json({ message: "Forbidden: Insufficient permissions" });
      }
      
      req.user = user;
      next();
    } catch (error) {
      console.error("Authorization error:", error);
      res.status(500).json({ message: "Authorization failed" });
    }
  };
}

// Superadmin only middleware
export const requireSuperadmin = requireRole("superadmin");

// Admin or superadmin
export const requireAdmin = requireRole("superadmin", "admin");

// Admin, operator or superadmin
export const requireAdminOrOperator = requireRole("superadmin", "admin", "operator");

// Any authenticated role
export const requireAnyRole = requireRole("superadmin", "admin", "operator", "auditor");

// Helper to safely extract user without password hash
export function toSafeUser(user: User): SafeUser {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

// Helper to check if user is superadmin
export function isSuperadmin(user: User): boolean {
  return user.role === "superadmin";
}

// Helper to get businessId for queries (returns null for superadmin to see all)
export function getBusinessScope(user: User): string | undefined {
  if (user.role === "superadmin") {
    return undefined; // Superadmin sees all businesses
  }
  return user.businessId || undefined;
}

// Seed the superadmin user on startup
export async function seedSuperadmin(): Promise<void> {
  const SUPERADMIN_EMAIL = "jorge@primerosresultados.com";
  const SUPERADMIN_PASSWORD = "Sk843ver$123";
  
  try {
    const existingUser = await storage.getUserByEmail(SUPERADMIN_EMAIL);
    
    if (existingUser) {
      // Update to superadmin if not already
      if (existingUser.role !== "superadmin") {
        await storage.updateUser(existingUser.id, { role: "superadmin" });
        console.log(`Updated ${SUPERADMIN_EMAIL} to superadmin role`);
      } else {
        console.log(`Superadmin ${SUPERADMIN_EMAIL} already exists`);
      }
      return;
    }
    
    // Create the superadmin
    const passwordHash = await hashPassword(SUPERADMIN_PASSWORD);
    await storage.createUser({
      email: SUPERADMIN_EMAIL,
      passwordHash,
      firstName: "Jorge",
      lastName: "Admin",
      role: "superadmin",
    });
    
    console.log(`Created superadmin: ${SUPERADMIN_EMAIL}`);
  } catch (error) {
    console.error("Error seeding superadmin:", error);
  }
}
