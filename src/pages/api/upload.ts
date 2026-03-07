// src/pages/api/upload.ts
import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

export const config = { api: { bodyParser: false } };

type Success = { ok: true; url: string; thumb?: string };
type Fail = { ok: false; error: string };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "images";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("Missing Supabase env vars for upload API. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function safeName(name: string) {
  const ext = path.extname(name) || ".webp";
  const base = path.basename(name, ext).replace(/[^a-z0-9-_]/gi, "-").replace(/-+/g, "-").slice(0, 60);
  const unique = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  return `${base}-${unique}${ext.toLowerCase()}`;
}

async function parseForm(req: NextApiRequest): Promise<{ fields: any; files: any }> {
  // Formidable still writes a temporary file; we will read & convert it and then remove
  const tmpDir = path.join(process.cwd(), "tmp");
  await fs.promises.mkdir(tmpDir, { recursive: true });

  const form = formidable({
    multiples: false,
    uploadDir: tmpDir,
    keepExtensions: true,
    maxFileSize: 15 * 1024 * 1024, // 15MB server limit
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (err: any, fields: any, files: any) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

function pickFile(files: any): any | null {
  if (!files) return null;
  let file = files.file || files.image || null;
  if (!file) {
    const vals = Object.values(files);
    if (vals.length) file = vals[0];
  }
  if (Array.isArray(file) && file.length) file = file[0];
  return file ?? null;
}

function getFilePath(file: any): string | null {
  if (!file) return null;
  return file.filepath || file.path || file.tempFilePath || null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Success | Fail>) {
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ ok: false, error: "Method not allowed" }); }

  try {
    const { fields, files } = await parseForm(req);

    console.log("UPLOAD - fields:", Object.keys(fields || {}));
    console.log("UPLOAD - files keys:", Object.keys(files || {}));
    console.log("UPLOAD - files raw:", files);

    const file = pickFile(files);
    if (!file) return res.status(400).json({ ok: false, error: "No file found in request" });

    const filepath = getFilePath(file);
    if (!filepath) {
      console.error("Could not determine uploaded file path:", file);
      return res.status(500).json({ ok: false, error: "Uploaded file path not found" });
    }

    // Read buffer from the tmp file
    const fileBuffer = await fs.promises.readFile(filepath);

    // Build unique names and convert to webp buffers
    const incomingName = file.originalFilename || file.newFilename || file.name || `upload-${Date.now()}.jpg`;
    const safeBase = path.basename(incomingName, path.extname(incomingName)).replace(/[^a-z0-9-_]/gi, "-").slice(0, 40);
    const unique = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    const optimizedName = `${safeBase}-${unique}-opt.webp`;
    const thumbName = `${safeBase}-${unique}-thumb.webp`;

    // Convert to webp buffers using sharp (do not write to disk)
    const optimizedBuffer = await sharp(fileBuffer)
      .rotate()
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const thumbBuffer = await sharp(fileBuffer)
      .rotate()
      .resize({ width: 800, withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer();

    // Upload buffers to Supabase Storage
    // Put objects at <bucket>/<optimizedName>
    const uploadOptimized = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(optimizedName, optimizedBuffer, {
        contentType: "image/webp",
        cacheControl: "public, max-age=31536000",
        upsert: false,
      });

    if (uploadOptimized.error) {
      console.error("Supabase upload optimized error:", uploadOptimized.error);
      // cleanup tmp file
      await fs.promises.unlink(filepath).catch(() => null);
      return res.status(500).json({ ok: false, error: uploadOptimized.error.message || "Upload error" });
    }

    const uploadThumb = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(thumbName, thumbBuffer, {
        contentType: "image/webp",
        cacheControl: "public, max-age=31536000",
        upsert: false,
      });

    if (uploadThumb.error) {
      console.error("Supabase upload thumb error:", uploadThumb.error);
      await fs.promises.unlink(filepath).catch(() => null);
      return res.status(500).json({ ok: false, error: uploadThumb.error.message || "Upload error" });
    }

    // get public urls
    const optimizedUrl = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(optimizedName).data?.publicUrl ?? null;
    const thumbUrl = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(thumbName).data?.publicUrl ?? null;


    // cleanup tmp file
    await fs.promises.unlink(filepath).catch(() => null);

    return res.status(200).json({ ok: true, url: optimizedUrl, thumb: thumbUrl });
  } catch (err: any) {
    console.error("Upload endpoint error:", err);
    // surface friendly message if possible
    const msg = err?.code === "LIMIT_FILE_SIZE" ? "Image exceeds 15MB limit." : (err?.message || "Unknown server error");
    return res.status(500).json({ ok: false, error: String(msg) });
  }
}
