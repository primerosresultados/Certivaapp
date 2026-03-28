/**
 * Migration script: Uploads existing base64 images from the database
 * to Supabase Storage and updates the records with the new URLs.
 * 
 * Run: npx tsx script/migrate-to-supabase-storage.ts
 */
import "dotenv/config";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";

const DATABASE_URL = process.env.DATABASE_URL!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET_NAME = "certiva-files";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function getExtensionFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/svg+xml": "svg",
    "image/webp": "webp",
  };
  return map[mimeType] || "png";
}

async function uploadBase64ToStorage(dataUrl: string, folder: string): Promise<string> {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) {
    throw new Error("Invalid base64 data URL");
  }

  const mimeType = match[1];
  const base64Data = match[2];
  const buffer = Buffer.from(base64Data, "base64");
  const ext = getExtensionFromMime(mimeType);
  const fileName = `${folder}/${nanoid()}.${ext}`;

  const { data, error } = await supabase.storage.from(BUCKET_NAME).upload(fileName, buffer, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(data.path);
  return urlData.publicUrl;
}

async function ensureBucket(): Promise<void> {
  const { error } = await supabase.storage.getBucket(BUCKET_NAME);
  if (error && error.message?.includes("not found")) {
    const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"],
    });
    if (createError) throw createError;
    console.log(`✅ Created bucket: ${BUCKET_NAME}`);
  } else {
    console.log(`✅ Bucket '${BUCKET_NAME}' exists`);
  }
}

async function migrate() {
  console.log("🚀 Starting migration of base64 images to Supabase Storage...\n");

  await ensureBucket();

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  // 1. Migrate business logos
  console.log("\n📦 Migrating business logos...");
  const businesses = await client.query("SELECT id, name, logo_url FROM businesses WHERE logo_url IS NOT NULL");
  for (const row of businesses.rows) {
    if (!row.logo_url?.startsWith("data:")) {
      console.log(`  ⏭️  ${row.name}: Already migrated or not base64`);
      totalSkipped++;
      continue;
    }
    try {
      const newUrl = await uploadBase64ToStorage(row.logo_url, "business-logos");
      await client.query("UPDATE businesses SET logo_url = $1 WHERE id = $2", [newUrl, row.id]);
      console.log(`  ✅ ${row.name}: Migrated`);
      totalMigrated++;
    } catch (err: any) {
      console.error(`  ❌ ${row.name}: ${err.message}`);
      totalErrors++;
    }
  }

  // 2. Migrate signer signatures
  console.log("\n📦 Migrating signer signatures...");
  const signers = await client.query("SELECT id, name, signature_url FROM certificate_type_signers WHERE signature_url IS NOT NULL");
  for (const row of signers.rows) {
    if (!row.signature_url?.startsWith("data:")) {
      console.log(`  ⏭️  ${row.name}: Already migrated or not base64`);
      totalSkipped++;
      continue;
    }
    try {
      const newUrl = await uploadBase64ToStorage(row.signature_url, "signatures");
      await client.query("UPDATE certificate_type_signers SET signature_url = $1 WHERE id = $2", [newUrl, row.id]);
      console.log(`  ✅ ${row.name}: Migrated`);
      totalMigrated++;
    } catch (err: any) {
      console.error(`  ❌ ${row.name}: ${err.message}`);
      totalErrors++;
    }
  }

  // 3. Migrate certificate type logos
  console.log("\n📦 Migrating certificate type logos...");
  const logos = await client.query("SELECT id, name, logo_url FROM certificate_type_logos WHERE logo_url IS NOT NULL");
  for (const row of logos.rows) {
    if (!row.logo_url?.startsWith("data:")) {
      console.log(`  ⏭️  ${row.name || row.id}: Already migrated or not base64`);
      totalSkipped++;
      continue;
    }
    try {
      const newUrl = await uploadBase64ToStorage(row.logo_url, "cert-logos");
      await client.query("UPDATE certificate_type_logos SET logo_url = $1 WHERE id = $2", [newUrl, row.id]);
      console.log(`  ✅ ${row.name || row.id}: Migrated`);
      totalMigrated++;
    } catch (err: any) {
      console.error(`  ❌ ${row.name || row.id}: ${err.message}`);
      totalErrors++;
    }
  }

  await client.end();

  console.log("\n" + "=".repeat(50));
  console.log(`✅ Migrated: ${totalMigrated}`);
  console.log(`⏭️  Skipped: ${totalSkipped}`);
  console.log(`❌ Errors: ${totalErrors}`);
  console.log("=".repeat(50));
  console.log("\n🎉 Migration complete!");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
