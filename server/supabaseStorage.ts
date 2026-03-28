import { createClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("WARNING: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. File uploads will fail.");
}

// Create Supabase client with service role for server-side operations
const supabase = createClient(
  SUPABASE_URL || "",
  SUPABASE_SERVICE_ROLE_KEY || "",
  {
    auth: { persistSession: false },
  }
);

const BUCKET_NAME = "certiva-files";

/**
 * Ensures the storage bucket exists, creating it if necessary.
 */
export async function ensureBucket(): Promise<void> {
  const { data, error } = await supabase.storage.getBucket(BUCKET_NAME);
  if (error && error.message?.includes("not found")) {
    const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024, // 5MB
      allowedMimeTypes: ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"],
    });
    if (createError) {
      console.error("Error creating bucket:", createError);
      throw createError;
    }
    console.log(`Created storage bucket: ${BUCKET_NAME}`);
  } else if (error) {
    console.error("Error checking bucket:", error);
  } else {
    console.log(`Storage bucket '${BUCKET_NAME}' ready`);
  }
}

/**
 * Get the file extension from a MIME type.
 */
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

/**
 * Upload a file buffer to Supabase Storage and return the public URL.
 * @param buffer - File buffer
 * @param mimeType - MIME type of the file
 * @param folder - Folder path within the bucket (e.g., "logos", "signatures")
 * @returns Public URL of the uploaded file
 */
export async function uploadFile(
  buffer: Buffer,
  mimeType: string,
  folder: string
): Promise<string> {
  const ext = getExtensionFromMime(mimeType);
  const fileName = `${folder}/${nanoid()}.${ext}`;

  const { data, error } = await supabase.storage.from(BUCKET_NAME).upload(fileName, buffer, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) {
    console.error("Error uploading file:", error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(data.path);
  return urlData.publicUrl;
}

/**
 * Upload a base64 data URL to Supabase Storage and return the public URL.
 * Useful for migrating existing base64 images.
 * @param dataUrl - base64 data URL (e.g., "data:image/png;base64,...")
 * @param folder - Folder path within the bucket
 * @returns Public URL of the uploaded file
 */
export async function uploadBase64(dataUrl: string, folder: string): Promise<string> {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid base64 data URL");
  }

  const mimeType = match[1];
  const base64Data = match[2];
  const buffer = Buffer.from(base64Data, "base64");

  return uploadFile(buffer, mimeType, folder);
}

/**
 * Delete a file from Supabase Storage by its public URL.
 */
export async function deleteFile(publicUrl: string): Promise<void> {
  try {
    // Extract the file path from the URL
    const url = new URL(publicUrl);
    const pathPrefix = `/storage/v1/object/public/${BUCKET_NAME}/`;
    const filePath = url.pathname.replace(pathPrefix, "");

    if (filePath) {
      const { error } = await supabase.storage.from(BUCKET_NAME).remove([filePath]);
      if (error) {
        console.error("Error deleting file:", error);
      }
    }
  } catch (err) {
    console.error("Error parsing file URL for deletion:", err);
  }
}

export { supabase, BUCKET_NAME };
