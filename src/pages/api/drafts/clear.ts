// src/pages/api/drafts/clear.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type DraftRow = {
  id: string;
  author_email?: string | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") return res.status(405).json({ ok: false, error: "Method not allowed" });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ ok: false, error: "Missing Supabase configuration" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ ok: false, error: "Not authenticated" });

  const admins = (process.env.ADMIN_EMAILS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  const userEmail = (session.user.email || "").toLowerCase();
  if (admins.length > 0 && !admins.includes(userEmail)) {
    return res.status(403).json({ ok: false, error: "Not authorized" });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { "x-ssr": "true" } },
  });

  try {
    // select ids first (safe for uuid)
    const { data: rows, error: selErr } = await supabase.from("drafts").select("id");
    if (selErr) throw selErr;

    const ids = Array.isArray(rows) ? (rows.map((r: any) => r.id).filter(Boolean) as string[]) : [];

    if (ids.length === 0) {
      return res.status(200).json({ ok: true, deletedCount: 0 });
    }

    const { error: delErr } = await supabase.from("drafts").delete().in("id", ids);
    if (delErr) throw delErr;

    return res.status(200).json({ ok: true, deletedCount: ids.length });
  } catch (err: any) {
    console.error("drafts/clear error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
}
