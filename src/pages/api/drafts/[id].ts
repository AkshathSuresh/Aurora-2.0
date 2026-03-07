// src/pages/api/drafts/[id].ts
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

function isAdminEmail(email?: string | null) {
  if (!email) return false;
  if (ADMIN_EMAILS.length === 0) return true;
  return ADMIN_EMAILS.includes(String(email).toLowerCase());
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ ok: false, error: "Missing Supabase server configuration" });
  }

  const { id } = req.query;
  const draftId = Array.isArray(id) ? id[0] : id;
  if (!draftId) return res.status(400).json({ ok: false, error: "Missing draft id in URL" });

  try {
    if (req.method === "GET") {
      const { data, error } = await supabase.from("drafts").select("*").eq("id", draftId).limit(1);
      if (error) {
        console.error("drafts/[id] GET error:", error);
        return res.status(500).json({ ok: false, error: error.message ?? String(error) });
      }
      const draft = Array.isArray(data) && data.length > 0 ? data[0] : null;
      if (draft) {
        console.log("drafts/[id] GET found draft:", { id: draft.id, title: draft.title, bodyLength: draft.body?.length ?? 0 });
      } else {
        console.warn("drafts/[id] GET no draft found for id:", draftId);
      }
      return res.status(200).json({ ok: true, draft });
    }

    if (req.method === "PUT") {
      const body = req.body as DraftRow;
      const author_email = body?.author_email ?? null;
      if (!isAdminEmail(author_email)) {
        return res.status(403).json({ ok: false, error: "Unauthorized author_email" });
      }

      const updatePayload: Partial<DraftRow> = {
        title: String(body.title ?? ""),
        date: String(body.date ?? new Date().toISOString().slice(0, 10)),
        excerpt: String(body.excerpt ?? ""),
        body: String(body.body ?? ""),
        cover_url: body.cover_url ?? null,
        cover_thumb: body.cover_thumb ?? null,
        author_email: author_email ?? null,
      };

      const { data, error } = await supabase.from("drafts").update(updatePayload).eq("id", draftId).select("*").limit(1);
      if (error) {
        console.error("drafts/[id] PUT error:", error);
        return res.status(500).json({ ok: false, error: error.message ?? String(error) });
      }
      const draft = Array.isArray(data) && data.length > 0 ? data[0] : null;
      if (draft) {
        console.log("drafts/[id] PUT updated draft:", { id: draft.id, title: draft.title, bodyLength: draft.body?.length ?? 0 });
      }
      return res.status(200).json({ ok: true, draft });
    }

    if (req.method === "DELETE") {
      const body = req.body as { author_email?: string } | undefined;
      const author_email = body?.author_email ?? null;
      if (!isAdminEmail(author_email)) {
        return res.status(403).json({ ok: false, error: "Unauthorized author_email" });
      }

      const { data, error } = await supabase.from("drafts").delete().eq("id", draftId).select("*").limit(1);
      if (error) {
        console.error("drafts/[id] DELETE error:", error);
        return res.status(500).json({ ok: false, error: error.message ?? String(error) });
      }
      const draft = Array.isArray(data) && data.length > 0 ? data[0] : null;
      return res.status(200).json({ ok: true, draft });
    }

    return res.setHeader("Allow", "GET,PUT,DELETE").status(405).end();
  } catch (err: any) {
    console.error("api/drafts/[id] error:", err);
    return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
}
