// src/pages/api/posts/[slug].ts
import type { NextApiRequest, NextApiResponse } from "next";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import matter from "gray-matter";

// Supabase server client (Service Role Key required for delete)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_BUCKET = process.env.SUPABASE_BUCKET || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("Warning: Supabase URL or Service Role Key missing. Posts and image deletion will not work without these env vars.");
}

const supabase = createClient(SUPABASE_URL || "", SUPABASE_SERVICE_ROLE_KEY || "", {
  auth: { persistSession: false },
});

/**
 * Returns: { bucket, objectPath } or null if cannot parse
 */
function parseSupabasePublicUrl(urlStr: string | null | undefined): { bucket: string; objectPath: string } | null {
  if (!urlStr) return null;
  try {
    const u = new URL(urlStr);
    // pathname: /storage/v1/object/public/<bucket>/<...object path...>
    const parts = u.pathname.split("/").filter(Boolean); // remove empty
    // find the "public" segment
    const publicIdx = parts.indexOf("public");
    if (publicIdx >= 0 && parts.length > publicIdx + 1) {
      const bucket = parts[publicIdx + 1];
      const objectPath = parts.slice(publicIdx + 2).join("/");
      if (objectPath) return { bucket, objectPath };
    }

    // fallback for direct object urls or bucketless patterns: take last segment
    const fallbackName = parts.slice(-1)[0];
    return { bucket: DEFAULT_BUCKET || "", objectPath: fallbackName };
  } catch {
    return null;
  }
}

/**
 * Given a frontmatter URL (cover or coverThumb), attempt to remove the object from Supabase storage.
 * Uses DEFAULT_BUCKET if SUPABASE_BUCKET is set; otherwise tries to parse bucket from URL.
 */
async function tryRemoveSupabaseObject(publicUrl: string | null | undefined): Promise<{ ok: boolean; error?: any }> {
  if (!publicUrl || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_URL) return { ok: false, error: "No URL or supabase config" };

  const parsed = parseSupabasePublicUrl(publicUrl);
  if (!parsed) return { ok: false, error: "Could not parse public URL" };

  // choose bucket: env override preferred
  const bucket = DEFAULT_BUCKET || parsed.bucket;
  const objectPath = parsed.objectPath;

  if (!bucket || !objectPath) return { ok: false, error: "Missing bucket or object path" };

  try {
    const { data, error } = await supabase.storage.from(bucket).remove([objectPath]);
    if (error) {
      // if error code indicates not found, treat as ok (already deleted)
      return { ok: false, error };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err };
  }
}

function safeSlug(s: string) {
  return String(s).toLowerCase().trim().replace(/[^a-z0-9\-]/g, "-").replace(/-+/g, "-");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ ok: false, error: "Supabase not configured" });
  }

  const { slug } = req.query as { slug: string };

  if (!slug) return res.status(400).json({ ok: false, error: "Missing slug" });

  if (req.method === "GET") {
    try {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("slug", slug)
        .single();

      if (error || !data) {
        return res.status(404).json({ ok: false, error: "Not found" });
      }

      // Reconstruct frontmatter from stored data
      const frontmatter = {
        title: data.title,
        date: data.date,
        excerpt: data.excerpt,
        cover: data.cover,
        coverThumb: data.cover_thumb,
        tags: data.tags || [],
        ...(data.frontmatter || {}),
      };

      return res.status(200).json({ ok: true, slug: data.slug, frontmatter, body: data.body });
    } catch (e: any) {
      console.error("get post error", e);
      return res.status(500).json({ ok: false, error: e?.message || "Failed to get post" });
    }
  }

  if (req.method === "PUT") {
    // update existing post
    const { newSlug, frontmatter, body } = req.body as { newSlug?: string; frontmatter: string; body: string };
    try {
      // Parse frontmatter
      const parsed = matter(`---\n${frontmatter}\n---\n\n${body || ""}\n`);
      const meta = parsed.data || {};

      // Extract tags
      let tags: string[] = [];
      if (meta.tags) {
        if (Array.isArray(meta.tags)) {
          tags = meta.tags;
        } else if (typeof meta.tags === "string") {
          tags = meta.tags.split(",").map((t: string) => t.trim()).filter(Boolean);
        }
      }

      const targetSlug = newSlug ? safeSlug(newSlug) : slug;

      const updateData: any = {
        slug: targetSlug,
        title: String(meta.title || targetSlug),
        date: String(meta.date || new Date().toISOString().slice(0, 10)),
        excerpt: String(meta.excerpt || ""),
        body: parsed.content || body || "",
        frontmatter: meta as any,
        cover: meta.cover || null,
        cover_thumb: meta.coverThumb || meta.cover_thumb || null,
        tags,
      };

      // If slug changed, we need to delete old and create new (or update in transaction)
      if (targetSlug !== slug) {
        // Delete old post
        await supabase.from("posts").delete().eq("slug", slug);
        // Insert new post with new slug
        const { data, error } = await supabase.from("posts").insert(updateData).select().single();
        if (error) throw error;
        revalidatePath("/");
        revalidatePath("/tags");
        revalidatePath(`/posts/${slug}`);
        revalidatePath(`/posts/${targetSlug}`);
        return res.status(200).json({ ok: true, slug: targetSlug, post: data });
      } else {
        // Update existing post
        const { data, error } = await supabase
          .from("posts")
          .update(updateData)
          .eq("slug", slug)
          .select()
          .single();
        if (error) throw error;
        revalidatePath("/");
        revalidatePath("/tags");
        revalidatePath(`/posts/${slug}`);
        return res.status(200).json({ ok: true, slug: targetSlug, post: data });
      }
    } catch (e: any) {
      console.error("update post error", e);
      return res.status(500).json({ ok: false, error: e?.message || "Update failed" });
    }
  }

  if (req.method === "DELETE") {
    try {
      // Get post to find image URLs
      const { data: postData } = await supabase
        .from("posts")
        .select("cover, cover_thumb")
        .eq("slug", slug)
        .single();

      const removalResults: Array<{ url: string; result: { ok: boolean; error?: any } }> = [];

      if (postData) {
        const coverUrl: string | null = postData.cover || null;
        const coverThumbUrl: string | null = postData.cover_thumb || null;

        // Attempt to delete cover images from Supabase storage
        if (coverUrl) {
          const r = await tryRemoveSupabaseObject(coverUrl);
          removalResults.push({ url: coverUrl, result: r });
        }

        if (coverThumbUrl && coverThumbUrl !== coverUrl) {
          const r = await tryRemoveSupabaseObject(coverThumbUrl);
          removalResults.push({ url: coverThumbUrl, result: r });
        }
      }

      // Delete post from database
      const { error } = await supabase.from("posts").delete().eq("slug", slug);

      if (error) {
        console.error("delete post error", error);
        return res.status(500).json({ ok: false, error: error.message || "Delete failed" });
      }

      revalidatePath("/");
      revalidatePath("/tags");
      revalidatePath(`/posts/${slug}`);
      return res.status(200).json({ ok: true, removed: removalResults });
    } catch (e: any) {
      console.error("delete post error", e);
      return res.status(500).json({ ok: false, error: e?.message || "Delete failed" });
    }
  }

  res.setHeader("Allow", "GET, PUT, DELETE");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
