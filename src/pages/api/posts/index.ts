// src/pages/api/posts/index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import matter from "gray-matter";

type PostListItem = {
  slug: string;
  title: string;
  date: string;
  excerpt?: string;
  cover?: string;
  coverThumb?: string;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("Warning: Supabase configuration missing. Posts API will not work without SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(SUPABASE_URL || "", SUPABASE_SERVICE_ROLE_KEY || "", {
  auth: { persistSession: false },
});

async function readAllPosts(): Promise<PostListItem[]> {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Supabase not configured");
      return [];
    }

    const { data, error } = await supabase
      .from("posts")
      .select("slug, title, date, excerpt, cover, cover_thumb")
      .order("date", { ascending: false });

    if (error) {
      console.error("readAllPosts error:", error);
      return [];
    }

    return (data || []).map((post) => ({
      slug: post.slug,
      title: post.title,
      date: post.date,
      excerpt: post.excerpt || "",
      cover: post.cover || "",
      coverThumb: post.cover_thumb || "",
    }));
  } catch (e) {
    console.error("readAllPosts error", e);
    return [];
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ ok: false, error: "Supabase not configured" });
  }

  if (req.method === "GET") {
    const list = await readAllPosts();
    return res.status(200).json({ ok: true, posts: list });
  }

  if (req.method === "POST") {
    // create new post (admin create)
    const { slug, frontmatter, body } = req.body as { slug: string; frontmatter: string; body: string };
    if (!slug || !frontmatter) return res.status(400).json({ ok: false, error: "Missing slug or frontmatter" });

    try {
      // Parse frontmatter to extract metadata
      const parsed = matter(`---\n${frontmatter}\n---\n\n${body || ""}\n`);
      const meta = parsed.data || {};

      // Extract tags from frontmatter (handle both array and string formats)
      let tags: string[] = [];
      if (meta.tags) {
        if (Array.isArray(meta.tags)) {
          tags = meta.tags;
        } else if (typeof meta.tags === "string") {
          tags = meta.tags.split(",").map((t: string) => t.trim()).filter(Boolean);
        }
      }

      const postData = {
        slug,
        title: String(meta.title || slug),
        date: String(meta.date || new Date().toISOString().slice(0, 10)),
        excerpt: String(meta.excerpt || ""),
        body: parsed.content || body || "",
        frontmatter: meta as any,
        cover: meta.cover || null,
        cover_thumb: meta.coverThumb || meta.cover_thumb || null,
        tags,
      };

      const { data, error } = await supabase.from("posts").insert(postData).select().single();

      if (error) {
        console.error("create post error:", error);
        return res.status(500).json({ ok: false, error: error.message || "Failed to create post" });
      }

      revalidatePath("/");
      revalidatePath("/tags");
      return res.status(201).json({ ok: true, post: data });
    } catch (e: any) {
      console.error("create post error", e);
      return res.status(500).json({ ok: false, error: e?.message || "Write error" });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
