// src/pages/api/drafts/index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type DraftRow = {
  id?: string;
  title?: string;
  date?: string;
  excerpt?: string;
  body?: string;
  cover_url?: string | null;
  cover_thumb?: string | null;
  author_email?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("Supabase server config missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(SUPABASE_URL || "", SUPABASE_SERVICE_ROLE_KEY || "");

// simple helper: check author is allowed
function isAdminEmail(email?: string | null) {
  if (!email) return false;
  if (ADMIN_EMAILS.length === 0) return true; // dev convenience if ADMIN_EMAILS not set
  return ADMIN_EMAILS.includes(String(email).toLowerCase());
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ ok: false, error: "Missing Supabase server configuration" });
  }

  try {
    if (req.method === "GET") {
      const { latest, author } = req.query;
      if (latest) {
        // latest draft (optionally filtered by author)
        let q = supabase.from("drafts").select("*").order("created_at", { ascending: false }).limit(1);
        if (author && typeof author === "string") q = q.eq("author_email", author);
        const { data, error } = await q;
        if (error) {
          console.error("drafts/index GET latest error:", error);
          return res.status(500).json({ ok: false, error: error.message ?? String(error) });
        }
        const draft = Array.isArray(data) && data.length > 0 ? data[0] : null;
        if (draft) {
          console.log("drafts/index GET latest found draft:", { id: draft.id, title: draft.title, bodyLength: draft.body?.length ?? 0 });
        }
        return res.status(200).json({ ok: true, draft });
      }

      // regular list
      let q = supabase.from("drafts").select("*").order("created_at", { ascending: false }).limit(50);
      if (author && typeof author === "string") q = q.eq("author_email", author);
      const { data, error } = await q;
      if (error) {
        console.error("drafts/index GET list error:", error);
        return res.status(500).json({ ok: false, error: error.message ?? String(error) });
      }
      return res.status(200).json({ ok: true, drafts: data ?? [] });
    }

    if (req.method === "POST") {
      const body = req.body as DraftRow;
      const author_email = body?.author_email ?? null;
      if (!isAdminEmail(author_email)) {
        return res.status(403).json({ ok: false, error: "Unauthorized author_email" });
      }

      const insertPayload: DraftRow = {
        title: String(body.title ?? ""),
        date: String(body.date ?? new Date().toISOString().slice(0, 10)),
        excerpt: String(body.excerpt ?? ""),
        body: String(body.body ?? ""),
        cover_url: body.cover_url ?? null,
        cover_thumb: body.cover_thumb ?? null,
        author_email: author_email ?? null,
      };

      const { data, error } = await supabase.from("drafts").insert(insertPayload).select("*");
      if (error) {
        console.error("drafts/index POST error:", error);
        return res.status(500).json({ ok: false, error: error.message ?? String(error) });
      }
      // when inserting, select returns array; return the first element
      const draft = Array.isArray(data) && data.length > 0 ? data[0] : null;
      if (draft) {
        console.log("drafts/index POST created draft:", { id: draft.id, title: draft.title, bodyLength: draft.body?.length ?? 0 });
      }
      return res.status(201).json({ ok: true, draft });
    }

    return res.setHeader("Allow", "GET,POST").status(405).end();
  } catch (err: any) {
    console.error("api/drafts/index error:", err);
    return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
}
