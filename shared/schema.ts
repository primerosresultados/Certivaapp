import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Businesses (tenants) table for SaaS multi-tenancy
export const businesses = pgTable("businesses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  logoUrl: text("logo_url"),
  infoLink: text("info_link"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBusinessSchema = createInsertSchema(businesses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBusiness = z.infer<typeof insertBusinessSchema>;
export type Business = typeof businesses.$inferSelect;

// User roles - now includes superadmin
export const userRoles = ["superadmin", "admin", "operator", "auditor"] as const;
export type UserRole = typeof userRoles[number];

// User storage table - with businessId for multi-tenancy
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role", { length: 20 }).notNull().default("operator"),
  businessId: varchar("business_id").references(() => businesses.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_users_business").on(table.businessId),
]);

export const usersRelations = relations(users, ({ one }) => ({
  business: one(businesses, {
    fields: [users.businessId],
    references: [businesses.id],
  }),
}));

export const businessesRelations = relations(businesses, ({ many }) => ({
  users: many(users),
  certificateTypes: many(certificateTypes),
  certificates: many(certificates),
  companies: many(companies),
  students: many(students),
}));

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  passwordHash: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Certificate type categories
export const certificateCategories = ["cursos", "capacitaciones", "certificaciones"] as const;
export type CertificateCategory = typeof certificateCategories[number];

// Client Companies - companies that contract training services
export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  rut: varchar("rut", { length: 20 }),
  address: text("address"),
  contactName: varchar("contact_name", { length: 255 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  businessId: varchar("business_id").references(() => businesses.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_companies_business").on(table.businessId),
  index("idx_companies_rut").on(table.rut),
]);

export const companiesRelations = relations(companies, ({ one, many }) => ({
  business: one(businesses, {
    fields: [companies.businessId],
    references: [businesses.id],
  }),
  students: many(students),
}));

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

// Students - people who receive training/certifications
export const students = pgTable("students", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  rut: varchar("rut", { length: 20 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  companyId: varchar("company_id").references(() => companies.id),
  businessId: varchar("business_id").references(() => businesses.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_students_business").on(table.businessId),
  index("idx_students_company").on(table.companyId),
  index("idx_students_rut").on(table.rut),
]);

export const studentsRelations = relations(students, ({ one, many }) => ({
  business: one(businesses, {
    fields: [students.businessId],
    references: [businesses.id],
  }),
  company: one(companies, {
    fields: [students.companyId],
    references: [companies.id],
  }),
  certificates: many(certificates),
}));

export const insertStudentSchema = createInsertSchema(students).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof students.$inferSelect;

// Student with company info
export type StudentWithCompany = Student & {
  company?: Company | null;
};

// Certificate Types - with businessId and category
export const certificateTypes = pgTable("certificate_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }).notNull().default("cursos"),
  validityMonths: integer("validity_months").notNull().default(12),
  footerText: text("footer_text"),
  businessId: varchar("business_id").references(() => businesses.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_certificate_types_business").on(table.businessId),
  index("idx_certificate_types_category").on(table.category),
]);

// Signers for certificate types - people who sign the certificates
export const certificateTypeSigners = pgTable("certificate_type_signers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  certificateTypeId: varchar("certificate_type_id").notNull().references(() => certificateTypes.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  position: varchar("position", { length: 255 }).notNull(),
  signatureUrl: text("signature_url"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_signers_certificate_type").on(table.certificateTypeId),
]);

export const certificateTypeSignersRelations = relations(certificateTypeSigners, ({ one }) => ({
  certificateType: one(certificateTypes, {
    fields: [certificateTypeSigners.certificateTypeId],
    references: [certificateTypes.id],
  }),
}));

export const insertCertificateTypeSignerSchema = createInsertSchema(certificateTypeSigners).omit({
  id: true,
  createdAt: true,
});

export type InsertCertificateTypeSigner = z.infer<typeof insertCertificateTypeSignerSchema>;
export type CertificateTypeSigner = typeof certificateTypeSigners.$inferSelect;

// Logos for certificate types - logos of certifying entities
export const certificateTypeLogos = pgTable("certificate_type_logos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  certificateTypeId: varchar("certificate_type_id").notNull().references(() => certificateTypes.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }),
  logoUrl: text("logo_url"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_logos_certificate_type").on(table.certificateTypeId),
]);

export const certificateTypeLogosRelations = relations(certificateTypeLogos, ({ one }) => ({
  certificateType: one(certificateTypes, {
    fields: [certificateTypeLogos.certificateTypeId],
    references: [certificateTypes.id],
  }),
}));

export const insertCertificateTypeLogoSchema = createInsertSchema(certificateTypeLogos).omit({
  id: true,
  createdAt: true,
});

export type InsertCertificateTypeLogo = z.infer<typeof insertCertificateTypeLogoSchema>;
export type CertificateTypeLogo = typeof certificateTypeLogos.$inferSelect;

// Custom Fields for certificate types - dynamic fields that can be added to certificates
export const customFields = pgTable("custom_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  certificateTypeId: varchar("certificate_type_id").notNull().references(() => certificateTypes.id, { onDelete: "cascade" }),
  fieldName: varchar("field_name", { length: 100 }).notNull(),
  fieldLabel: varchar("field_label", { length: 255 }).notNull(),
  fieldType: varchar("field_type", { length: 50 }).notNull().default("text"),
  isRequired: boolean("is_required").notNull().default(false),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_custom_fields_certificate_type").on(table.certificateTypeId),
]);

export const customFieldsRelations = relations(customFields, ({ one }) => ({
  certificateType: one(certificateTypes, {
    fields: [customFields.certificateTypeId],
    references: [certificateTypes.id],
  }),
}));

export const insertCustomFieldSchema = createInsertSchema(customFields).omit({
  id: true,
  createdAt: true,
});

export type InsertCustomField = z.infer<typeof insertCustomFieldSchema>;
export type CustomField = typeof customFields.$inferSelect;

export const certificateTypesRelations = relations(certificateTypes, ({ one, many }) => ({
  business: one(businesses, {
    fields: [certificateTypes.businessId],
    references: [businesses.id],
  }),
  certificates: many(certificates),
  signers: many(certificateTypeSigners),
  logos: many(certificateTypeLogos),
  customFields: many(customFields),
}));

export const insertCertificateTypeSchema = createInsertSchema(certificateTypes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCertificateType = z.infer<typeof insertCertificateTypeSchema>;
export type CertificateType = typeof certificateTypes.$inferSelect;

// Extended certificate type with signers, logos and custom fields
export type CertificateTypeWithDetails = CertificateType & {
  signers: CertificateTypeSigner[];
  logos: CertificateTypeLogo[];
  customFields: CustomField[];
};

// Certificate type with business
export type CertificateTypeWithBusiness = CertificateType & {
  business?: Business | null;
  customFields?: CustomField[];
};

// Certificates - with businessId and studentId
export const certificates = pgTable("certificates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  certificateNumber: varchar("certificate_number", { length: 50 }).notNull().unique(),
  studentName: varchar("student_name", { length: 255 }).notNull(),
  studentRut: varchar("student_rut", { length: 20 }).notNull(),
  studentId: varchar("student_id").references(() => students.id),
  certificateTypeId: varchar("certificate_type_id").notNull().references(() => certificateTypes.id),
  equipment: varchar("equipment", { length: 255 }),
  nomenclature: varchar("nomenclature", { length: 255 }),
  customFieldValues: jsonb("custom_field_values"),
  issueDate: date("issue_date").notNull(),
  expiryDate: date("expiry_date").notNull(),
  qrCode: text("qr_code"),
  validationUrl: varchar("validation_url", { length: 500 }),
  isActive: boolean("is_active").notNull().default(true),
  businessId: varchar("business_id").references(() => businesses.id),
  createdById: varchar("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_certificates_rut").on(table.studentRut),
  index("idx_certificates_number").on(table.certificateNumber),
  index("idx_certificates_type").on(table.certificateTypeId),
  index("idx_certificates_business").on(table.businessId),
  index("idx_certificates_student").on(table.studentId),
]);

export const certificatesRelations = relations(certificates, ({ one }) => ({
  certificateType: one(certificateTypes, {
    fields: [certificates.certificateTypeId],
    references: [certificateTypes.id],
  }),
  student: one(students, {
    fields: [certificates.studentId],
    references: [students.id],
  }),
  createdBy: one(users, {
    fields: [certificates.createdById],
    references: [users.id],
  }),
  business: one(businesses, {
    fields: [certificates.businessId],
    references: [businesses.id],
  }),
}));

export const insertCertificateSchema = createInsertSchema(certificates).omit({
  id: true,
  qrCode: true,
  validationUrl: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCertificate = z.infer<typeof insertCertificateSchema>;
export type Certificate = typeof certificates.$inferSelect;

// Extended certificate type with relations
export type CertificateWithType = Certificate & {
  certificateType: CertificateTypeWithBusiness;
};

// Import batch tracking - with businessId
export const importBatches = pgTable("import_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  totalRecords: integer("total_records").notNull().default(0),
  successfulRecords: integer("successful_records").notNull().default(0),
  failedRecords: integer("failed_records").notNull().default(0),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  errors: jsonb("errors"),
  businessId: varchar("business_id").references(() => businesses.id),
  importedById: varchar("imported_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_import_batches_business").on(table.businessId),
]);

export const importBatchesRelations = relations(importBatches, ({ one }) => ({
  business: one(businesses, {
    fields: [importBatches.businessId],
    references: [businesses.id],
  }),
  importedBy: one(users, {
    fields: [importBatches.importedById],
    references: [users.id],
  }),
}));

export type ImportBatch = typeof importBatches.$inferSelect;

// Certificate Templates - design templates for PDFs
export const certificateTemplates = pgTable("certificate_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  templateKey: varchar("template_key", { length: 50 }).notNull(),
  primaryColor: varchar("primary_color", { length: 20 }).notNull().default("#3B82F6"),
  secondaryColor: varchar("secondary_color", { length: 20 }).notNull().default("#1E40AF"),
  accentColor: varchar("accent_color", { length: 20 }).notNull().default("#93C5FD"),
  isDefault: boolean("is_default").notNull().default(false),
  businessId: varchar("business_id").references(() => businesses.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_certificate_templates_business").on(table.businessId),
]);

export const certificateTemplatesRelations = relations(certificateTemplates, ({ one }) => ({
  business: one(businesses, {
    fields: [certificateTemplates.businessId],
    references: [businesses.id],
  }),
}));

export const insertCertificateTemplateSchema = createInsertSchema(certificateTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCertificateTemplate = z.infer<typeof insertCertificateTemplateSchema>;
export type CertificateTemplate = typeof certificateTemplates.$inferSelect;

// Stats type for dashboard
export type DashboardStats = {
  totalCertificates: number;
  activeCertificates: number;
  expiredCertificates: number;
  expiringSoon: number;
  recentCertificates: CertificateWithType[];
};

// User with business info
export type UserWithBusiness = User & {
  business?: Business | null;
};
