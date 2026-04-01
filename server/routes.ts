import type { Express, Request, Response } from "express";
import { type Server } from "http";
import multer from "multer";
import * as XLSX from "xlsx";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import { nanoid } from "nanoid";
import { storage } from "./storage";
import { uploadFile } from "./supabaseStorage";
import { 
  isAuthenticated, 
  requireAdmin, 
  requireAdminOrOperator, 
  requireAnyRole,
  requireSuperadmin,
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  revokeToken,
  toSafeUser,
  getBusinessScope,
  isSuperadmin,
} from "./jwtAuth";
import { insertCertificateTypeSchema, insertBusinessSchema, userRoles, type UserRole } from "@shared/schema";
import { z } from "zod";

const upload = multer({ storage: multer.memoryStorage() });

function validateRut(rut: string): boolean {
  // Validate RUT: must be between 2 and 12 characters (Chilean RUTs are 7-9 digits + verifier)
  const cleanRut = rut.replace(/[^0-9kK]/g, '');
  return cleanRut.length >= 2 && cleanRut.length <= 12;
}

function generateCertificateNumber(): string {
  const year = new Date().getFullYear();
  const random = nanoid(8).toUpperCase();
  return `CERT-${year}-${random}`;
}

function formatRut(rut: string): string {
  const cleanRut = rut.replace(/[^0-9kK]/g, '');
  if (cleanRut.length < 2) return cleanRut;
  
  const body = cleanRut.slice(0, -1);
  const verifier = cleanRut.slice(-1).toUpperCase();
  
  let formatted = '';
  for (let i = body.length - 1, j = 0; i >= 0; i--, j++) {
    if (j > 0 && j % 3 === 0) {
      formatted = '.' + formatted;
    }
    formatted = body[i] + formatted;
  }
  
  return `${formatted}-${verifier}`;
}

/**
 * Parse a date string safely to avoid timezone shifts.
 * Date-only strings like "2026-04-01" are parsed as UTC midnight by JS,
 * which in negative-UTC timezones (like Chile, UTC-3) becomes the previous day.
 * Appending T12:00:00 keeps the date stable across all timezones.
 */
function parseDateSafe(date: string | Date): Date {
  if (date instanceof Date) return date;
  if (typeof date === 'string') {
    // YYYY-MM-DD (ISO format)
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Date(date + 'T12:00:00');
    }
    // DD-MM-YYYY or DD/MM/YYYY (Chilean format)
    const ddmmyyyy = date.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy;
      return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00`);
    }
  }
  return new Date(date);
}

/**
 * Convert a Date object to a YYYY-MM-DD string using local time (not UTC).
 * This avoids the issue where toISOString() returns UTC which can shift the date.
 */
function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Validation schemas
const registerSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  businessId: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Contraseña requerida"),
});

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // ============= AUTH ROUTES =============
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const validation = registerSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Datos inválidos", 
          errors: validation.error.flatten().fieldErrors 
        });
      }

      const { email, password, firstName, lastName, businessId } = validation.data;

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "El email ya está registrado" });
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Determine role: if registering with businessId, they're an operator for that business
      // If no users exist at all, make first user admin (but now we have superadmin so this rarely happens)
      const userCount = await storage.countUsers();
      const role: UserRole = userCount === 0 ? "admin" : "operator";

      // Create user
      const user = await storage.createUser({
        email,
        passwordHash,
        firstName,
        lastName,
        role,
        businessId,
      });

      // Generate tokens
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      res.status(201).json({
        message: "Usuario registrado exitosamente",
        user: toSafeUser(user),
        accessToken,
        refreshToken,
      });
    } catch (error) {
      console.error("Error registering user:", error);
      res.status(500).json({ message: "Error al registrar usuario" });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const validation = loginSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Datos inválidos", 
          errors: validation.error.flatten().fieldErrors 
        });
      }

      const { email, password } = validation.data;

      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user || !user.passwordHash) {
        return res.status(401).json({ message: "Credenciales inválidas" });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(403).json({ message: "Cuenta desactivada" });
      }

      // Verify password
      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ message: "Credenciales inválidas" });
      }

      // Generate tokens
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      // Get business info if user has one
      let business = null;
      if (user.businessId) {
        business = await storage.getBusiness(user.businessId);
      }

      res.json({
        message: "Inicio de sesión exitoso",
        user: toSafeUser(user),
        business,
        accessToken,
        refreshToken,
      });
    } catch (error) {
      console.error("Error logging in:", error);
      res.status(500).json({ message: "Error al iniciar sesión" });
    }
  });

  app.post('/api/auth/refresh', async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({ message: "Refresh token requerido" });
      }

      const payload = verifyToken(refreshToken);
      if (!payload || payload.type !== "refresh") {
        return res.status(401).json({ message: "Refresh token inválido" });
      }

      const user = await storage.getUser(payload.userId);
      if (!user || !user.isActive) {
        return res.status(401).json({ message: "Usuario no válido" });
      }

      // Generate new tokens
      const newAccessToken = generateAccessToken(user);
      const newRefreshToken = generateRefreshToken(user);

      // Revoke old refresh token
      revokeToken(refreshToken);

      res.json({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });
    } catch (error) {
      console.error("Error refreshing token:", error);
      res.status(500).json({ message: "Error al refrescar token" });
    }
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const accessToken = authHeader.substring(7);
        revokeToken(accessToken);
      }
      
      if (refreshToken) {
        revokeToken(refreshToken);
      }
      
      res.json({ message: "Sesión cerrada exitosamente" });
    } catch (error) {
      console.error("Error logging out:", error);
      res.status(500).json({ message: "Error al cerrar sesión" });
    }
  });

  // Change password endpoint
  app.patch('/api/auth/password', isAuthenticated, requireAnyRole, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "No autorizado" });
      }

      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Contraseña actual y nueva requeridas" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "La nueva contraseña debe tener al menos 6 caracteres" });
      }

      // Get user with password hash
      const user = await storage.getUser(req.user.id);
      if (!user || !user.passwordHash) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      // Verify current password
      const isValidPassword = await verifyPassword(currentPassword, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ message: "La contraseña actual es incorrecta" });
      }

      // Hash new password and update
      const newPasswordHash = await hashPassword(newPassword);
      await storage.updateUserPassword(user.id, newPasswordHash);

      res.json({ message: "Contraseña actualizada exitosamente" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Error al cambiar la contraseña" });
    }
  });

  app.get('/api/auth/user', isAuthenticated, requireAnyRole, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Get business info if user has one
      let business = null;
      if (req.user.businessId) {
        business = await storage.getBusiness(req.user.businessId);
      }
      
      res.json({
        ...toSafeUser(req.user),
        business,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ============= BUSINESS ROUTES (Superadmin only) =============
  app.get("/api/businesses", isAuthenticated, requireSuperadmin, async (req: Request, res: Response) => {
    try {
      const businesses = await storage.getBusinesses();
      res.json(businesses);
    } catch (error) {
      console.error("Error fetching businesses:", error);
      res.status(500).json({ message: "Failed to fetch businesses" });
    }
  });

  app.get("/api/businesses/:id", isAuthenticated, requireSuperadmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const business = await storage.getBusiness(id);
      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }
      res.json(business);
    } catch (error) {
      console.error("Error fetching business:", error);
      res.status(500).json({ message: "Failed to fetch business" });
    }
  });

  const createBusinessWithAdminSchema = z.object({
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    slug: z.string().min(2, "El slug debe tener al menos 2 caracteres").regex(/^[a-z0-9-]+$/, "Solo letras minúsculas, números y guiones"),
    adminEmail: z.string().email("Email inválido"),
    adminPassword: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
    adminFirstName: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    adminLastName: z.string().min(2, "El apellido debe tener al menos 2 caracteres"),
  });

  app.post("/api/businesses", isAuthenticated, requireSuperadmin, async (req: Request, res: Response) => {
    try {
      const validation = createBusinessWithAdminSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Datos inválidos", errors: validation.error.flatten().fieldErrors });
      }
      
      const { name, slug, adminEmail, adminPassword, adminFirstName, adminLastName } = validation.data;
      
      // Check if slug is unique
      const existingBusiness = await storage.getBusinessBySlug(slug);
      if (existingBusiness) {
        return res.status(409).json({ message: "El identificador ya está en uso" });
      }
      
      // Check if admin email is unique
      const existingUser = await storage.getUserByEmail(adminEmail);
      if (existingUser) {
        return res.status(409).json({ message: "El email del administrador ya está registrado" });
      }
      
      // Create business
      const business = await storage.createBusiness({ name, slug });
      
      // Create admin user for the business
      const passwordHash = await hashPassword(adminPassword);
      await storage.createUser({
        email: adminEmail,
        passwordHash,
        firstName: adminFirstName,
        lastName: adminLastName,
        role: "admin",
        businessId: business.id,
      });
      
      res.status(201).json(business);
    } catch (error) {
      console.error("Error creating business:", error);
      res.status(500).json({ message: "Failed to create business" });
    }
  });

  app.patch("/api/businesses/:id", isAuthenticated, requireSuperadmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, slug, adminEmail, adminPassword } = req.body;
      
      // If changing slug, check uniqueness
      if (slug) {
        const existingBusiness = await storage.getBusinessBySlug(slug);
        if (existingBusiness && existingBusiness.id !== id) {
          return res.status(409).json({ message: "El identificador ya está en uso" });
        }
      }
      
      const business = await storage.updateBusiness(id, { name, slug });
      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }

      // Si se proporciona email o contraseña, actualizar el primer admin encontrado para esta empresa
      if ((adminEmail && adminEmail.length > 0) || (adminPassword && adminPassword.length >= 6)) {
        const users = await storage.getUsersByBusiness(id);
        const admin = users.find(u => u.role === "admin");
        if (admin) {
          const updateData: any = {};
          if (adminEmail) {
            // Verificar si el nuevo email ya está en uso por otro usuario
            const existingUser = await storage.getUserByEmail(adminEmail);
            if (existingUser && existingUser.id !== admin.id) {
              return res.status(409).json({ message: "El email ya está en uso" });
            }
            updateData.email = adminEmail.toLowerCase();
          }
          if (adminPassword) {
            updateData.passwordHash = await hashPassword(adminPassword);
          }
          await storage.updateUser(admin.id, updateData);
        }
      }

      res.json(business);
    } catch (error) {
      console.error("Error updating business:", error);
      res.status(500).json({ message: "Failed to update business" });
    }
  });

  // Create user for a business (Superadmin only)
  app.post("/api/businesses/:id/users", isAuthenticated, requireSuperadmin, async (req: Request, res: Response) => {
    try {
      const { id: businessId } = req.params;
      const { email, password, firstName, lastName, role } = req.body;
      
      // Validate business exists
      const business = await storage.getBusiness(businessId);
      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "El email ya está registrado" });
      }
      
      // Validate role (can't create superadmin through this endpoint)
      const allowedRoles: UserRole[] = ["admin", "operator", "auditor"];
      if (role && !allowedRoles.includes(role)) {
        return res.status(400).json({ message: "Rol no válido" });
      }
      
      const passwordHash = await hashPassword(password);
      const user = await storage.createUser({
        email,
        passwordHash,
        firstName,
        lastName,
        role: role || "operator",
        businessId,
      });
      
      res.status(201).json(toSafeUser(user));
    } catch (error) {
      console.error("Error creating user for business:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Get users for a business (Superadmin only)
  app.get("/api/businesses/:id/users", isAuthenticated, requireSuperadmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const users = await storage.getUsersByBusiness(id);
      res.json(users.map(toSafeUser));
    } catch (error) {
      console.error("Error fetching business users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Create admin for a business (Superadmin only)
  const createAdminSchema = z.object({
    email: z.string().email("Email inválido"),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    firstName: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    lastName: z.string().min(2, "El apellido debe tener al menos 2 caracteres"),
  });
  
  app.post("/api/businesses/:id/admin", isAuthenticated, requireSuperadmin, async (req: Request, res: Response) => {
    try {
      const { id: businessId } = req.params;
      
      // Validate request body
      const validation = createAdminSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Datos inválidos", 
          errors: validation.error.flatten().fieldErrors 
        });
      }
      
      const { email, password, firstName, lastName } = validation.data;
      
      // Validate business exists
      const business = await storage.getBusiness(businessId);
      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "El email ya está registrado" });
      }
      
      const passwordHash = await hashPassword(password);
      const user = await storage.createUser({
        email,
        passwordHash,
        firstName,
        lastName,
        role: "admin",
        businessId,
      });
      
      res.status(201).json(toSafeUser(user));
    } catch (error) {
      console.error("Error creating admin for business:", error);
      res.status(500).json({ message: "Failed to create admin" });
    }
  });

  // Delete business (Superadmin only)
  app.delete("/api/businesses/:id", isAuthenticated, requireSuperadmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Check business exists
      const business = await storage.getBusiness(id);
      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }
      
      await storage.deleteBusiness(id);
      res.json({ message: "Business deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting business:", error?.message || error);
      console.error("Stack:", error?.stack);
      res.status(500).json({ message: error?.message || "Failed to delete business" });
    }
  });

  // Upload business logo (Admin only)
  app.patch("/api/business/logo", isAuthenticated, requireAdmin, upload.single("logo"), async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "No autorizado" });
      }

      if (!req.user.businessId) {
        return res.status(400).json({ message: "Usuario no tiene empresa asignada" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No se proporcionó imagen" });
      }

      // Validate file type
      const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ message: "Tipo de archivo no permitido. Use PNG, JPG, SVG o WebP." });
      }

      // Validate file size (max 2MB)
      const maxSize = 2 * 1024 * 1024;
      if (req.file.size > maxSize) {
        return res.status(400).json({ message: "El archivo es demasiado grande. Máximo 2MB." });
      }

      // Upload to Supabase Storage
      const logoUrl = await uploadFile(req.file.buffer, req.file.mimetype, "business-logos");

      // Update business with logo
      const business = await storage.updateBusiness(req.user.businessId, { logoUrl });
      if (!business) {
        return res.status(404).json({ message: "Empresa no encontrada" });
      }

      res.json({ message: "Logo actualizado exitosamente", logoUrl: business.logoUrl });
    } catch (error) {
      console.error("Error uploading business logo:", error);
      res.status(500).json({ message: "Error al subir el logo" });
    }
  });

  // Update business info link (Admin only)
  app.patch("/api/business/info-link", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "No autorizado" });
      }

      if (!req.user.businessId) {
        return res.status(400).json({ message: "Usuario no tiene empresa asignada" });
      }

      const { infoLink } = req.body;
      
      // Validate URL if provided
      if (infoLink && infoLink.trim() !== "") {
        try {
          new URL(infoLink);
        } catch {
          return res.status(400).json({ message: "La URL proporcionada no es válida" });
        }
      }

      // Update business with info link
      const business = await storage.updateBusiness(req.user.businessId, { 
        infoLink: infoLink?.trim() || null 
      });
      if (!business) {
        return res.status(404).json({ message: "Empresa no encontrada" });
      }

      res.json({ message: "Enlace actualizado exitosamente", infoLink: business.infoLink });
    } catch (error) {
      console.error("Error updating business info link:", error);
      res.status(500).json({ message: "Error al actualizar el enlace" });
    }
  });

  // ============= USER MANAGEMENT ROUTES =============
  app.get("/api/users", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const businessId = getBusinessScope(req.user!);
      const users = await storage.getAllUsers(businessId);
      const safeUsers = users.map(toSafeUser);
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch("/api/users/:id/role", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { role } = req.body;
      
      // Validate role
      const allowedRoles: UserRole[] = isSuperadmin(req.user!) 
        ? ["superadmin", "admin", "operator", "auditor"]
        : ["admin", "operator", "auditor"];
      
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      
      // Prevent changing own role
      if (req.user && id === req.user.id) {
        return res.status(400).json({ message: "Cannot change your own role" });
      }
      
      // Check if target user is in same business (unless superadmin)
      if (!isSuperadmin(req.user!)) {
        const targetUser = await storage.getUser(id);
        if (!targetUser || targetUser.businessId !== req.user!.businessId) {
          return res.status(403).json({ message: "Cannot modify users from other businesses" });
        }
      }
      
      const user = await storage.updateUserRole(id, role);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(toSafeUser(user));
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  app.patch("/api/users/:id/status", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      
      // Prevent deactivating self
      if (req.user && id === req.user.id) {
        return res.status(400).json({ message: "Cannot change your own status" });
      }
      
      // Check if target user is in same business (unless superadmin)
      if (!isSuperadmin(req.user!)) {
        const targetUser = await storage.getUser(id);
        if (!targetUser || targetUser.businessId !== req.user!.businessId) {
          return res.status(403).json({ message: "Cannot modify users from other businesses" });
        }
      }
      
      const user = await storage.updateUser(id, { isActive });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(toSafeUser(user));
    } catch (error) {
      console.error("Error updating user status:", error);
      res.status(500).json({ message: "Failed to update user status" });
    }
  });

  // ============= DASHBOARD STATS =============
  app.get("/api/dashboard/stats", isAuthenticated, requireAnyRole, async (req: Request, res: Response) => {
    try {
      const businessId = getBusinessScope(req.user!);
      const stats = await storage.getDashboardStats(businessId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // ============= CERTIFICATE TYPES =============
  app.get("/api/certificate-types", isAuthenticated, requireAnyRole, async (req: Request, res: Response) => {
    try {
      const businessId = getBusinessScope(req.user!);
      const types = await storage.getCertificateTypes(businessId);
      
      // Include customFields for each type
      const typesWithFields = await Promise.all(
        types.map(async (type) => {
          const customFields = await storage.getCustomFieldsByCertificateType(type.id);
          return { ...type, customFields };
        })
      );
      
      res.json(typesWithFields);
    } catch (error) {
      console.error("Error fetching certificate types:", error);
      res.status(500).json({ message: "Failed to fetch certificate types" });
    }
  });

  app.get("/api/certificate-types/counts", isAuthenticated, requireAnyRole, async (req: Request, res: Response) => {
    try {
      const businessId = getBusinessScope(req.user!);
      const counts = await storage.getCertificateTypeCounts(businessId);
      res.json(counts);
    } catch (error) {
      console.error("Error fetching certificate type counts:", error);
      res.status(500).json({ message: "Failed to fetch certificate type counts" });
    }
  });

  app.post("/api/certificate-types", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const businessId = req.user!.businessId;
      
      // Superadmin must specify businessId
      if (isSuperadmin(req.user!) && !req.body.businessId) {
        return res.status(400).json({ message: "Business ID is required for superadmin" });
      }
      
      const dataWithBusiness = {
        ...req.body,
        businessId: req.body.businessId || businessId,
      };
      
      const validation = insertCertificateTypeSchema.safeParse(dataWithBusiness);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid data", errors: validation.error.flatten() });
      }
      const type = await storage.createCertificateType(validation.data);
      res.status(201).json(type);
    } catch (error) {
      console.error("Error creating certificate type:", error);
      res.status(500).json({ message: "Failed to create certificate type" });
    }
  });

  app.patch("/api/certificate-types/:id", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Verify ownership unless superadmin
      if (!isSuperadmin(req.user!)) {
        const existingType = await storage.getCertificateType(id);
        if (!existingType || existingType.businessId !== req.user!.businessId) {
          return res.status(403).json({ message: "Cannot modify certificate types from other businesses" });
        }
      }
      
      const type = await storage.updateCertificateType(id, req.body);
      if (!type) {
        return res.status(404).json({ message: "Certificate type not found" });
      }
      res.json(type);
    } catch (error) {
      console.error("Error updating certificate type:", error);
      res.status(500).json({ message: "Failed to update certificate type" });
    }
  });

  app.delete("/api/certificate-types/:id", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Verify ownership unless superadmin
      if (!isSuperadmin(req.user!)) {
        const existingType = await storage.getCertificateType(id);
        if (!existingType || existingType.businessId !== req.user!.businessId) {
          return res.status(403).json({ message: "Cannot delete certificate types from other businesses" });
        }
      }
      
      const success = await storage.deleteCertificateType(id);
      if (!success) {
        return res.status(400).json({ message: "Cannot delete certificate type with associated certificates" });
      }
      res.json({ message: "Certificate type deleted" });
    } catch (error) {
      console.error("Error deleting certificate type:", error);
      res.status(500).json({ message: "Failed to delete certificate type" });
    }
  });

  // Get certificate type with signers and logos
  app.get("/api/certificate-types/:id/details", isAuthenticated, requireAnyRole, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const typeWithDetails = await storage.getCertificateTypeWithDetails(id);
      
      if (!typeWithDetails) {
        return res.status(404).json({ message: "Certificate type not found" });
      }
      
      // Verify access unless superadmin
      if (!isSuperadmin(req.user!) && typeWithDetails.businessId !== req.user!.businessId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(typeWithDetails);
    } catch (error) {
      console.error("Error fetching certificate type details:", error);
      res.status(500).json({ message: "Failed to fetch certificate type details" });
    }
  });

  // ============= CERTIFICATE TYPE SIGNERS =============
  const signerSchema = z.object({
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    position: z.string().min(2, "El cargo debe tener al menos 2 caracteres"),
    displayOrder: z.coerce.number().min(0).default(0),
  });

  app.get("/api/certificate-types/:id/signers", isAuthenticated, requireAnyRole, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Verify certificate type exists and user has access
      const certType = await storage.getCertificateType(id);
      if (!certType) {
        return res.status(404).json({ message: "Certificate type not found" });
      }
      if (!isSuperadmin(req.user!) && certType.businessId !== req.user!.businessId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const signers = await storage.getSignersByCertificateType(id);
      res.json(signers);
    } catch (error) {
      console.error("Error fetching signers:", error);
      res.status(500).json({ message: "Failed to fetch signers" });
    }
  });

  app.post("/api/certificate-types/:id/signers", isAuthenticated, requireAdmin, upload.single("signature"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Verify certificate type exists and user has access
      const certType = await storage.getCertificateType(id);
      if (!certType) {
        return res.status(404).json({ message: "Certificate type not found" });
      }
      if (!isSuperadmin(req.user!) && certType.businessId !== req.user!.businessId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const validation = signerSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid data", errors: validation.error.flatten().fieldErrors });
      }
      
      // Handle signature image upload to Supabase Storage
      let signatureUrl: string | undefined;
      if (req.file) {
        signatureUrl = await uploadFile(req.file.buffer, req.file.mimetype, "signatures");
      }
      
      const signer = await storage.createSigner({
        certificateTypeId: id,
        name: validation.data.name,
        position: validation.data.position,
        signatureUrl,
        displayOrder: validation.data.displayOrder,
      });
      
      res.status(201).json(signer);
    } catch (error) {
      console.error("Error creating signer:", error);
      res.status(500).json({ message: "Failed to create signer" });
    }
  });

  app.patch("/api/certificate-types/:typeId/signers/:signerId", isAuthenticated, requireAdmin, upload.single("signature"), async (req: Request, res: Response) => {
    try {
      const { typeId, signerId } = req.params;
      
      // Verify certificate type exists and user has access
      const certType = await storage.getCertificateType(typeId);
      if (!certType) {
        return res.status(404).json({ message: "Certificate type not found" });
      }
      if (!isSuperadmin(req.user!) && certType.businessId !== req.user!.businessId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updateData: any = {};
      
      if (req.body.name) updateData.name = req.body.name;
      if (req.body.position) updateData.position = req.body.position;
      if (req.body.displayOrder !== undefined) updateData.displayOrder = parseInt(req.body.displayOrder);
      
      // Handle signature image upload to Supabase Storage
      if (req.file) {
        updateData.signatureUrl = await uploadFile(req.file.buffer, req.file.mimetype, "signatures");
      }
      
      const signer = await storage.updateSigner(signerId, updateData);
      if (!signer) {
        return res.status(404).json({ message: "Signer not found" });
      }
      
      res.json(signer);
    } catch (error) {
      console.error("Error updating signer:", error);
      res.status(500).json({ message: "Failed to update signer" });
    }
  });

  app.delete("/api/certificate-types/:typeId/signers/:signerId", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { typeId, signerId } = req.params;
      
      // Verify certificate type exists and user has access
      const certType = await storage.getCertificateType(typeId);
      if (!certType) {
        return res.status(404).json({ message: "Certificate type not found" });
      }
      if (!isSuperadmin(req.user!) && certType.businessId !== req.user!.businessId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const success = await storage.deleteSigner(signerId);
      if (!success) {
        return res.status(404).json({ message: "Signer not found" });
      }
      
      res.json({ message: "Signer deleted" });
    } catch (error) {
      console.error("Error deleting signer:", error);
      res.status(500).json({ message: "Failed to delete signer" });
    }
  });

  // ============= CERTIFICATE TYPE LOGOS =============
  const logoSchema = z.object({
    name: z.string().optional(),
    displayOrder: z.coerce.number().min(0).default(0),
  });

  app.get("/api/certificate-types/:id/logos", isAuthenticated, requireAnyRole, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Verify certificate type exists and user has access
      const certType = await storage.getCertificateType(id);
      if (!certType) {
        return res.status(404).json({ message: "Certificate type not found" });
      }
      if (!isSuperadmin(req.user!) && certType.businessId !== req.user!.businessId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const logos = await storage.getLogosByCertificateType(id);
      res.json(logos);
    } catch (error) {
      console.error("Error fetching logos:", error);
      res.status(500).json({ message: "Failed to fetch logos" });
    }
  });

  app.post("/api/certificate-types/:id/logos", isAuthenticated, requireAdmin, upload.single("logo"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Verify certificate type exists and user has access
      const certType = await storage.getCertificateType(id);
      if (!certType) {
        return res.status(404).json({ message: "Certificate type not found" });
      }
      if (!isSuperadmin(req.user!) && certType.businessId !== req.user!.businessId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Logo file is required
      if (!req.file) {
        return res.status(400).json({ message: "Logo image is required" });
      }
      
      const validation = logoSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid data", errors: validation.error.flatten().fieldErrors });
      }
      
      // Upload to Supabase Storage
      const logoUrl = await uploadFile(req.file.buffer, req.file.mimetype, "cert-logos");
      
      const logo = await storage.createLogo({
        certificateTypeId: id,
        name: validation.data.name,
        logoUrl,
        displayOrder: validation.data.displayOrder,
      });
      
      res.status(201).json(logo);
    } catch (error) {
      console.error("Error creating logo:", error);
      res.status(500).json({ message: "Failed to create logo" });
    }
  });

  app.patch("/api/certificate-types/:typeId/logos/:logoId", isAuthenticated, requireAdmin, upload.single("logo"), async (req: Request, res: Response) => {
    try {
      const { typeId, logoId } = req.params;
      
      // Verify certificate type exists and user has access
      const certType = await storage.getCertificateType(typeId);
      if (!certType) {
        return res.status(404).json({ message: "Certificate type not found" });
      }
      if (!isSuperadmin(req.user!) && certType.businessId !== req.user!.businessId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updateData: any = {};
      
      if (req.body.name !== undefined) updateData.name = req.body.name;
      if (req.body.displayOrder !== undefined) updateData.displayOrder = parseInt(req.body.displayOrder);
      
      // Handle logo image upload to Supabase Storage
      if (req.file) {
        updateData.logoUrl = await uploadFile(req.file.buffer, req.file.mimetype, "cert-logos");
      }
      
      const logo = await storage.updateLogo(logoId, updateData);
      if (!logo) {
        return res.status(404).json({ message: "Logo not found" });
      }
      
      res.json(logo);
    } catch (error) {
      console.error("Error updating logo:", error);
      res.status(500).json({ message: "Failed to update logo" });
    }
  });

  app.delete("/api/certificate-types/:typeId/logos/:logoId", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { typeId, logoId } = req.params;
      
      // Verify certificate type exists and user has access
      const certType = await storage.getCertificateType(typeId);
      if (!certType) {
        return res.status(404).json({ message: "Certificate type not found" });
      }
      if (!isSuperadmin(req.user!) && certType.businessId !== req.user!.businessId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const success = await storage.deleteLogo(logoId);
      if (!success) {
        return res.status(404).json({ message: "Logo not found" });
      }
      
      res.json({ message: "Logo deleted" });
    } catch (error) {
      console.error("Error deleting logo:", error);
      res.status(500).json({ message: "Failed to delete logo" });
    }
  });

  // ============= CUSTOM FIELDS =============
  const customFieldSchema = z.object({
    fieldName: z.string().min(1, "El nombre del campo es requerido").max(100),
    fieldLabel: z.string().min(1, "La etiqueta es requerida").max(255),
    fieldType: z.enum(["text", "number", "date", "select"]).default("text"),
    isRequired: z.boolean().default(false),
    displayOrder: z.coerce.number().min(0).default(0),
  });

  app.get("/api/certificate-types/:id/custom-fields", isAuthenticated, requireAnyRole, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const certType = await storage.getCertificateType(id);
      if (!certType) {
        return res.status(404).json({ message: "Certificate type not found" });
      }
      if (!isSuperadmin(req.user!) && certType.businessId !== req.user!.businessId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const fields = await storage.getCustomFieldsByCertificateType(id);
      res.json(fields);
    } catch (error) {
      console.error("Error fetching custom fields:", error);
      res.status(500).json({ message: "Failed to fetch custom fields" });
    }
  });

  app.post("/api/certificate-types/:id/custom-fields", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const certType = await storage.getCertificateType(id);
      if (!certType) {
        return res.status(404).json({ message: "Certificate type not found" });
      }
      if (!isSuperadmin(req.user!) && certType.businessId !== req.user!.businessId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const validation = customFieldSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid data", errors: validation.error.flatten().fieldErrors });
      }
      
      const field = await storage.createCustomField({
        certificateTypeId: id,
        ...validation.data,
      });
      
      res.status(201).json(field);
    } catch (error) {
      console.error("Error creating custom field:", error);
      res.status(500).json({ message: "Failed to create custom field" });
    }
  });

  app.patch("/api/certificate-types/:typeId/custom-fields/:fieldId", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { typeId, fieldId } = req.params;
      
      const certType = await storage.getCertificateType(typeId);
      if (!certType) {
        return res.status(404).json({ message: "Certificate type not found" });
      }
      if (!isSuperadmin(req.user!) && certType.businessId !== req.user!.businessId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const validation = customFieldSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid data", errors: validation.error.flatten().fieldErrors });
      }
      
      const field = await storage.updateCustomField(fieldId, validation.data);
      if (!field) {
        return res.status(404).json({ message: "Custom field not found" });
      }
      
      res.json(field);
    } catch (error) {
      console.error("Error updating custom field:", error);
      res.status(500).json({ message: "Failed to update custom field" });
    }
  });

  app.delete("/api/certificate-types/:typeId/custom-fields/:fieldId", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { typeId, fieldId } = req.params;
      
      const certType = await storage.getCertificateType(typeId);
      if (!certType) {
        return res.status(404).json({ message: "Certificate type not found" });
      }
      if (!isSuperadmin(req.user!) && certType.businessId !== req.user!.businessId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const success = await storage.deleteCustomField(fieldId);
      if (!success) {
        return res.status(404).json({ message: "Custom field not found" });
      }
      
      res.json({ message: "Custom field deleted" });
    } catch (error) {
      console.error("Error deleting custom field:", error);
      res.status(500).json({ message: "Failed to delete custom field" });
    }
  });

  // ============= CERTIFICATES =============
  app.get("/api/certificates", isAuthenticated, requireAnyRole, async (req: Request, res: Response) => {
    try {
      const { search, status, type, page, perPage } = req.query;
      const businessId = getBusinessScope(req.user!);
      const result = await storage.getCertificates({
        search: search as string,
        status: status as string,
        type: type as string,
        page: page ? parseInt(page as string) : 1,
        perPage: perPage ? parseInt(perPage as string) : 25,
        businessId,
      });
      res.json(result);
    } catch (error) {
      console.error("Error fetching certificates:", error);
      res.status(500).json({ message: "Failed to fetch certificates" });
    }
  });

  // Download multiple certificates as ZIP (must be before :id route)
  app.get("/api/certificates/download-zip", isAuthenticated, requireAnyRole, async (req: Request, res: Response) => {
    try {
      const { search, status, type, ids } = req.query;
      const businessId = getBusinessScope(req.user!);
      
      // Get filtered certificates (without pagination)
      const allCerts = await storage.getCertificates({
        businessId,
        search: search as string | undefined,
        status: status as string | undefined,
        type: type as string | undefined,
        page: 1,
        perPage: 10000, // Get all matching certificates
      });

      // If specific IDs are provided, filter to only those certificates
      let certsToExport = allCerts.certificates;
      if (ids && typeof ids === 'string') {
        const selectedIds = new Set(ids.split(',').map(id => id.trim()));
        certsToExport = allCerts.certificates.filter(cert => selectedIds.has(cert.id));
      }

      if (certsToExport.length === 0) {
        return res.status(404).json({ message: "No hay certificados para descargar" });
      }

      const zip = new JSZip();
      
      // Generate PDF for each certificate and add to ZIP
      for (const cert of certsToExport) {
        try {
          // Generate PDF for this certificate using localhost to avoid network issues
          const port = process.env.PORT || 5000;
          const pdfResponse = await fetch(`http://localhost:${port}/api/certificates/${cert.id}/pdf?template=clasico-dorado`, {
            headers: {
              'Authorization': req.headers.authorization || ''
            }
          });
          
          if (pdfResponse.ok) {
            const pdfBuffer = await pdfResponse.arrayBuffer();
            const sanitizedRut = cert.studentRut.replace(/\./g, '').replace(/-/g, '');
            const sanitizedName = cert.studentName.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').replace(/\s+/g, '_');
            const sanitizedCourse = cert.certificateType?.name?.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').replace(/\s+/g, '_') || 'Certificado';
            const fileName = `${sanitizedRut}-${sanitizedName}-${sanitizedCourse}.pdf`;
            zip.file(fileName, pdfBuffer);
          } else {
            console.error(`Error fetching PDF for certificate ${cert.id}: ${pdfResponse.status}`);
          }
        } catch (e) {
          console.error(`Error generating PDF for certificate ${cert.id}:`, e);
        }
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="Certificados-${new Date().toISOString().split('T')[0]}.zip"`);
      res.send(zipBuffer);
    } catch (error) {
      console.error("Error generating ZIP:", error);
      res.status(500).json({ message: "Failed to generate ZIP file" });
    }
  });

  app.get("/api/certificates/:id", isAuthenticated, requireAnyRole, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const certificate = await storage.getCertificate(id);
      if (!certificate) {
        return res.status(404).json({ message: "Certificate not found" });
      }
      
      // Verify access unless superadmin
      if (!isSuperadmin(req.user!) && certificate.businessId !== req.user!.businessId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Get custom fields for the certificate type
      const certTypeWithDetails = await storage.getCertificateTypeWithDetails(certificate.certificateTypeId);
      const customFields = certTypeWithDetails?.customFields || [];
      
      // Include customFields in the response
      res.json({
        ...certificate,
        certificateType: {
          ...certificate.certificateType,
          customFields,
        },
      });
    } catch (error) {
      console.error("Error fetching certificate:", error);
      res.status(500).json({ message: "Failed to fetch certificate" });
    }
  });

  app.delete("/api/certificates/:id", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const certificate = await storage.getCertificate(id);
      if (!certificate) {
        return res.status(404).json({ message: "Certificado no encontrado" });
      }
      
      // Verify access unless superadmin
      if (!isSuperadmin(req.user!) && certificate.businessId !== req.user!.businessId) {
        return res.status(403).json({ message: "Acceso denegado" });
      }
      
      const success = await storage.deleteCertificate(id);
      if (!success) {
        return res.status(500).json({ message: "Error al eliminar el certificado" });
      }
      
      res.json({ message: "Certificado eliminado exitosamente" });
    } catch (error) {
      console.error("Error deleting certificate:", error);
      res.status(500).json({ message: "Error al eliminar el certificado" });
    }
  });

  // Bulk delete certificates
  app.post("/api/certificates/bulk-delete", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "Se requiere un array de IDs" });
      }

      if (ids.length > 500) {
        return res.status(400).json({ message: "Máximo 500 certificados a la vez" });
      }

      // Verify business access for non-superadmin users
      if (!isSuperadmin(req.user!)) {
        for (const id of ids) {
          const cert = await storage.getCertificate(id);
          if (cert && cert.businessId !== req.user!.businessId) {
            return res.status(403).json({ message: "Acceso denegado a uno o más certificados" });
          }
        }
      }

      const deleted = await storage.deleteCertificates(ids);
      res.json({ message: `${deleted} certificados eliminados`, deleted });
    } catch (error) {
      console.error("Error bulk deleting certificates:", error);
      res.status(500).json({ message: "Error al eliminar los certificados" });
    }
  });

  app.get("/api/certificates/:id/qr", isAuthenticated, requireAnyRole, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const certificate = await storage.getCertificate(id);
      if (!certificate) {
        return res.status(404).json({ message: "Certificate not found" });
      }

      // Verify access unless superadmin
      if (!isSuperadmin(req.user!) && certificate.businessId !== req.user!.businessId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validationUrl = `${req.protocol}://${req.get('host')}/validate/${id}`;
      const qrBuffer = await QRCode.toBuffer(validationUrl, {
        type: 'png',
        width: 512,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      });

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `attachment; filename="QR-${certificate.certificateNumber}.png"`);
      res.send(qrBuffer);
    } catch (error) {
      console.error("Error generating QR:", error);
      res.status(500).json({ message: "Failed to generate QR code" });
    }
  });

  // Create a single certificate manually
  const createCertificateSchema = z.object({
    studentName: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    studentRut: z.string().min(1, "RUT requerido"),
    certificateTypeId: z.string().min(1, "Tipo de certificado requerido"),
    issueDate: z.string().min(1, "Fecha de emisión requerida"),
    companyId: z.string().optional(),
    customFieldValues: z.record(z.string()).optional(),
  });

  app.post("/api/certificates", isAuthenticated, requireAdminOrOperator, async (req: Request, res: Response) => {
    try {
      const validation = createCertificateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Datos inválidos", 
          errors: validation.error.flatten().fieldErrors 
        });
      }

      const { studentName, studentRut, certificateTypeId, issueDate, companyId, customFieldValues } = validation.data;
      const userId = req.user!.id;
      const businessId = req.user!.businessId;

      // Validate RUT
      if (!validateRut(studentRut)) {
        return res.status(400).json({ message: "RUT inválido" });
      }

      // Get certificate type and validate it belongs to the user's business
      const certificateType = await storage.getCertificateType(certificateTypeId);
      if (!certificateType) {
        return res.status(404).json({ message: "Tipo de certificado no encontrado" });
      }

      if (!isSuperadmin(req.user!) && certificateType.businessId !== businessId) {
        return res.status(403).json({ message: "No tiene acceso a este tipo de certificado" });
      }

      // Validate company if provided
      if (companyId) {
        const company = await storage.getCompany(companyId);
        if (!company) {
          return res.status(404).json({ message: "Empresa no encontrada" });
        }
        if (!isSuperadmin(req.user!) && company.businessId !== businessId) {
          return res.status(403).json({ message: "No tiene acceso a esta empresa" });
        }
      }

      // Calculate expiry date
      const issueDateObj = parseDateSafe(issueDate);
      const expiryDate = new Date(issueDateObj);
      expiryDate.setMonth(expiryDate.getMonth() + certificateType.validityMonths);
      const expiryDateStr = toDateString(expiryDate);

      // Generate certificate number
      const certificateNumber = generateCertificateNumber();

      // Find or create student automatically
      const formattedRut = formatRut(studentRut);
      let student = await storage.getStudentByRut(formattedRut, certificateType.businessId || undefined);
      let studentId: string | undefined;
      
      if (!student) {
        // Create student automatically with company if provided
        const newStudent = await storage.createStudent({
          name: studentName,
          rut: formattedRut,
          businessId: certificateType.businessId,
          companyId: companyId || null,
        });
        studentId = newStudent.id;
      } else {
        studentId = student.id;
        // Update student's company if provided and student doesn't have one
        if (companyId && !student.companyId) {
          await storage.updateStudent(studentId, { companyId });
        }
      }

      // Create certificate with custom field values and studentId
      const certificate = await storage.createCertificate({
        certificateNumber,
        studentName,
        studentRut: formattedRut,
        certificateTypeId,
        issueDate,
        expiryDate: expiryDateStr,
        businessId: certificateType.businessId,
        createdById: userId,
        isActive: true,
        studentId,
        customFieldValues: customFieldValues && Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined,
      });

      // Generate QR code
      const validationUrl = `${req.protocol}://${req.get('host')}/validate/${certificate.id}`;
      const qrDataUrl = await QRCode.toDataURL(validationUrl, { width: 256, margin: 2 });
      await storage.updateCertificate(certificate.id, { qrCode: qrDataUrl, validationUrl });

      const updatedCertificate = await storage.getCertificate(certificate.id);
      res.status(201).json(updatedCertificate);
    } catch (error) {
      console.error("Error creating certificate:", error);
      res.status(500).json({ message: "Error al crear el certificado" });
    }
  });

  // Helper function to convert hex to RGB
  function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 59, g: 130, b: 246 };
  }

  // Template designs - predefined styles
  const templateDesigns: Record<string, {
    name: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    style: 'modern' | 'classic' | 'minimal' | 'elegant';
  }> = {
    'moderno-azul': {
      name: 'Moderno Azul',
      primaryColor: '#3B82F6',
      secondaryColor: '#1E40AF',
      accentColor: '#93C5FD',
      style: 'modern'
    },
    'clasico-dorado': {
      name: 'Clásico Dorado',
      primaryColor: '#B8860B',
      secondaryColor: '#8B6914',
      accentColor: '#FFD700',
      style: 'classic'
    },
    'elegante-verde': {
      name: 'Elegante Verde',
      primaryColor: '#059669',
      secondaryColor: '#047857',
      accentColor: '#6EE7B7',
      style: 'elegant'
    },
    'minimalista-gris': {
      name: 'Minimalista',
      primaryColor: '#374151',
      secondaryColor: '#1F2937',
      accentColor: '#9CA3AF',
      style: 'minimal'
    },
    'corporativo-rojo': {
      name: 'Corporativo Rojo',
      primaryColor: '#DC2626',
      secondaryColor: '#991B1B',
      accentColor: '#FCA5A5',
      style: 'modern'
    },
    'profesional-morado': {
      name: 'Profesional Morado',
      primaryColor: '#7C3AED',
      secondaryColor: '#5B21B6',
      accentColor: '#C4B5FD',
      style: 'elegant'
    }
  };

  app.get("/api/certificate-templates/presets", isAuthenticated, requireAnyRole, async (_req: Request, res: Response) => {
    try {
      const presets = Object.entries(templateDesigns).map(([key, value]) => ({
        id: key,
        ...value
      }));
      res.json(presets);
    } catch (error) {
      console.error("Error fetching template presets:", error);
      res.status(500).json({ message: "Error al obtener plantillas predefinidas" });
    }
  });

  // Helper: Convert image URL (Supabase or base64 data URL) to base64 data URL for jsPDF
  async function fetchImageAsDataUrl(url: string): Promise<string> {
    // If it's already a base64 data URL, return as-is
    if (url.startsWith("data:")) {
      return url;
    }
    // Fetch remote URL and convert to base64
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get("content-type") || "image/png";
      return `data:${contentType};base64,${buffer.toString("base64")}`;
    } catch (e) {
      console.error("Error fetching image for PDF:", url, e);
      return url; // Return original, jsPDF will handle the error
    }
  }

  app.get("/api/certificates/:id/pdf", isAuthenticated, requireAnyRole, async (req: Request, res: Response) => {
    try {
      console.log("PDF generation started for certificate:", req.params.id);
      const { id } = req.params;
      const { template } = req.query;
      
      const certificate = await storage.getCertificate(id);
      if (!certificate) {
        return res.status(404).json({ message: "Certificate not found" });
      }

      // Verify access unless superadmin
      if (!isSuperadmin(req.user!) && certificate.businessId !== req.user!.businessId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get signers and logos for the certificate type
      const signers = await storage.getSignersByCertificateType(certificate.certificateTypeId);
      const logos = await storage.getLogosByCertificateType(certificate.certificateTypeId);
      
      // Get business for watermark logo and header logo
      let businessLogo: string | null = null;
      let businessData: { logoUrl: string | null } | null = null;
      if (certificate.businessId) {
        const business = await storage.getBusiness(certificate.businessId);
        businessData = business ? { logoUrl: business.logoUrl } : null;
        if (business?.logoUrl) {
          businessLogo = await fetchImageAsDataUrl(business.logoUrl);
          businessData = { logoUrl: businessLogo };
        }
      }
      
      // Pre-fetch all signer signature images for PDF rendering
      for (const signer of signers) {
        if (signer.signatureUrl) {
          (signer as any).signatureUrl = await fetchImageAsDataUrl(signer.signatureUrl);
        }
      }
      
      // Pre-fetch all logo images for PDF rendering
      for (const logo of logos) {
        if (logo.logoUrl) {
          (logo as any).logoUrl = await fetchImageAsDataUrl(logo.logoUrl);
        }
      }
      
      // Get custom fields definition and footer text from certificate type
      const certificateTypeWithDetails = await storage.getCertificateTypeWithDetails(certificate.certificateTypeId);
      const customFieldsDef = certificateTypeWithDetails?.customFields || [];
      const footerText = certificate.certificateType?.footerText || "";

      // Get template configuration
      let templateConfig = templateDesigns['moderno-azul']; // Default
      if (template && typeof template === 'string' && templateDesigns[template]) {
        templateConfig = templateDesigns[template];
      }

      const primaryRgb = hexToRgb(templateConfig.primaryColor);
      const secondaryRgb = hexToRgb(templateConfig.secondaryColor);
      const accentRgb = hexToRgb(templateConfig.accentColor);

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const issueDate = parseDateSafe(certificate.issueDate).toLocaleDateString('es-CL');
      const expiryDate = parseDateSafe(certificate.expiryDate).toLocaleDateString('es-CL');

      // Helper function to add business logo as watermark in the background
      const addWatermark = () => {
        if (!businessLogo) return;
        try {
          // Add logo as full-page centered watermark with low opacity
          const pageWidth = 297;
          const pageHeight = 210;
          
          // Make watermark cover the full page width (centered)
          // Use width-based sizing to ensure it fits within the page
          const watermarkWidth = pageWidth - 40; // Full width minus margins (257mm)
          
          // Center horizontally and vertically
          const x = 20; // Left margin
          const y = 20; // Top margin to center vertically
          
          // Save current state
          doc.saveGraphicsState();
          
          // Set low opacity for watermark effect (0.08 = 8% opacity)
          doc.setGState(doc.GState({ opacity: 0.08 }));
          
          // Add the watermark image with fixed width and 0 height to maintain proportions
          doc.addImage(businessLogo, 'PNG', x, y, watermarkWidth, 0);
          
          // Restore graphics state
          doc.restoreGraphicsState();
        } catch (e) {
          console.error("Error adding watermark:", e);
        }
      };

      // Helper function to add logos at the top maintaining aspect ratio
      const addLogos = (startY: number) => {
        const businessLogoHeight = 28; // Larger height for business logo (protagonist)
        const otherLogoHeight = 20; // Height for other logos
        const spacing = 12;
        
        // Business logo on the right side (larger, more prominent)
        const bizLogoUrl = businessData?.logoUrl || null;
        if (bizLogoUrl) {
          try {
            // Use fixed width approach to ensure logo stays within margins
            // Max width for business logo (keeping 15mm margin from right edge)
            const maxLogoWidth = 55; // Maximum width in mm (increased for more prominence)
            const rightMargin = 15;
            // Position from right edge: page width (297) - margin - width
            const rightX = 297 - rightMargin - maxLogoWidth;
            // Add image with fixed width, height=0 maintains aspect ratio
            doc.addImage(bizLogoUrl, 'PNG', rightX, startY, maxLogoWidth, 0);
          } catch (e) {
            console.error("Error adding business logo:", e);
          }
        }
        
        // Other logos on the left side (without titles)
        const otherLogos = logos.filter(logo => logo.logoUrl);
        if (otherLogos.length > 0) {
          let leftX = 15; // Start from left margin
          const estimatedLogoWidth = otherLogoHeight * 1.5; // Estimate width based on height (aspect ratio ~1.5)
          
          for (const logo of otherLogos) {
            if (logo.logoUrl) {
              try {
                // Add logo image only (no name below)
                doc.addImage(logo.logoUrl, 'PNG', leftX, startY, 0, otherLogoHeight);
                leftX += estimatedLogoWidth + spacing; // Move right for next logo
              } catch (e) {
                console.error("Error adding logo image:", e);
                leftX += 30 + spacing;
              }
            }
          }
        }
      };

      // Helper function to add signers at the bottom (synchronous - images are data URLs)
      const addSigners = (baseY: number) => {
        if (signers.length === 0) return;
        const signerWidth = 60;
        const spacing = 20;
        const totalWidth = signers.length * signerWidth + (signers.length - 1) * spacing;
        let startX = (297 - totalWidth) / 2;
        
        for (const signer of signers) {
          // Add signature image if available
          if (signer.signatureUrl) {
            try {
              doc.addImage(signer.signatureUrl, 'PNG', startX + 10, baseY - 15, 40, 12);
            } catch (e) {
              console.error("Error adding signature image:", e);
            }
          }
          
          // Add signature line
          doc.setDrawColor(100, 100, 100);
          doc.setLineWidth(0.3);
          doc.line(startX, baseY, startX + signerWidth, baseY);
          
          // Add signer name
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(50, 50, 50);
          doc.text(signer.name, startX + signerWidth / 2, baseY + 5, { align: 'center' });
          
          // Add signer position
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 100, 100);
          doc.text(signer.position, startX + signerWidth / 2, baseY + 10, { align: 'center' });
          
          startX += signerWidth + spacing;
        }
      };

      // Helper function to add equipment/nomenclature info
      const addEquipmentInfo = (y: number) => {
        let currentY = y;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        
        if (certificate.equipment) {
          doc.text(`Equipo/Maquinaria: ${certificate.equipment}`, 148.5, currentY, { align: 'center' });
          currentY += 6;
        }
        if (certificate.nomenclature) {
          doc.text(`Nomenclatura: ${certificate.nomenclature}`, 148.5, currentY, { align: 'center' });
          currentY += 6;
        }
        return currentY;
      };

      // Helper function to add custom fields info
      const addCustomFields = (y: number) => {
        let currentY = y;
        
        // Guard against missing custom fields definition
        if (!customFieldsDef || !Array.isArray(customFieldsDef) || customFieldsDef.length === 0) {
          return currentY;
        }
        
        // Parse customFieldValues if it's a JSON string, default to empty object
        let customFieldValues: Record<string, string> = {};
        if (certificate.customFieldValues) {
          if (typeof certificate.customFieldValues === 'string') {
            try {
              const parsed = JSON.parse(certificate.customFieldValues);
              customFieldValues = typeof parsed === 'object' && parsed !== null ? parsed : {};
            } catch (e) {
              console.warn("Error parsing customFieldValues for certificate:", certificate.id, e);
              customFieldValues = {};
            }
          } else if (typeof certificate.customFieldValues === 'object') {
            customFieldValues = certificate.customFieldValues as Record<string, string>;
          }
        }
        
        // Check if there are any values to display
        if (Object.keys(customFieldValues).length === 0) {
          return currentY;
        }
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(50, 50, 50);
        
        for (const field of customFieldsDef) {
          if (!field || !field.fieldName) continue;
          const value = customFieldValues[field.fieldName];
          if (value) {
            const label = field.fieldLabel || field.fieldName;
            // Add "meses" suffix for duration fields
            const labelLower = label.toLowerCase();
            const isDurationField = labelLower.includes('duración') || labelLower.includes('duracion') || 
                                    labelLower.includes('vigencia') || labelLower.includes('validez');
            const displayValue = isDurationField && /^\d+$/.test(value.trim()) ? `${value} meses` : value;
            const displayText = `${label}: ${displayValue}`;
            const truncatedText = displayText.length > 80 ? displayText.substring(0, 77) + '...' : displayText;
            doc.text(truncatedText, 148.5, currentY, { align: 'center' });
            currentY += 7;
          }
        }
        return currentY;
      };

      // Helper function to add footer text at the bottom of the certificate
      const addFooter = () => {
        if (!footerText || footerText.trim() === "") return;
        
        // Footer area - ochre/brown colored bar at the bottom
        const footerY = 195; // Position at bottom
        const footerHeight = 12;
        const footerX = 10;
        const footerWidth = 277;
        
        // Draw footer background (ochre/brown color similar to example)
        doc.setFillColor(210, 160, 80); // Ochre/golden brown
        doc.rect(footerX, footerY, footerWidth, footerHeight, 'F');
        
        // Add footer text - white text on colored background
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        
        // Split text into lines if too long
        const maxWidth = footerWidth - 10;
        const lines = doc.splitTextToSize(footerText, maxWidth);
        const lineHeight = 3.5;
        
        // Center text vertically in footer
        const totalTextHeight = lines.length * lineHeight;
        let textY = footerY + (footerHeight - totalTextHeight) / 2 + 2.5;
        
        for (const line of lines.slice(0, 3)) { // Max 3 lines
          doc.text(line, 148.5, textY, { align: 'center' });
          textY += lineHeight;
        }
      };

      if (templateConfig.style === 'modern') {
        // Modern style - clean layout without borders
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 0, 297, 210, 'F');

        // Add watermark before other elements
        addWatermark();

        // Add logos at top
        addLogos(12);

        doc.setFillColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
        doc.rect(0, 28, 297, 20, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('CERTIFICADO DE CAPACITACIÓN', 148.5, 41, { align: 'center' });

        doc.setTextColor(secondaryRgb.r, secondaryRgb.g, secondaryRgb.b);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(certificate.certificateType.name.toUpperCase(), 148.5, 58, { align: 'center' });

        doc.setTextColor(71, 85, 105);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Se certifica que:', 148.5, 70, { align: 'center' });

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text(certificate.studentName.toUpperCase(), 148.5, 82, { align: 'center' });

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(50, 60, 70);
        doc.text(`RUT: ${formatRut(certificate.studentRut)}`, 148.5, 93, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text('Ha completado satisfactoriamente el programa de capacitación', 148.5, 104, { align: 'center' });

        // Add equipment/nomenclature and custom fields
        let infoY = addEquipmentInfo(114);
        infoY = addCustomFields(infoY);

        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(`Fecha de Emisión: ${issueDate}`, 20, 150);
        doc.text(`Válido Hasta: ${expiryDate}`, 20, 157);
        doc.text(`N° Certificado: ${certificate.certificateNumber}`, 20, 164);

        // Add signers
        addSigners(168);
        addFooter();

      } else if (templateConfig.style === 'classic') {
        // Classic style - elegant without borders
        doc.setFillColor(255, 253, 245);
        doc.rect(0, 0, 297, 210, 'F');

        // Add watermark before other elements
        addWatermark();

        // Add logos at top
        addLogos(10);

        doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
        doc.setFontSize(36);
        doc.setFont('helvetica', 'bold');
        doc.text('CERTIFICADO', 148.5, 38, { align: 'center' });
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text('de Capacitación Profesional', 148.5, 45, { align: 'center' });

        doc.setTextColor(secondaryRgb.r, secondaryRgb.g, secondaryRgb.b);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(certificate.certificateType.name.toUpperCase(), 148.5, 58, { align: 'center' });

        doc.setTextColor(60, 60, 60);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Por medio de la presente se certifica que:', 148.5, 68, { align: 'center' });

        doc.setTextColor(30, 30, 30);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text(certificate.studentName.toUpperCase(), 148.5, 80, { align: 'center' });

        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(50, 50, 50);
        doc.text(`RUT: ${formatRut(certificate.studentRut)}`, 148.5, 91, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        doc.text('Ha completado satisfactoriamente el programa de capacitación', 148.5, 102, { align: 'center' });

        // Add equipment/nomenclature and custom fields
        let classicInfoY = addEquipmentInfo(112);
        classicInfoY = addCustomFields(classicInfoY);

        doc.setFontSize(9);
        doc.text(`Fecha de Emisión: ${issueDate}`, 20, 150);
        doc.text(`Válido Hasta: ${expiryDate}`, 20, 157);
        doc.text(`N° Certificado: ${certificate.certificateNumber}`, 20, 164);

        // Add signers
        addSigners(168);
        addFooter();

      } else if (templateConfig.style === 'minimal') {
        // Minimal style - clean and simple without borders
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, 297, 210, 'F');

        // Add watermark before other elements
        addWatermark();

        // Add logos at top
        addLogos(10);

        doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
        doc.setFontSize(36);
        doc.setFont('helvetica', 'bold');
        doc.text('CERTIFICADO', 148.5, 38, { align: 'center' });

        doc.setTextColor(100, 100, 100);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.text(certificate.certificateType.name, 148.5, 48, { align: 'center' });

        doc.setTextColor(60, 60, 60);
        doc.setFontSize(10);
        doc.text('Se certifica que', 148.5, 58, { align: 'center' });

        doc.setTextColor(30, 30, 30);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text(certificate.studentName, 148.5, 72, { align: 'center' });

        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(60, 60, 60);
        doc.text(`RUT: ${formatRut(certificate.studentRut)}`, 148.5, 83, { align: 'center' });

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text('ha completado satisfactoriamente el programa de capacitación', 148.5, 94, { align: 'center' });

        // Add equipment/nomenclature and custom fields
        let minimalInfoY = addEquipmentInfo(104);
        minimalInfoY = addCustomFields(minimalInfoY);

        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(`Emisión: ${issueDate}  |  Vencimiento: ${expiryDate}  |  N°: ${certificate.certificateNumber}`, 148.5, 135, { align: 'center' });

        // Add signers
        addSigners(155);
        addFooter();

      } else if (templateConfig.style === 'elegant') {
        // Elegant style - refined without borders
        doc.setFillColor(250, 250, 255);
        doc.rect(0, 0, 297, 210, 'F');

        // Add watermark before other elements
        addWatermark();

        // Add logos at top
        addLogos(10);

        doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
        doc.setFontSize(36);
        doc.setFont('helvetica', 'bold');
        doc.text('CERTIFICADO', 148.5, 38, { align: 'center' });

        doc.setTextColor(secondaryRgb.r, secondaryRgb.g, secondaryRgb.b);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(certificate.certificateType.name.toUpperCase(), 148.5, 50, { align: 'center' });

        doc.setTextColor(80, 80, 80);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Se certifica que:', 148.5, 62, { align: 'center' });

        doc.setTextColor(30, 30, 30);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text(certificate.studentName.toUpperCase(), 148.5, 74, { align: 'center' });

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(50, 60, 70);
        doc.text(`RUT: ${formatRut(certificate.studentRut)}`, 148.5, 85, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text('Ha completado satisfactoriamente el programa de capacitación', 148.5, 96, { align: 'center' });

        // Add equipment/nomenclature and custom fields
        let elegantInfoY = addEquipmentInfo(106);
        elegantInfoY = addCustomFields(elegantInfoY);

        doc.setFontSize(9);
        doc.text(`Fecha de Emisión: ${issueDate}`, 20, 150);
        doc.text(`Válido Hasta: ${expiryDate}`, 20, 157);
        doc.text(`N° Certificado: ${certificate.certificateNumber}`, 20, 164);

        // Add signers
        addSigners(168);
        addFooter();
      }

      // QR Code (common to all styles) - positioned more to the right and lower
      const validationUrl = `${req.protocol}://${req.get('host')}/validate/${id}`;
      const qrDataUrl = await QRCode.toDataURL(validationUrl, { width: 200, margin: 1 });
      doc.addImage(qrDataUrl, 'PNG', 250, 150, 35, 35);

      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.text('Escanee para validar', 267.5, 188, { align: 'center' });

      const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
      
      // Format filename: RUT-Nombre-Curso.pdf
      const sanitizedRut = certificate.studentRut.replace(/\./g, '').replace(/-/g, '');
      const sanitizedName = certificate.studentName.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').replace(/\s+/g, '_');
      const sanitizedCourse = (certificate.certificateType?.name || 'Certificado').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').replace(/\s+/g, '_');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${sanitizedRut}-${sanitizedName}-${sanitizedCourse}.pdf"`);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      console.error("Error stack:", error?.stack);
      res.status(500).json({ 
        message: "Failed to generate PDF", 
        error: process.env.NODE_ENV === 'development' ? error?.message : undefined 
      });
    }
  });

  // ============= IMPORT =============
  app.post("/api/import", isAuthenticated, requireAdminOrOperator, upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { certificateTypeId } = req.body;
      if (!certificateTypeId) {
        return res.status(400).json({ message: "Certificate type is required" });
      }

      const certificateTypeWithDetails = await storage.getCertificateTypeWithDetails(certificateTypeId);
      if (!certificateTypeWithDetails) {
        return res.status(400).json({ message: "Certificate type not found" });
      }
      const certificateType = certificateTypeWithDetails;
      const customFieldsDef = certificateTypeWithDetails.customFields || [];

      // Verify certificate type belongs to user's business (unless superadmin)
      if (!isSuperadmin(req.user!) && certificateType.businessId !== req.user!.businessId) {
        return res.status(403).json({ message: "Cannot import to certificate type from another business" });
      }

      const userId = req.user!.id;
      const businessId = certificateType.businessId; // Use the certificate type's business
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });

      // Helper to get raw cell text value from the sheet (avoids Excel number interpretation)
      const getCellText = (row: number, col: number): string => {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = sheet[cellRef];
        if (!cell) return '';
        // If the cell has a 'w' (formatted text) value, use it; otherwise use 'v' (raw value)
        if (cell.w !== undefined) return String(cell.w).trim();
        if (cell.v !== undefined) return String(cell.v).trim();
        return '';
      };

      const headers = jsonData[0] as string[];
      const dataRows = jsonData.slice(1).filter((row) => (row as unknown[]).some(cell => cell !== undefined && cell !== ""));

      console.log("[IMPORT DEBUG] Headers:", headers);
      console.log("[IMPORT DEBUG] Data rows count:", dataRows.length);
      console.log("[IMPORT DEBUG] First data row:", dataRows[0]);
      console.log("[IMPORT DEBUG] businessId:", businessId);

      // Create import batch
      const batch = await storage.createImportBatch({
        fileName: req.file.originalname,
        totalRecords: dataRows.length,
        importedById: userId,
        businessId: businessId || undefined,
      });

      // Find column indices - use exact header matching to avoid false positives
      const normalizeHeader = (h: any) => String(h).toLowerCase().trim();
      const nameIdx = headers.findIndex(h => {
        const n = normalizeHeader(h);
        return n === "nombre" || n === "name" || n === "nombre alumno" || n === "nombre completo";
      });
      const rutIdx = headers.findIndex(h => {
        const n = normalizeHeader(h);
        return n === "rut" || n === "dni" || n === "rut alumno";
      });
      const dateIdx = headers.findIndex(h => {
        const n = normalizeHeader(h);
        return n === "fecha" || n === "date" || n === "fecha emisión" || n === "fecha emision";
      });
      const equipmentIdx = headers.findIndex(h => /^(equipo|maquinaria|equipment)$/i.test(String(h).trim()));
      const nomenclatureIdx = headers.findIndex(h => /^(nomenclatura|nomenclature|modelo|model)$/i.test(String(h).trim()));
      const emailIdx = headers.findIndex(h => {
        const n = normalizeHeader(h);
        return n === "email" || n === "correo" || n === "e-mail";
      });
      const phoneIdx = headers.findIndex(h => {
        const n = normalizeHeader(h);
        return n === "telefono" || n === "teléfono" || n === "phone" || n === "celular";
      });
      const companyNameIdx = headers.findIndex(h => {
        const n = normalizeHeader(h);
        return n === "empresa" || n === "company" || n === "compañía" || n === "compania";
      });

      // Build custom field column indices
      const customFieldIndices: Array<{ fieldName: string; fieldLabel: string; isRequired: boolean; idx: number }> = [];
      for (const field of customFieldsDef) {
        const idx = headers.findIndex(h => 
          String(h).toLowerCase().trim() === field.fieldLabel.toLowerCase().trim() ||
          String(h).toLowerCase().trim() === field.fieldName.toLowerCase().trim()
        );
        customFieldIndices.push({ 
          fieldName: field.fieldName, 
          fieldLabel: field.fieldLabel, 
          isRequired: field.isRequired, 
          idx 
        });
      }

      console.log("[IMPORT DEBUG] Column indices:", { nameIdx, rutIdx, dateIdx, emailIdx, phoneIdx, companyNameIdx, equipmentIdx, nomenclatureIdx });
      console.log("[IMPORT DEBUG] Custom field indices:", customFieldIndices);

      const certificatesToCreate: Array<{
        certificateNumber: string;
        studentName: string;
        studentRut: string;
        studentId?: string;
        certificateTypeId: string;
        issueDate: string;
        expiryDate: string;
        businessId: string | null;
        createdById: string;
        isActive: boolean;
        equipment?: string;
        nomenclature?: string;
        customFieldValues?: Record<string, string>;
      }> = [];
      const errors: Array<{ row: number; errors: string[] }> = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i] as unknown[];
        const rowErrors: string[] = [];

        const studentName = String(row[nameIdx >= 0 ? nameIdx : 0] || "").trim();
        // Read RUT directly from the sheet cell to avoid Excel number interpretation
        const rawRut = rutIdx >= 0 ? getCellText(i + 1, rutIdx) : String(row[1] || "").trim();
        const studentRut = rawRut.replace(/[^0-9kK]/g, '');
        if (i === 0) {
          console.log("[IMPORT DEBUG] First row RUT - raw:", rawRut, "clean:", studentRut, "from array:", row[rutIdx >= 0 ? rutIdx : 1]);
        }
        let issueDate = "";
        const equipment = equipmentIdx >= 0 ? String(row[equipmentIdx] || "").trim() : undefined;
        const nomenclature = nomenclatureIdx >= 0 ? String(row[nomenclatureIdx] || "").trim() : undefined;
        const studentEmail = emailIdx >= 0 ? String(row[emailIdx] || "").trim() : undefined;
        const studentPhone = phoneIdx >= 0 ? String(row[phoneIdx] || "").trim() : undefined;
        const companyName = companyNameIdx >= 0 ? String(row[companyNameIdx] || "").trim() : undefined;

        if (dateIdx >= 0 && row[dateIdx]) {
          const rawDate = row[dateIdx];
          if (typeof rawDate === "number") {
            const date = XLSX.SSF.parse_date_code(rawDate);
            issueDate = `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
          } else {
            const parsed = parseDateSafe(rawDate as string);
            if (!isNaN(parsed.getTime())) {
              issueDate = toDateString(parsed);
            }
          }
        }

        if (!studentName) rowErrors.push("Nombre requerido");
        if (!studentRut) rowErrors.push("RUT requerido");
        else if (!validateRut(studentRut)) rowErrors.push("RUT inválido");
        if (!issueDate) {
          issueDate = toDateString(new Date());
        }

        // Extract custom field values
        const customFieldValues: Record<string, string> = {};
        for (const cf of customFieldIndices) {
          const value = cf.idx >= 0 ? String(row[cf.idx] || "").trim() : "";
          if (cf.isRequired && !value) {
            rowErrors.push(`${cf.fieldLabel} requerido`);
          }
          if (value) {
            customFieldValues[cf.fieldName] = value;
          }
        }

        if (rowErrors.length > 0) {
          errors.push({ row: i + 2, errors: rowErrors });
          continue;
        }

        // Find or create company if company name is provided (with normalization)
        let companyId: string | undefined = undefined;
        if (companyName && companyName.length >= 2 && businessId) {
          const normalizedCompanyName = companyName.trim();
          let company = await storage.getCompanyByName(normalizedCompanyName, businessId);
          if (!company) {
            company = await storage.createCompany({
              name: normalizedCompanyName,
              businessId,
            });
          }
          companyId = company.id;
        }

        // Find or create student (respecting existing associations)
        let studentId: string | undefined = undefined;
        if (businessId) {
          let student = await storage.getStudentByRut(studentRut, businessId);
          if (!student) {
            student = await storage.createStudent({
              name: studentName,
              rut: studentRut,
              email: studentEmail || undefined,
              phone: studentPhone || undefined,
              companyId: companyId || undefined,
              businessId,
            });
          }
          // Note: We don't update existing student's company to preserve data integrity
          studentId = student.id;
        }

        // Calculate expiry date
        const issueDateObj = parseDateSafe(issueDate);
        const expiryDate = new Date(issueDateObj);
        expiryDate.setMonth(expiryDate.getMonth() + certificateType.validityMonths);
        const expiryDateStr = toDateString(expiryDate);

        const certificateNumber = generateCertificateNumber();

        certificatesToCreate.push({
          certificateNumber,
          studentName,
          studentRut,
          studentId: studentId || undefined,
          certificateTypeId,
          issueDate,
          expiryDate: expiryDateStr,
          businessId,
          createdById: userId,
          isActive: true,
          equipment: equipment || undefined,
          nomenclature: nomenclature || undefined,
          customFieldValues: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined,
        });
      }

      // Create certificates and generate QR codes
      const createdCerts = await storage.createCertificates(certificatesToCreate);

      // Update QR codes for all certificates
      for (const cert of createdCerts) {
        const validationUrl = `${req.protocol}://${req.get('host')}/validate/${cert.id}`;
        const qrDataUrl = await QRCode.toDataURL(validationUrl, { width: 256, margin: 2 });
        await storage.updateCertificate(cert.id, { qrCode: qrDataUrl, validationUrl });
      }

      // Update batch
      await storage.updateImportBatch(batch.id, {
        successfulRecords: createdCerts.length,
        failedRecords: errors.length,
        status: "completed",
        errors: errors.length > 0 ? errors : null,
      });

      res.json({
        message: "Import completed",
        created: createdCerts.length,
        totalRecords: certificatesToCreate.length + errors.length,
        successfulRecords: createdCerts.length,
        failed: errors.length,
        errors: errors.slice(0, 10),
      });
    } catch (error: any) {
      console.error("Error importing:", error?.message || error);
      console.error("Stack:", error?.stack);
      res.status(500).json({ message: error?.message || "Failed to import data" });
    }
  });

  // Import students bulk
  app.post("/api/import/students", isAuthenticated, requireAdminOrOperator, upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const userId = req.user!.id;
      const businessId = isSuperadmin(req.user!) 
        ? (req.body.businessId || req.user!.businessId)
        : req.user!.businessId;

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });

      // Helper to get raw cell text value from the sheet
      const getCellText = (row: number, col: number): string => {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = sheet[cellRef];
        if (!cell) return '';
        if (cell.w !== undefined) return String(cell.w).trim();
        if (cell.v !== undefined) return String(cell.v).trim();
        return '';
      };

      const headers = jsonData[0] as string[];
      const dataRows = jsonData.slice(1).filter((row) => (row as unknown[]).some(cell => cell !== undefined && cell !== ""));

      // Find column indices - use exact matching for RUT to avoid false positives
      const nameIdx = headers.findIndex(h => /nombre/i.test(String(h)) || /name/i.test(String(h)));
      const rutIdx = headers.findIndex(h => {
        const n = String(h).toLowerCase().trim();
        return n === 'rut' || n === 'dni' || n === 'rut alumno';
      });
      const emailIdx = headers.findIndex(h => /email/i.test(String(h)) || /correo/i.test(String(h)));
      const phoneIdx = headers.findIndex(h => /telefono|teléfono|phone/i.test(String(h)));

      const studentsToCreate: Array<{
        name: string;
        rut: string;
        email?: string;
        phone?: string;
        businessId: string | null;
      }> = [];
      const errors: Array<{ row: number; errors: string[] }> = [];
      const existingRuts = new Set<string>();

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i] as unknown[];
        const rowErrors: string[] = [];

        const name = String(row[nameIdx >= 0 ? nameIdx : 0] || "").trim();
        // Read RUT directly from the sheet cell to avoid Excel number interpretation
        const rawRut = rutIdx >= 0 ? getCellText(i + 1, rutIdx) : String(row[1] || "").trim();
        const rut = rawRut.replace(/[^0-9kK]/g, '');
        const email = emailIdx >= 0 ? String(row[emailIdx] || "").trim() : undefined;
        const phone = phoneIdx >= 0 ? String(row[phoneIdx] || "").trim() : undefined;

        if (!name) rowErrors.push("Nombre requerido");
        if (!rut) rowErrors.push("RUT requerido");
        else if (!validateRut(rut)) rowErrors.push("RUT inválido");
        else {
          // Check for duplicate in file
          if (existingRuts.has(rut)) {
            rowErrors.push("RUT duplicado en el archivo");
          } else {
            // Check for existing student in database
            const existingStudent = await storage.getStudentByRut(rut, businessId);
            if (existingStudent) {
              rowErrors.push("Alumno ya existe");
            }
            existingRuts.add(rut);
          }
        }

        if (rowErrors.length > 0) {
          errors.push({ row: i + 2, errors: rowErrors });
          continue;
        }

        studentsToCreate.push({
          name,
          rut,
          email: email || undefined,
          phone: phone || undefined,
          businessId,
        });
      }

      const createdStudents = await storage.createStudents(studentsToCreate);

      res.json({
        message: "Import completed",
        created: createdStudents.length,
        failed: errors.length,
        errors: errors.slice(0, 10),
      });
    } catch (error) {
      console.error("Error importing students:", error);
      res.status(500).json({ message: "Failed to import students" });
    }
  });

  // Import companies bulk
  app.post("/api/import/companies", isAuthenticated, requireAdminOrOperator, upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const userId = req.user!.id;
      const businessId = isSuperadmin(req.user!) 
        ? (req.body.businessId || req.user!.businessId)
        : req.user!.businessId;

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });

      // Helper to get raw cell text value from the sheet
      const getCellText = (row: number, col: number): string => {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = sheet[cellRef];
        if (!cell) return '';
        if (cell.w !== undefined) return String(cell.w).trim();
        if (cell.v !== undefined) return String(cell.v).trim();
        return '';
      };

      const headers = jsonData[0] as string[];
      const dataRows = jsonData.slice(1).filter((row) => (row as unknown[]).some(cell => cell !== undefined && cell !== ""));

      // Find column indices
      const nameIdx = headers.findIndex(h => /nombre|name|empresa|company/i.test(String(h)));
      const rutIdx = headers.findIndex(h => /rut/i.test(String(h)) || /dni/i.test(String(h)));
      const addressIdx = headers.findIndex(h => /direccion|dirección|address/i.test(String(h)));
      const contactNameIdx = headers.findIndex(h => /contacto|contact/i.test(String(h)));
      const contactEmailIdx = headers.findIndex(h => /email.*contacto|contact.*email|correo/i.test(String(h)));
      const contactPhoneIdx = headers.findIndex(h => /telefono.*contacto|contact.*phone|teléfono/i.test(String(h)));

      const companiesToCreate: Array<{
        name: string;
        rut?: string;
        address?: string;
        contactName?: string;
        contactEmail?: string;
        contactPhone?: string;
        businessId: string | null;
      }> = [];
      const errors: Array<{ row: number; errors: string[] }> = [];
      const existingRuts = new Set<string>();

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i] as unknown[];
        const rowErrors: string[] = [];

        const name = String(row[nameIdx >= 0 ? nameIdx : 0] || "").trim();
        // Read RUT directly from the sheet cell to avoid Excel number interpretation
        const rawRut = rutIdx >= 0 ? getCellText(i + 1, rutIdx) : '';
        const rut = rawRut ? rawRut.replace(/[^0-9kK]/g, '') : undefined;
        const address = addressIdx >= 0 ? String(row[addressIdx] || "").trim() : undefined;
        const contactName = contactNameIdx >= 0 ? String(row[contactNameIdx] || "").trim() : undefined;
        const contactEmail = contactEmailIdx >= 0 ? String(row[contactEmailIdx] || "").trim() : undefined;
        const contactPhone = contactPhoneIdx >= 0 ? String(row[contactPhoneIdx] || "").trim() : undefined;

        if (!name) rowErrors.push("Nombre requerido");
        
        if (rut) {
          // Check for duplicate in file
          if (existingRuts.has(rut)) {
            rowErrors.push("RUT duplicado en el archivo");
          } else {
            // Check for existing company in database
            const existingCompany = await storage.getCompanyByRut(rut, businessId);
            if (existingCompany) {
              rowErrors.push("Empresa ya existe");
            }
            existingRuts.add(rut);
          }
        }

        if (rowErrors.length > 0) {
          errors.push({ row: i + 2, errors: rowErrors });
          continue;
        }

        companiesToCreate.push({
          name,
          rut: rut || undefined,
          address: address || undefined,
          contactName: contactName || undefined,
          contactEmail: contactEmail || undefined,
          contactPhone: contactPhone || undefined,
          businessId,
        });
      }

      const createdCompanies = await storage.createCompanies(companiesToCreate);

      res.json({
        message: "Import completed",
        created: createdCompanies.length,
        failed: errors.length,
        errors: errors.slice(0, 10),
      });
    } catch (error) {
      console.error("Error importing companies:", error);
      res.status(500).json({ message: "Failed to import companies" });
    }
  });

  app.get("/api/import/history", isAuthenticated, requireAnyRole, async (req: Request, res: Response) => {
    try {
      const businessId = getBusinessScope(req.user!);
      const history = await storage.getImportHistory(businessId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching import history:", error);
      res.status(500).json({ message: "Failed to fetch import history" });
    }
  });

  // ============= CERTIFICATE TEMPLATES =============
  const insertTemplateSchema = z.object({
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    description: z.string().optional(),
    templateKey: z.string().min(1, "La clave de plantilla es requerida"),
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    accentColor: z.string().optional(),
    isDefault: z.boolean().optional(),
  });

  app.get("/api/certificate-templates", isAuthenticated, requireAnyRole, async (req: Request, res: Response) => {
    try {
      const businessId = getBusinessScope(req.user!);
      const templates = await storage.getCertificateTemplates(businessId);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching certificate templates:", error);
      res.status(500).json({ message: "Error al obtener plantillas de certificado" });
    }
  });

  app.get("/api/certificate-templates/:id", isAuthenticated, requireAnyRole, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const template = await storage.getCertificateTemplate(id);
      if (!template) {
        return res.status(404).json({ message: "Plantilla no encontrada" });
      }
      // Verify access unless superadmin
      if (!isSuperadmin(req.user!) && template.businessId !== req.user!.businessId) {
        return res.status(403).json({ message: "Acceso denegado" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error fetching certificate template:", error);
      res.status(500).json({ message: "Error al obtener plantilla de certificado" });
    }
  });

  app.post("/api/certificate-templates", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const result = insertTemplateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: result.error.errors[0].message });
      }

      const businessId = req.user!.businessId;
      if (!businessId && !isSuperadmin(req.user!)) {
        return res.status(403).json({ message: "Usuario no asociado a una empresa" });
      }

      const template = await storage.createCertificateTemplate({
        ...result.data,
        businessId: businessId || undefined,
      });
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating certificate template:", error);
      res.status(500).json({ message: "Error al crear plantilla de certificado" });
    }
  });

  app.patch("/api/certificate-templates/:id", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const template = await storage.getCertificateTemplate(id);
      if (!template) {
        return res.status(404).json({ message: "Plantilla no encontrada" });
      }

      // Verify access unless superadmin
      if (!isSuperadmin(req.user!) && template.businessId !== req.user!.businessId) {
        return res.status(403).json({ message: "Acceso denegado" });
      }

      const updatedTemplate = await storage.updateCertificateTemplate(id, req.body);
      res.json(updatedTemplate);
    } catch (error) {
      console.error("Error updating certificate template:", error);
      res.status(500).json({ message: "Error al actualizar plantilla de certificado" });
    }
  });

  app.delete("/api/certificate-templates/:id", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const template = await storage.getCertificateTemplate(id);
      if (!template) {
        return res.status(404).json({ message: "Plantilla no encontrada" });
      }

      // Verify access unless superadmin
      if (!isSuperadmin(req.user!) && template.businessId !== req.user!.businessId) {
        return res.status(403).json({ message: "Acceso denegado" });
      }

      await storage.deleteCertificateTemplate(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting certificate template:", error);
      res.status(500).json({ message: "Error al eliminar plantilla de certificado" });
    }
  });

  app.post("/api/certificate-templates/:id/set-default", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const template = await storage.getCertificateTemplate(id);
      if (!template) {
        return res.status(404).json({ message: "Plantilla no encontrada" });
      }

      // Verify access unless superadmin
      if (!isSuperadmin(req.user!) && template.businessId !== req.user!.businessId) {
        return res.status(403).json({ message: "Acceso denegado" });
      }

      const businessId = template.businessId || req.user!.businessId;
      if (!businessId) {
        return res.status(400).json({ message: "No se puede establecer plantilla por defecto sin empresa" });
      }

      await storage.setDefaultCertificateTemplate(id, businessId);
      res.json({ message: "Plantilla establecida como predeterminada" });
    } catch (error) {
      console.error("Error setting default template:", error);
      res.status(500).json({ message: "Error al establecer plantilla predeterminada" });
    }
  });

  // ============= REPORTS =============
  app.get("/api/reports/export", isAuthenticated, requireAnyRole, async (req: Request, res: Response) => {
    try {
      const { status, type, dateFrom, dateTo } = req.query;
      const businessId = getBusinessScope(req.user!);
      
      const certificates = await storage.getCertificatesForExport({
        status: status as string,
        type: type as string,
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
        businessId,
      });

      // Format date helper
      const formatDate = (dateStr: string) => {
        const date = parseDateSafe(dateStr);
        return date.toLocaleDateString('es-CL');
      };

      // Get certificate status
      const getCertStatus = (expiryDate: string) => {
        const now = new Date();
        const expiry = parseDateSafe(expiryDate);
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        
        if (expiry < now) return 'Vencido';
        if (expiry <= thirtyDaysFromNow) return 'Por Vencer';
        return 'Vigente';
      };

      // Create worksheet data
      const wsData = [
        ['N° Certificado', 'Nombre Alumno', 'RUT', 'Tipo de Curso', 'Fecha Emisión', 'Fecha Vencimiento', 'Estado'],
        ...certificates.map(cert => [
          cert.certificateNumber,
          cert.studentName,
          formatRut(cert.studentRut),
          cert.certificateType?.name || 'N/A',
          formatDate(cert.issueDate),
          formatDate(cert.expiryDate),
          getCertStatus(cert.expiryDate),
        ])
      ];

      // Create workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Set column widths
      ws['!cols'] = [
        { wch: 18 },
        { wch: 35 },
        { wch: 14 },
        { wch: 30 },
        { wch: 14 },
        { wch: 14 },
        { wch: 12 },
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Certificados');

      // Generate buffer
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      // Generate filename with date
      const today = new Date().toISOString().split('T')[0];
      const filename = `Reporte_Certificados_${today}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error) {
      console.error("Error exporting report:", error);
      res.status(500).json({ message: "Failed to export report" });
    }
  });

  // ============= PUBLIC VALIDATION =============
  app.get("/api/validate/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const certificate = await storage.getCertificate(id);
      if (!certificate) {
        return res.status(404).json({ message: "Certificate not found" });
      }
      res.json(certificate);
    } catch (error) {
      console.error("Error validating certificate:", error);
      res.status(500).json({ message: "Failed to validate certificate" });
    }
  });

  // ============= COMPANIES (CLIENT COMPANIES) =============
  const insertCompanySchema = z.object({
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    rut: z.string().optional(),
    address: z.string().optional(),
    contactName: z.string().optional(),
    contactEmail: z.string().email("Email inválido").optional().or(z.literal("")),
    contactPhone: z.string().optional(),
  });

  app.get("/api/companies", isAuthenticated, requireAnyRole, async (req: Request, res: Response) => {
    try {
      const businessId = getBusinessScope(req.user!);
      const companies = await storage.getCompanies(businessId);
      res.json(companies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  app.get("/api/companies/:id", isAuthenticated, requireAnyRole, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const company = await storage.getCompany(id);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      // Verify access unless superadmin
      if (!isSuperadmin(req.user!) && company.businessId !== req.user!.businessId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(company);
    } catch (error) {
      console.error("Error fetching company:", error);
      res.status(500).json({ message: "Failed to fetch company" });
    }
  });

  app.post("/api/companies", isAuthenticated, requireAdminOrOperator, async (req: Request, res: Response) => {
    try {
      const validation = insertCompanySchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Datos inválidos", 
          errors: validation.error.flatten().fieldErrors 
        });
      }

      const businessId = req.user!.businessId;
      if (!businessId && !isSuperadmin(req.user!)) {
        return res.status(400).json({ message: "No business associated with user" });
      }

      // Validate RUT if provided
      if (validation.data.rut && validation.data.rut.trim() !== "") {
        if (!validateRut(validation.data.rut)) {
          return res.status(400).json({ message: "RUT inválido" });
        }
        validation.data.rut = formatRut(validation.data.rut);
      }

      const company = await storage.createCompany({
        ...validation.data,
        businessId,
      });

      res.status(201).json(company);
    } catch (error) {
      console.error("Error creating company:", error);
      res.status(500).json({ message: "Failed to create company" });
    }
  });

  app.patch("/api/companies/:id", isAuthenticated, requireAdminOrOperator, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const existingCompany = await storage.getCompany(id);
      if (!existingCompany) {
        return res.status(404).json({ message: "Company not found" });
      }

      // Verify access unless superadmin
      if (!isSuperadmin(req.user!) && existingCompany.businessId !== req.user!.businessId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validation = insertCompanySchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Datos inválidos", 
          errors: validation.error.flatten().fieldErrors 
        });
      }

      // Validate RUT if provided
      if (validation.data.rut && validation.data.rut.trim() !== "") {
        if (!validateRut(validation.data.rut)) {
          return res.status(400).json({ message: "RUT inválido" });
        }
        validation.data.rut = formatRut(validation.data.rut);
      }

      const company = await storage.updateCompany(id, validation.data);
      res.json(company);
    } catch (error) {
      console.error("Error updating company:", error);
      res.status(500).json({ message: "Failed to update company" });
    }
  });

  app.delete("/api/companies/:id", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const existingCompany = await storage.getCompany(id);
      if (!existingCompany) {
        return res.status(404).json({ message: "Company not found" });
      }

      // Verify access unless superadmin
      if (!isSuperadmin(req.user!) && existingCompany.businessId !== req.user!.businessId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const deleted = await storage.deleteCompany(id);
      if (!deleted) {
        return res.status(400).json({ message: "No se puede eliminar. La empresa tiene alumnos asociados." });
      }

      res.json({ message: "Company deleted" });
    } catch (error) {
      console.error("Error deleting company:", error);
      res.status(500).json({ message: "Failed to delete company" });
    }
  });

  // ============= STUDENTS =============
  const insertStudentSchema = z.object({
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    rut: z.string().min(1, "RUT requerido"),
    email: z.string().email("Email inválido").optional().or(z.literal("")),
    phone: z.string().optional(),
    companyId: z.string().optional().nullable(),
  });

  app.get("/api/students", isAuthenticated, requireAnyRole, async (req: Request, res: Response) => {
    try {
      const { companyId, search } = req.query;
      const businessId = getBusinessScope(req.user!);
      
      const students = await storage.getStudents({
        businessId,
        companyId: companyId as string,
        search: search as string,
      });
      
      res.json(students);
    } catch (error) {
      console.error("Error fetching students:", error);
      res.status(500).json({ message: "Failed to fetch students" });
    }
  });

  app.get("/api/students/:id", isAuthenticated, requireAnyRole, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const student = await storage.getStudent(id);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      // Verify access unless superadmin
      if (!isSuperadmin(req.user!) && student.businessId !== req.user!.businessId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(student);
    } catch (error) {
      console.error("Error fetching student:", error);
      res.status(500).json({ message: "Failed to fetch student" });
    }
  });

  app.post("/api/students", isAuthenticated, requireAdminOrOperator, async (req: Request, res: Response) => {
    try {
      const validation = insertStudentSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Datos inválidos", 
          errors: validation.error.flatten().fieldErrors 
        });
      }

      const businessId = req.user!.businessId;
      if (!businessId && !isSuperadmin(req.user!)) {
        return res.status(400).json({ message: "No business associated with user" });
      }

      // Validate RUT
      if (!validateRut(validation.data.rut)) {
        return res.status(400).json({ message: "RUT inválido" });
      }

      // Check if student with same RUT already exists in this business
      const existingStudent = await storage.getStudentByRut(validation.data.rut, businessId || undefined);
      if (existingStudent) {
        return res.status(409).json({ message: "Ya existe un alumno con este RUT" });
      }

      // Validate companyId if provided
      if (validation.data.companyId) {
        const company = await storage.getCompany(validation.data.companyId);
        if (!company) {
          return res.status(404).json({ message: "Empresa no encontrada" });
        }
        if (!isSuperadmin(req.user!) && company.businessId !== businessId) {
          return res.status(403).json({ message: "No tiene acceso a esta empresa" });
        }
      }

      const student = await storage.createStudent({
        ...validation.data,
        rut: formatRut(validation.data.rut),
        companyId: validation.data.companyId || null,
        businessId,
      });

      res.status(201).json(student);
    } catch (error) {
      console.error("Error creating student:", error);
      res.status(500).json({ message: "Failed to create student" });
    }
  });

  app.patch("/api/students/:id", isAuthenticated, requireAdminOrOperator, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const existingStudent = await storage.getStudent(id);
      if (!existingStudent) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Verify access unless superadmin
      if (!isSuperadmin(req.user!) && existingStudent.businessId !== req.user!.businessId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validation = insertStudentSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Datos inválidos", 
          errors: validation.error.flatten().fieldErrors 
        });
      }

      // Validate RUT if provided
      if (validation.data.rut) {
        if (!validateRut(validation.data.rut)) {
          return res.status(400).json({ message: "RUT inválido" });
        }
        validation.data.rut = formatRut(validation.data.rut);
      }

      // Validate companyId if provided
      if (validation.data.companyId) {
        const company = await storage.getCompany(validation.data.companyId);
        if (!company) {
          return res.status(404).json({ message: "Empresa no encontrada" });
        }
      }

      const student = await storage.updateStudent(id, validation.data);
      res.json(student);
    } catch (error) {
      console.error("Error updating student:", error);
      res.status(500).json({ message: "Failed to update student" });
    }
  });

  app.delete("/api/students/:id", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const existingStudent = await storage.getStudent(id);
      if (!existingStudent) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Verify access unless superadmin
      if (!isSuperadmin(req.user!) && existingStudent.businessId !== req.user!.businessId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const deleted = await storage.deleteStudent(id);
      if (!deleted) {
        return res.status(400).json({ message: "No se puede eliminar. El alumno tiene certificados asociados." });
      }

      res.json({ message: "Student deleted" });
    } catch (error) {
      console.error("Error deleting student:", error);
      res.status(500).json({ message: "Failed to delete student" });
    }
  });

  return httpServer;
}
