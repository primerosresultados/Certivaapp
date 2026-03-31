import {
  users,
  businesses,
  certificateTypes,
  certificateTypeSigners,
  certificateTypeLogos,
  customFields,
  certificates,
  importBatches,
  companies,
  students,
  certificateTemplates,
  type User,
  type UpsertUser,
  type Business,
  type InsertBusiness,
  type CertificateType,
  type InsertCertificateType,
  type CertificateTypeSigner,
  type InsertCertificateTypeSigner,
  type CertificateTypeLogo,
  type InsertCertificateTypeLogo,
  type CustomField,
  type InsertCustomField,
  type CertificateTypeWithDetails,
  type Certificate,
  type InsertCertificate,
  type CertificateWithType,
  type ImportBatch,
  type DashboardStats,
  type UserRole,
  type Company,
  type InsertCompany,
  type Student,
  type InsertStudent,
  type StudentWithCompany,
  type CertificateTemplate,
  type InsertCertificateTemplate,
} from "@shared/schema";
import { db } from "./db";
import { eq, ilike, or, sql, desc, and, count, gte, lte, lt, inArray } from "drizzle-orm";

export interface IStorage {
  // Business operations
  getBusinesses(): Promise<Business[]>;
  getBusiness(id: string): Promise<Business | undefined>;
  getBusinessBySlug(slug: string): Promise<Business | undefined>;
  createBusiness(data: InsertBusiness): Promise<Business>;
  updateBusiness(id: string, data: Partial<InsertBusiness>): Promise<Business | undefined>;
  deleteBusiness(id: string): Promise<boolean>;

  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: { 
    email: string; 
    passwordHash: string; 
    firstName?: string; 
    lastName?: string; 
    role?: UserRole;
    businessId?: string;
  }): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  getAllUsers(businessId?: string): Promise<User[]>;
  getUsersByBusiness(businessId: string): Promise<User[]>;
  updateUserRole(id: string, role: UserRole): Promise<User | undefined>;
  updateUserPassword(id: string, passwordHash: string): Promise<User | undefined>;
  countUsers(): Promise<number>;

  // Certificate Types
  getCertificateTypes(businessId?: string): Promise<CertificateType[]>;
  getCertificateType(id: string): Promise<CertificateType | undefined>;
  getCertificateTypeWithDetails(id: string): Promise<CertificateTypeWithDetails | undefined>;
  createCertificateType(data: InsertCertificateType): Promise<CertificateType>;
  updateCertificateType(id: string, data: Partial<InsertCertificateType>): Promise<CertificateType | undefined>;
  deleteCertificateType(id: string): Promise<boolean>;
  getCertificateTypeCounts(businessId?: string): Promise<Record<string, number>>;

  // Certificate Type Signers
  getSignersByCertificateType(certificateTypeId: string): Promise<CertificateTypeSigner[]>;
  createSigner(data: InsertCertificateTypeSigner): Promise<CertificateTypeSigner>;
  updateSigner(id: string, data: Partial<InsertCertificateTypeSigner>): Promise<CertificateTypeSigner | undefined>;
  deleteSigner(id: string): Promise<boolean>;

  // Certificate Type Logos
  getLogosByCertificateType(certificateTypeId: string): Promise<CertificateTypeLogo[]>;
  createLogo(data: InsertCertificateTypeLogo): Promise<CertificateTypeLogo>;
  updateLogo(id: string, data: Partial<InsertCertificateTypeLogo>): Promise<CertificateTypeLogo | undefined>;
  deleteLogo(id: string): Promise<boolean>;

  // Custom Fields
  getCustomFieldsByCertificateType(certificateTypeId: string): Promise<CustomField[]>;
  createCustomField(data: InsertCustomField): Promise<CustomField>;
  updateCustomField(id: string, data: Partial<InsertCustomField>): Promise<CustomField | undefined>;
  deleteCustomField(id: string): Promise<boolean>;

  // Certificates
  getCertificates(options: {
    search?: string;
    status?: string;
    type?: string;
    page?: number;
    perPage?: number;
    businessId?: string;
  }): Promise<{ certificates: CertificateWithType[]; total: number }>;
  getCertificate(id: string): Promise<CertificateWithType | undefined>;
  getCertificateByNumber(number: string): Promise<Certificate | undefined>;
  createCertificate(data: InsertCertificate & { certificateNumber: string; qrCode?: string; validationUrl?: string }): Promise<Certificate>;
  createCertificates(data: (InsertCertificate & { certificateNumber: string; qrCode?: string; validationUrl?: string; studentId?: string })[]): Promise<Certificate[]>;
  updateCertificate(id: string, data: Partial<Certificate>): Promise<Certificate | undefined>;
  deleteCertificate(id: string): Promise<boolean>;
  deleteCertificates(ids: string[]): Promise<number>;

  // Reports
  getCertificatesForExport(options: {
    status?: string;
    type?: string;
    dateFrom?: string;
    dateTo?: string;
    businessId?: string;
  }): Promise<CertificateWithType[]>;

  // Import Batches
  createImportBatch(data: { fileName: string; totalRecords: number; importedById: string; businessId?: string }): Promise<ImportBatch>;
  updateImportBatch(id: string, data: Partial<ImportBatch>): Promise<ImportBatch | undefined>;
  getImportHistory(businessId?: string): Promise<ImportBatch[]>;

  // Dashboard
  getDashboardStats(businessId?: string): Promise<DashboardStats>;

  // Companies (client companies)
  getCompanies(businessId?: string): Promise<Company[]>;
  getCompany(id: string): Promise<Company | undefined>;
  getCompanyByRut(rut: string, businessId?: string): Promise<Company | undefined>;
  getCompanyByName(name: string, businessId?: string): Promise<Company | undefined>;
  createCompany(data: InsertCompany): Promise<Company>;
  createCompanies(data: InsertCompany[]): Promise<Company[]>;
  updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: string): Promise<boolean>;

  // Students
  getStudents(options: { businessId?: string; companyId?: string; search?: string }): Promise<StudentWithCompany[]>;
  getStudent(id: string): Promise<StudentWithCompany | undefined>;
  getStudentByRut(rut: string, businessId?: string): Promise<Student | undefined>;
  createStudent(data: InsertStudent): Promise<Student>;
  createStudents(data: InsertStudent[]): Promise<Student[]>;
  updateStudent(id: string, data: Partial<InsertStudent>): Promise<Student | undefined>;
  deleteStudent(id: string): Promise<boolean>;

  // Certificate Templates
  getCertificateTemplates(businessId?: string): Promise<CertificateTemplate[]>;
  getCertificateTemplate(id: string): Promise<CertificateTemplate | undefined>;
  getDefaultCertificateTemplate(businessId?: string): Promise<CertificateTemplate | undefined>;
  createCertificateTemplate(data: InsertCertificateTemplate): Promise<CertificateTemplate>;
  updateCertificateTemplate(id: string, data: Partial<InsertCertificateTemplate>): Promise<CertificateTemplate | undefined>;
  deleteCertificateTemplate(id: string): Promise<boolean>;
  setDefaultCertificateTemplate(id: string, businessId: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // Business operations
  async getBusinesses(): Promise<Business[]> {
    return db.select().from(businesses).orderBy(businesses.name);
  }

  async getBusiness(id: string): Promise<Business | undefined> {
    const [business] = await db.select().from(businesses).where(eq(businesses.id, id));
    return business;
  }

  async getBusinessBySlug(slug: string): Promise<Business | undefined> {
    const [business] = await db.select().from(businesses).where(eq(businesses.slug, slug.toLowerCase()));
    return business;
  }

  async createBusiness(data: InsertBusiness): Promise<Business> {
    const [business] = await db
      .insert(businesses)
      .values({
        ...data,
        slug: data.slug.toLowerCase(),
      })
      .returning();
    return business;
  }

  async updateBusiness(id: string, data: Partial<InsertBusiness>): Promise<Business | undefined> {
    const updateData = { ...data, updatedAt: new Date() };
    if (data.slug) {
      updateData.slug = data.slug.toLowerCase();
    }
    const [business] = await db
      .update(businesses)
      .set(updateData)
      .where(eq(businesses.id, id))
      .returning();
    return business;
  }

  async deleteBusiness(id: string): Promise<boolean> {
    return db.transaction(async (tx) => {
      await tx.delete(users).where(eq(users.businessId, id));
      await tx.delete(certificates).where(eq(certificates.businessId, id));
      await tx.delete(certificateTypes).where(eq(certificateTypes.businessId, id));
      await tx.delete(importBatches).where(eq(importBatches.businessId, id));
      const result = await tx.delete(businesses).where(eq(businesses.id, id)).returning();
      return result.length > 0;
    });
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user;
  }

  async createUser(data: { 
    email: string; 
    passwordHash: string; 
    firstName?: string; 
    lastName?: string; 
    role?: UserRole;
    businessId?: string;
  }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role || "operator",
        businessId: data.businessId,
      })
      .returning();
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getAllUsers(businessId?: string): Promise<User[]> {
    if (businessId) {
      return db.select().from(users).where(eq(users.businessId, businessId)).orderBy(users.firstName, users.lastName);
    }
    return db.select().from(users).orderBy(users.firstName, users.lastName);
  }

  async getUsersByBusiness(businessId: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.businessId, businessId)).orderBy(users.firstName, users.lastName);
  }

  async updateUserRole(id: string, role: UserRole): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserPassword(id: string, passwordHash: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async countUsers(): Promise<number> {
    const [result] = await db.select({ count: count() }).from(users);
    return Number(result.count);
  }

  // Certificate Types
  async getCertificateTypes(businessId?: string): Promise<CertificateType[]> {
    if (businessId) {
      return db.select().from(certificateTypes).where(eq(certificateTypes.businessId, businessId)).orderBy(certificateTypes.name);
    }
    return db.select().from(certificateTypes).orderBy(certificateTypes.name);
  }

  async getCertificateType(id: string): Promise<CertificateType | undefined> {
    const [type] = await db.select().from(certificateTypes).where(eq(certificateTypes.id, id));
    return type;
  }

  async createCertificateType(data: InsertCertificateType): Promise<CertificateType> {
    const [type] = await db.insert(certificateTypes).values(data).returning();
    return type;
  }

  async updateCertificateType(id: string, data: Partial<InsertCertificateType>): Promise<CertificateType | undefined> {
    const [type] = await db
      .update(certificateTypes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(certificateTypes.id, id))
      .returning();
    return type;
  }

  async deleteCertificateType(id: string): Promise<boolean> {
    const [certCount] = await db
      .select({ count: count() })
      .from(certificates)
      .where(eq(certificates.certificateTypeId, id));
    
    if (certCount.count > 0) {
      return false;
    }

    await db.delete(certificateTypes).where(eq(certificateTypes.id, id));
    return true;
  }

  async getCertificateTypeCounts(businessId?: string): Promise<Record<string, number>> {
    const conditions = businessId ? eq(certificates.businessId, businessId) : undefined;
    
    const counts = await db
      .select({
        certificateTypeId: certificates.certificateTypeId,
        count: count(),
      })
      .from(certificates)
      .where(conditions)
      .groupBy(certificates.certificateTypeId);

    return counts.reduce((acc, { certificateTypeId, count }) => {
      acc[certificateTypeId] = Number(count);
      return acc;
    }, {} as Record<string, number>);
  }

  async getCertificateTypeWithDetails(id: string): Promise<CertificateTypeWithDetails | undefined> {
    const [type] = await db.select().from(certificateTypes).where(eq(certificateTypes.id, id));
    if (!type) return undefined;

    const signers = await db
      .select()
      .from(certificateTypeSigners)
      .where(eq(certificateTypeSigners.certificateTypeId, id))
      .orderBy(certificateTypeSigners.displayOrder);

    const logos = await db
      .select()
      .from(certificateTypeLogos)
      .where(eq(certificateTypeLogos.certificateTypeId, id))
      .orderBy(certificateTypeLogos.displayOrder);

    const fields = await db
      .select()
      .from(customFields)
      .where(eq(customFields.certificateTypeId, id))
      .orderBy(customFields.displayOrder);

    return { ...type, signers, logos, customFields: fields };
  }

  // Certificate Type Signers
  async getSignersByCertificateType(certificateTypeId: string): Promise<CertificateTypeSigner[]> {
    return db
      .select()
      .from(certificateTypeSigners)
      .where(eq(certificateTypeSigners.certificateTypeId, certificateTypeId))
      .orderBy(certificateTypeSigners.displayOrder);
  }

  async createSigner(data: InsertCertificateTypeSigner): Promise<CertificateTypeSigner> {
    const [signer] = await db.insert(certificateTypeSigners).values(data).returning();
    return signer;
  }

  async updateSigner(id: string, data: Partial<InsertCertificateTypeSigner>): Promise<CertificateTypeSigner | undefined> {
    const [signer] = await db
      .update(certificateTypeSigners)
      .set(data)
      .where(eq(certificateTypeSigners.id, id))
      .returning();
    return signer;
  }

  async deleteSigner(id: string): Promise<boolean> {
    const result = await db.delete(certificateTypeSigners).where(eq(certificateTypeSigners.id, id)).returning();
    return result.length > 0;
  }

  // Certificate Type Logos
  async getLogosByCertificateType(certificateTypeId: string): Promise<CertificateTypeLogo[]> {
    return db
      .select()
      .from(certificateTypeLogos)
      .where(eq(certificateTypeLogos.certificateTypeId, certificateTypeId))
      .orderBy(certificateTypeLogos.displayOrder);
  }

  async createLogo(data: InsertCertificateTypeLogo): Promise<CertificateTypeLogo> {
    const [logo] = await db.insert(certificateTypeLogos).values(data).returning();
    return logo;
  }

  async updateLogo(id: string, data: Partial<InsertCertificateTypeLogo>): Promise<CertificateTypeLogo | undefined> {
    const [logo] = await db
      .update(certificateTypeLogos)
      .set(data)
      .where(eq(certificateTypeLogos.id, id))
      .returning();
    return logo;
  }

  async deleteLogo(id: string): Promise<boolean> {
    const result = await db.delete(certificateTypeLogos).where(eq(certificateTypeLogos.id, id)).returning();
    return result.length > 0;
  }

  // Custom Fields
  async getCustomFieldsByCertificateType(certificateTypeId: string): Promise<CustomField[]> {
    return db
      .select()
      .from(customFields)
      .where(eq(customFields.certificateTypeId, certificateTypeId))
      .orderBy(customFields.displayOrder);
  }

  async createCustomField(data: InsertCustomField): Promise<CustomField> {
    const [field] = await db.insert(customFields).values(data).returning();
    return field;
  }

  async updateCustomField(id: string, data: Partial<InsertCustomField>): Promise<CustomField | undefined> {
    const [field] = await db
      .update(customFields)
      .set(data)
      .where(eq(customFields.id, id))
      .returning();
    return field;
  }

  async deleteCustomField(id: string): Promise<boolean> {
    const result = await db.delete(customFields).where(eq(customFields.id, id)).returning();
    return result.length > 0;
  }

  // Certificates
  async getCertificates(options: {
    search?: string;
    status?: string;
    type?: string;
    page?: number;
    perPage?: number;
    businessId?: string;
  }): Promise<{ certificates: CertificateWithType[]; total: number }> {
    const { search, status, type, page = 1, perPage = 25, businessId } = options;
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const conditions: any[] = [];

    if (businessId) {
      conditions.push(eq(certificates.businessId, businessId));
    }

    if (search) {
      conditions.push(
        or(
          ilike(certificates.studentName, `%${search}%`),
          ilike(certificates.studentRut, `%${search}%`),
          ilike(certificates.certificateNumber, `%${search}%`)
        )
      );
    }

    if (type && type !== "all") {
      conditions.push(eq(certificates.certificateTypeId, type));
    }

    if (status && status !== "all") {
      const nowStr = now.toISOString().split('T')[0];
      const thirtyDaysStr = thirtyDaysFromNow.toISOString().split('T')[0];
      
      if (status === "valid") {
        conditions.push(gte(certificates.expiryDate, nowStr));
      } else if (status === "expired") {
        conditions.push(lt(certificates.expiryDate, nowStr));
      } else if (status === "expiring_soon") {
        conditions.push(and(
          gte(certificates.expiryDate, nowStr),
          lte(certificates.expiryDate, thirtyDaysStr)
        ));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db
      .select({ count: count() })
      .from(certificates)
      .where(whereClause);

    const offset = (page - 1) * perPage;

    const result = await db
      .select()
      .from(certificates)
      .leftJoin(certificateTypes, eq(certificates.certificateTypeId, certificateTypes.id))
      .where(whereClause)
      .orderBy(desc(certificates.createdAt))
      .limit(perPage)
      .offset(offset);

    const certsWithType: CertificateWithType[] = result.map((r) => ({
      ...r.certificates,
      certificateType: r.certificate_types!,
    }));

    return { certificates: certsWithType, total: Number(totalResult.count) };
  }

  async getCertificate(id: string): Promise<CertificateWithType | undefined> {
    const [result] = await db
      .select()
      .from(certificates)
      .leftJoin(certificateTypes, eq(certificates.certificateTypeId, certificateTypes.id))
      .leftJoin(businesses, eq(certificateTypes.businessId, businesses.id))
      .where(eq(certificates.id, id));

    if (!result) return undefined;

    return {
      ...result.certificates,
      certificateType: {
        ...result.certificate_types!,
        business: result.businesses || null,
      },
    };
  }

  async getCertificateByNumber(number: string): Promise<Certificate | undefined> {
    const [cert] = await db.select().from(certificates).where(eq(certificates.certificateNumber, number));
    return cert;
  }

  async createCertificate(
    data: InsertCertificate & { certificateNumber: string; qrCode?: string; validationUrl?: string }
  ): Promise<Certificate> {
    const [cert] = await db.insert(certificates).values(data).returning();
    return cert;
  }

  async createCertificates(
    data: (InsertCertificate & { certificateNumber: string; qrCode?: string; validationUrl?: string; studentId?: string })[]
  ): Promise<Certificate[]> {
    if (data.length === 0) return [];
    const certs = await db.insert(certificates).values(data).returning();
    return certs;
  }

  async updateCertificate(id: string, data: Partial<Certificate>): Promise<Certificate | undefined> {
    const [cert] = await db
      .update(certificates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(certificates.id, id))
      .returning();
    return cert;
  }

  async deleteCertificate(id: string): Promise<boolean> {
    const result = await db.delete(certificates).where(eq(certificates.id, id)).returning();
    return result.length > 0;
  }

  async deleteCertificates(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await db.delete(certificates).where(inArray(certificates.id, ids)).returning();
    return result.length;
  }

  // Reports - Export certificates without pagination
  async getCertificatesForExport(options: {
    status?: string;
    type?: string;
    dateFrom?: string;
    dateTo?: string;
    businessId?: string;
  }): Promise<CertificateWithType[]> {
    const { status, type, dateFrom, dateTo, businessId } = options;
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const conditions: any[] = [];

    if (businessId) {
      conditions.push(eq(certificates.businessId, businessId));
    }

    if (type && type !== "all") {
      conditions.push(eq(certificates.certificateTypeId, type));
    }

    if (dateFrom) {
      conditions.push(gte(certificates.issueDate, dateFrom));
    }

    if (dateTo) {
      conditions.push(lte(certificates.issueDate, dateTo));
    }

    if (status && status !== "all") {
      const nowStr = now.toISOString().split('T')[0];
      const thirtyDaysStr = thirtyDaysFromNow.toISOString().split('T')[0];
      
      if (status === "valid") {
        conditions.push(gte(certificates.expiryDate, nowStr));
      } else if (status === "expired") {
        conditions.push(lt(certificates.expiryDate, nowStr));
      } else if (status === "expiring_soon") {
        conditions.push(and(
          gte(certificates.expiryDate, nowStr),
          lte(certificates.expiryDate, thirtyDaysStr)
        ));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await db
      .select()
      .from(certificates)
      .leftJoin(certificateTypes, eq(certificates.certificateTypeId, certificateTypes.id))
      .where(whereClause)
      .orderBy(desc(certificates.createdAt));

    return result.map((r) => ({
      ...r.certificates,
      certificateType: r.certificate_types!,
    }));
  }

  // Import Batches
  async createImportBatch(data: { fileName: string; totalRecords: number; importedById: string; businessId?: string }): Promise<ImportBatch> {
    const [batch] = await db.insert(importBatches).values(data).returning();
    return batch;
  }

  async updateImportBatch(id: string, data: Partial<ImportBatch>): Promise<ImportBatch | undefined> {
    const [batch] = await db.update(importBatches).set(data).where(eq(importBatches.id, id)).returning();
    return batch;
  }

  async getImportHistory(businessId?: string): Promise<ImportBatch[]> {
    if (businessId) {
      return db.select().from(importBatches).where(eq(importBatches.businessId, businessId)).orderBy(desc(importBatches.createdAt));
    }
    return db.select().from(importBatches).orderBy(desc(importBatches.createdAt));
  }

  // Dashboard
  async getDashboardStats(businessId?: string): Promise<DashboardStats> {
    const now = new Date();
    const nowStr = now.toISOString().split('T')[0];
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const thirtyDaysStr = thirtyDaysFromNow.toISOString().split('T')[0];

    const businessCondition = businessId ? eq(certificates.businessId, businessId) : undefined;

    const [totalResult] = await db.select({ count: count() }).from(certificates).where(businessCondition);
    
    const activeConditions = businessId 
      ? and(eq(certificates.businessId, businessId), gte(certificates.expiryDate, nowStr))
      : gte(certificates.expiryDate, nowStr);
    
    const [activeResult] = await db
      .select({ count: count() })
      .from(certificates)
      .where(activeConditions);
    
    const expiredConditions = businessId 
      ? and(eq(certificates.businessId, businessId), lt(certificates.expiryDate, nowStr))
      : lt(certificates.expiryDate, nowStr);
    
    const [expiredResult] = await db
      .select({ count: count() })
      .from(certificates)
      .where(expiredConditions);
    
    const expiringSoonConditions = businessId
      ? and(
          eq(certificates.businessId, businessId),
          gte(certificates.expiryDate, nowStr),
          lte(certificates.expiryDate, thirtyDaysStr)
        )
      : and(
          gte(certificates.expiryDate, nowStr),
          lte(certificates.expiryDate, thirtyDaysStr)
        );
    
    const [expiringSoonResult] = await db
      .select({ count: count() })
      .from(certificates)
      .where(expiringSoonConditions);

    const recentResult = await db
      .select()
      .from(certificates)
      .leftJoin(certificateTypes, eq(certificates.certificateTypeId, certificateTypes.id))
      .where(businessCondition)
      .orderBy(desc(certificates.createdAt))
      .limit(10);

    const recentCertificates: CertificateWithType[] = recentResult.map((r) => ({
      ...r.certificates,
      certificateType: r.certificate_types!,
    }));

    return {
      totalCertificates: Number(totalResult.count),
      activeCertificates: Number(activeResult.count),
      expiredCertificates: Number(expiredResult.count),
      expiringSoon: Number(expiringSoonResult.count),
      recentCertificates,
    };
  }

  // Companies (client companies)
  async getCompanies(businessId?: string): Promise<Company[]> {
    if (businessId) {
      return db.select().from(companies).where(eq(companies.businessId, businessId)).orderBy(companies.name);
    }
    return db.select().from(companies).orderBy(companies.name);
  }

  async getCompany(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company;
  }

  async getCompanyByRut(rut: string, businessId?: string): Promise<Company | undefined> {
    const conditions = businessId 
      ? and(eq(companies.rut, rut), eq(companies.businessId, businessId))
      : eq(companies.rut, rut);
    const [company] = await db.select().from(companies).where(conditions);
    return company;
  }

  async getCompanyByName(name: string, businessId?: string): Promise<Company | undefined> {
    const conditions = businessId 
      ? and(ilike(companies.name, name), eq(companies.businessId, businessId))
      : ilike(companies.name, name);
    const [company] = await db.select().from(companies).where(conditions).limit(1);
    return company;
  }

  async createCompany(data: InsertCompany): Promise<Company> {
    const [company] = await db.insert(companies).values(data).returning();
    return company;
  }

  async createCompanies(data: InsertCompany[]): Promise<Company[]> {
    if (data.length === 0) return [];
    const result = await db.insert(companies).values(data).returning();
    return result;
  }

  async updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined> {
    const [company] = await db
      .update(companies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();
    return company;
  }

  async deleteCompany(id: string): Promise<boolean> {
    // Check if there are students associated with this company
    const [studentCount] = await db
      .select({ count: count() })
      .from(students)
      .where(eq(students.companyId, id));
    
    if (Number(studentCount.count) > 0) {
      return false;
    }

    const result = await db.delete(companies).where(eq(companies.id, id)).returning();
    return result.length > 0;
  }

  // Students
  async getStudents(options: { businessId?: string; companyId?: string; search?: string }): Promise<StudentWithCompany[]> {
    const { businessId, companyId, search } = options;
    const conditions: any[] = [];

    if (businessId) {
      conditions.push(eq(students.businessId, businessId));
    }

    if (companyId) {
      conditions.push(eq(students.companyId, companyId));
    }

    if (search) {
      conditions.push(
        or(
          ilike(students.name, `%${search}%`),
          ilike(students.rut, `%${search}%`),
          ilike(students.email, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await db
      .select()
      .from(students)
      .leftJoin(companies, eq(students.companyId, companies.id))
      .where(whereClause)
      .orderBy(students.name);

    return result.map((r) => ({
      ...r.students,
      company: r.companies || null,
    }));
  }

  async getStudent(id: string): Promise<StudentWithCompany | undefined> {
    const [result] = await db
      .select()
      .from(students)
      .leftJoin(companies, eq(students.companyId, companies.id))
      .where(eq(students.id, id));

    if (!result) return undefined;

    return {
      ...result.students,
      company: result.companies || null,
    };
  }

  async getStudentByRut(rut: string, businessId?: string): Promise<Student | undefined> {
    const conditions = businessId 
      ? and(eq(students.rut, rut), eq(students.businessId, businessId))
      : eq(students.rut, rut);
    const [student] = await db.select().from(students).where(conditions);
    return student;
  }

  async createStudent(data: InsertStudent): Promise<Student> {
    const [student] = await db.insert(students).values(data).returning();
    return student;
  }

  async createStudents(data: InsertStudent[]): Promise<Student[]> {
    if (data.length === 0) return [];
    const result = await db.insert(students).values(data).returning();
    return result;
  }

  async updateStudent(id: string, data: Partial<InsertStudent>): Promise<Student | undefined> {
    const [student] = await db
      .update(students)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(students.id, id))
      .returning();
    return student;
  }

  async deleteStudent(id: string): Promise<boolean> {
    // Check if there are certificates associated with this student
    const [certCount] = await db
      .select({ count: count() })
      .from(certificates)
      .where(eq(certificates.studentId, id));
    
    if (Number(certCount.count) > 0) {
      return false;
    }

    const result = await db.delete(students).where(eq(students.id, id)).returning();
    return result.length > 0;
  }

  // Certificate Templates
  async getCertificateTemplates(businessId?: string): Promise<CertificateTemplate[]> {
    if (businessId) {
      return db.select().from(certificateTemplates)
        .where(eq(certificateTemplates.businessId, businessId))
        .orderBy(certificateTemplates.name);
    }
    return db.select().from(certificateTemplates).orderBy(certificateTemplates.name);
  }

  async getCertificateTemplate(id: string): Promise<CertificateTemplate | undefined> {
    const [template] = await db.select().from(certificateTemplates).where(eq(certificateTemplates.id, id));
    return template;
  }

  async getDefaultCertificateTemplate(businessId?: string): Promise<CertificateTemplate | undefined> {
    if (businessId) {
      const [template] = await db.select().from(certificateTemplates)
        .where(and(
          eq(certificateTemplates.businessId, businessId),
          eq(certificateTemplates.isDefault, true)
        ));
      return template;
    }
    const [template] = await db.select().from(certificateTemplates)
      .where(eq(certificateTemplates.isDefault, true));
    return template;
  }

  async createCertificateTemplate(data: InsertCertificateTemplate): Promise<CertificateTemplate> {
    const [template] = await db.insert(certificateTemplates).values(data).returning();
    return template;
  }

  async updateCertificateTemplate(id: string, data: Partial<InsertCertificateTemplate>): Promise<CertificateTemplate | undefined> {
    const [template] = await db
      .update(certificateTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(certificateTemplates.id, id))
      .returning();
    return template;
  }

  async deleteCertificateTemplate(id: string): Promise<boolean> {
    const result = await db.delete(certificateTemplates).where(eq(certificateTemplates.id, id)).returning();
    return result.length > 0;
  }

  async setDefaultCertificateTemplate(id: string, businessId: string): Promise<boolean> {
    // First, unset all default templates for this business
    await db
      .update(certificateTemplates)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(certificateTemplates.businessId, businessId));

    // Then set the selected template as default
    const [template] = await db
      .update(certificateTemplates)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(certificateTemplates.id, id))
      .returning();

    return !!template;
  }
}

export const storage = new DatabaseStorage();
