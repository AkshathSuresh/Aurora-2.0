// src/pages/admin.tsx
import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Head from "next/head";
import Layout from "@/components/Layout";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { useSession, signOut } from "next-auth/react";
import DraftsPanel from "@/components/DraftsPanel";

// dynamic imports for editor + emoji (SSR safe)
const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });
const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

type PostMetaItem = {
  slug: string;
  title: string;
  date: string;
  excerpt?: string;
  cover?: string;
  coverThumb?: string;
};

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);

  if (!session) {
    return {
      redirect: { destination: "/signin", permanent: false },
    };
  }

  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (admins.length > 0) {
    const email = session.user?.email?.toLowerCase() ?? "";
    if (!admins.includes(email)) {
      return {
        redirect: { destination: "/", permanent: false },
      };
    }
  }

  return { props: { session } };
};

export default function AdminPage(): JSX.Element {
  const { data: session } = useSession();

  // refs & state
  const fileRef = useRef<HTMLInputElement | null>(null);
  const editorWrapperRef = useRef<HTMLDivElement | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [excerpt, setExcerpt] = useState("");
  const [author, setAuthor] = useState("");
  const [body, setBody] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverThumb, setCoverThumb] = useState<string | null>(null);
  const [posts, setPosts] = useState<PostMetaItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);

  // autosave interval controller
  const autosaveIntervalRef = useRef<number | null>(null);
  const lastSnapshotRef = useRef<string>("");

  useEffect(() => {
    fetchList();
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
      if (autosaveIntervalRef.current) window.clearInterval(autosaveIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchList() {
    setLoadingList(true);
    try {
      const res = await fetch("/api/posts");
      const data = await res.json();
      if (res.ok && data?.posts) setPosts(data.posts);
      else setPosts([]);
    } catch (e) {
      console.error("fetch list error", e);
      setPosts([]);
    } finally {
      setLoadingList(false);
    }
  }

  // --- file pick & preview ---
  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > 15 * 1024 * 1024) {
      setError("Image must be smaller than 15MB.");
      setCoverFile(null);
      setCoverPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setCoverFile(f);
    setCoverUrl(null);
    setCoverThumb(null);
    if (f) {
      const u = URL.createObjectURL(f);
      setCoverPreview(u);
    } else setCoverPreview(null);
    // nudge autosave
    triggerImmediateSave();
  }

  // crop to a fixed 3:2 aspect for blog covers (output webp ~1000px wide)
  async function cropImageToBlogAspect(file: File) {
    const aspectW = 3;
    const aspectH = 2;
    const targetW = 1000;
    const targetH = Math.round((targetW / aspectW) * aspectH);

    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Failed to load image"));
      i.src = dataUrl;
    });

    const srcW = img.naturalWidth;
    const srcH = img.naturalHeight;
    const desired = aspectW / aspectH;
    const srcRatio = srcW / srcH;

    let cropW: number;
    let cropH: number;
    if (srcRatio > desired) {
      cropH = srcH;
      cropW = srcH * desired;
    } else {
      cropW = srcW;
      cropH = srcW / desired;
    }
    const sx = (srcW - cropW) / 2;
    const sy = (srcH - cropH) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, targetW, targetH);

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (!b) return reject(new Error("Failed to crop image"));
          resolve(b);
        },
        "image/webp",
        0.92
      );
    });

    const croppedFile = new File([blob], `cropped-${file.name.replace(/\.[^.]+$/, "")}.webp`, {
      type: "image/webp",
      lastModified: Date.now(),
    });

    const croppedUrl = URL.createObjectURL(blob);
    return { file: croppedFile, previewUrl: croppedUrl };
  }

  async function uploadCoverIfNeeded(): Promise<{ url: string | null; thumb: string | null }> {
    if (!coverFile) return { url: coverUrl, thumb: coverThumb };
    if (isUploading) {
      while (isUploading) {
        // wait for concurrent upload to finish
        await new Promise((r) => setTimeout(r, 100));
        if (coverUrl || coverThumb) return { url: coverUrl, thumb: coverThumb };
      }
    }

    try {
      setIsUploading(true);
      const form = new FormData();
      form.append("file", coverFile as File);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || "Upload failed");
      const url = data?.url ?? null;
      const thumb = data?.thumb ?? null;
      setCoverUrl(url);
      setCoverThumb(thumb);
      // immediate save after upload
      triggerImmediateSave();
      return { url, thumb };
    } finally {
      setIsUploading(false);
    }
  }

  function makeSlug(titleStr: string) {
    return titleStr
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  async function handleCreateOrSave(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setMessage(null);
    if (!title.trim()) return setError("Please add a title.");
    if (!body.trim()) return setError("Please add body content.");

    setLoading(true);
    try {
      let uploadedCoverUrl = coverUrl;
      let uploadedCoverThumb = coverThumb;
      if (coverFile && !uploadedCoverUrl) {
        const { url, thumb } = await uploadCoverIfNeeded();
        uploadedCoverUrl = url;
        uploadedCoverThumb = thumb;
        setCoverUrl(url);
        setCoverThumb(thumb);
      }

      const slug = makeSlug(title) || `post-${Date.now()}`;

      // build tags array from comma-separated input
      const tagList = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const tagsYaml =
        tagList.length === 0
          ? "tags: []"
          : `tags:\n${tagList
              .map((t) => `  - "${t.replace(/"/g, '\\"')}"`)
              .join("\n")}`;
      const frontmatter = [
        `title: "${title.replace(/"/g, '\\"')}"`,
        `author: "${author.replace(/"/g, '\\"')}"`,
        `date: "${date}"`,
        `excerpt: "${excerpt.replace(/"/g, '\\"')}"`,
        tagsYaml,
        `cover: "${uploadedCoverUrl ?? ""}"`,
        `coverThumb: "${uploadedCoverThumb ?? ""}"`,
      ].join("\n");

      if (editingSlug) {
        const res = await fetch(`/api/posts/${editingSlug}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newSlug: slug, frontmatter, body }),
        });
        if (!res.ok) throw new Error("Update failed");
        setMessage("Post updated.");
      } else {
        const res = await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, frontmatter, body }),
        });
        if (!res.ok) throw new Error("Create failed");
        setMessage("Post created.");
      }

      if (draftId) {
        await fetch(`/api/drafts/${draftId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ author_email: session?.user?.email ?? null }),
        }).catch(() => null);
        setDraftId(null);
      }

      await fetchList();
      resetForm();
      setEditingSlug(null);
    } catch (err: any) {
      setError(err?.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setTitle("");
    setDate(new Date().toISOString().slice(0, 10));
    setExcerpt("");
    setAuthor("");
    setBody("");
    setTagsInput("");
    setCoverFile(null);
    setCoverPreview(null);
    setCoverUrl(null);
    setCoverThumb(null);
    setEditingSlug(null);
    setDraftId(null);
    if (fileRef.current) fileRef.current.value = "";
    setMessage(null);
    setError(null);
    lastSnapshotRef.current = JSON.stringify(currentDraftPayload());
  }

  // edit / delete post
  async function handleEdit(slug: string) {
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/posts/${slug}`);
      if (!res.ok) throw new Error("Failed to load post");
      const data = await res.json();
      const fm = data.frontmatter || {};
      setTitle(fm.title || "");
      setDate(fm.date ? String(fm.date).slice(0, 10) : new Date().toISOString().slice(0, 10));
      setExcerpt(fm.excerpt || "");
      setAuthor(fm.author || "");
      setBody(data.body || "");
      const fmTags = Array.isArray(fm.tags) ? fm.tags : [];
      setTagsInput(fmTags.join(", "));
      setCoverUrl(fm.cover || null);
      setCoverThumb(fm.coverThumb || null);
      setCoverPreview(null);
      setEditingSlug(slug);
      lastSnapshotRef.current = JSON.stringify(currentDraftPayload());
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      setError(e?.message || "Could not load post");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(slug: string) {
    const ok = confirm(`Delete post "${slug}"? This cannot be undone.`);
    if (!ok) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${slug}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setMessage("Post deleted.");
      await fetchList();
      if (editingSlug === slug) resetForm();
    } catch (e: any) {
      setError(e?.message || "Delete error");
    } finally {
      setLoading(false);
    }
  }

  // editor image upload, insert helpers
  async function uploadImageFileToServer(file: File): Promise<string> {
    if (file.size > 15 * 1024 * 1024) throw new Error("File too large (max 15MB)");
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data?.error || "Upload failed");
    return data.url;
  }

  function insertAtCaret(text: string) {
    const wrapper = editorWrapperRef.current;
    if (!wrapper) {
      setBody((prev) => prev + "\n\n" + text);
      triggerImmediateSave();
      return;
    }
    const ta = wrapper.querySelector("textarea") as HTMLTextAreaElement | null;
    if (!ta) {
      setBody((prev) => prev + "\n\n" + text);
      triggerImmediateSave();
      return;
    }
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    const before = body.slice(0, start);
    const after = body.slice(end);
    const next = before + text + after;
    setBody(next);
    requestAnimationFrame(() => {
      ta.focus();
      const newPos = start + text.length;
      ta.setSelectionRange(newPos, newPos);
    });
    triggerImmediateSave();
  }

  async function handleEditorDrop(e: React.DragEvent) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;
    setMessage("Uploading image...");
    try {
      for (const file of files) {
        const url = await uploadImageFileToServer(file);
        insertAtCaret(`![${file.name}](${url})`);
      }
      setMessage("Image(s) uploaded and inserted.");
      triggerImmediateSave();
    } catch (err: any) {
      setError(err?.message || "Upload failed");
    }
  }
  function handleEditorDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  async function handleInsertImageViaPicker() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      setMessage("Uploading image...");
      try {
        const url = await uploadImageFileToServer(f);
        insertAtCaret(`![${f.name}](${url})`);
        setMessage("Image uploaded and inserted.");
        triggerImmediateSave();
      } catch (err: any) {
        setError(err?.message || "Upload failed");
      }
    };
    input.click();
  }

  function onEmojiClick(event: any, emojiObject: any) {
    const symbol = emojiObject?.emoji || emojiObject?.unified || "";
    if (!symbol) return;
    insertAtCaret(symbol);
    setEmojiOpen(false);
    triggerImmediateSave();
  }

  // -------------------------
  // AUTOSAVE (robust)
  // -------------------------
  function currentDraftPayload() {
    // SEND snake_case fields to the server to match the DB column names
    return {
      title: title ?? "",
      date: date ?? new Date().toISOString().slice(0, 10),
      excerpt: excerpt ?? "",
      body: body ?? "",
      cover_url: coverUrl ?? null,
      cover_thumb: coverThumb ?? null,
      author_email: session?.user?.email ?? null,
    };
  }

  // load latest draft (only if form empty)
  async function loadLatestDraftIfEmpty() {
    try {
      const bodyEmpty = !body || body.trim().length === 0;
      const titleEmpty = !title || title.trim().length === 0;
      if (!bodyEmpty || !titleEmpty) return; // don't overwrite user's live content

      const qsAuthor = session?.user?.email
        ? `&author=${encodeURIComponent(session.user.email)}`
        : "";
      const res = await fetch(`/api/drafts?latest=1${qsAuthor}`);
      if (!res.ok) {
        console.warn("loadLatestDraftIfEmpty failed", await res.text());
        return;
      }
      const json = await res.json();
      const d = json?.draft ?? null;
      if (!d) return;
      // populate form fields (coerce values to strings)
      setTitle(d.title ?? "");
      setDate(d.date ?? new Date().toISOString().slice(0, 10));
      setExcerpt(d.excerpt ?? "");
      setBody(d.body ?? "");
      setCoverUrl(d.cover_url ?? null);
      setCoverThumb(d.cover_thumb ?? null);
      setDraftId(d.id ?? null);

      // critical: update snapshot so autosave knows the current state
      lastSnapshotRef.current = JSON.stringify({
        title: d.title ?? "",
        date: d.date ?? new Date().toISOString().slice(0, 10),
        excerpt: d.excerpt ?? "",
        body: d.body ?? "",
        cover_url: d.cover_url ?? null,
        cover_thumb: d.cover_thumb ?? null,
        author_email: session?.user?.email ?? null,
      });
      setMessage("Loaded latest draft");
      console.log("Loaded latest draft", d.id);
    } catch (err) {
      console.warn("loadLatestDraftIfEmpty error", err);
    }
  }

  // create a draft on server
  async function createDraftOnServer(payload: any) {
    try {
      const clientPayload = {
        title: String(payload.title ?? ""),
        date: String(payload.date ?? new Date().toISOString().slice(0, 10)),
        excerpt: String(payload.excerpt ?? ""),
        body: String(payload.body ?? ""),
        cover_url: payload.cover_url ?? null,
        cover_thumb: payload.cover_thumb ?? null,
        author_email: session?.user?.email ?? null,
      };

      console.log("[autosave] createDraftOnServer payload:", clientPayload);

      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clientPayload),
      });
      const json = await res.json();
      console.log("[autosave] createDraftOnServer response:", res.status, json);
      if (!res.ok) {
        console.error("createDraftOnServer error", json);
        setMessage(json?.error || "Failed to create draft");
        return null;
      }
      setMessage("Draft created");
      lastSnapshotRef.current = JSON.stringify(clientPayload);
      // json.draft should contain id and fields
      return json.draft ?? null;
    } catch (err: any) {
      console.error("createDraftOnServer fetch error", err);
      setMessage("Network error while creating draft");
      return null;
    }
  }

  // update a draft on server
  async function updateDraftOnServer(id: string, payload: any) {
    try {
      const clientPayload = {
        title: String(payload.title ?? ""),
        date: String(payload.date ?? new Date().toISOString().slice(0, 10)),
        excerpt: String(payload.excerpt ?? ""),
        body: String(payload.body ?? ""),
        cover_url: payload.cover_url ?? null,
        cover_thumb: payload.cover_thumb ?? null,
        author_email: session?.user?.email ?? null,
      };

      console.log("[autosave] updateDraftOnServer id=", id, "payload:", clientPayload);

      const res = await fetch(`/api/drafts/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clientPayload),
      });
      const json = await res.json();
      console.log("[autosave] updateDraftOnServer response:", res.status, json);
      if (!res.ok) {
        console.error("updateDraftOnServer error", json);
        setMessage(json?.error || "Failed to update draft");
        return null;
      }
      setMessage("Draft saved");
      lastSnapshotRef.current = JSON.stringify(clientPayload);
      return json.draft ?? null;
    } catch (err: any) {
      console.error("updateDraftOnServer fetch error", err);
      setMessage("Network error while updating draft");
      return null;
    }
  }

  function triggerImmediateSave() {
    // empty the lastSnapshot so next autosave tick will see a difference
    lastSnapshotRef.current = "";
  }

  // Start autosave only after session is available (we need author_email)
  useEffect(() => {
    if (!session) return;

    // ensure we load latest server draft only once on mount/when session arrives
    loadLatestDraftIfEmpty();

    // seed snapshot with current state
    lastSnapshotRef.current = JSON.stringify(currentDraftPayload());

    // every 5000ms check and save if necessary
    autosaveIntervalRef.current = window.setInterval(async () => {
      try {
        const snapshot = JSON.stringify(currentDraftPayload());
        if (snapshot === lastSnapshotRef.current) return; // nothing changed

        // immediate update of lastSnapshot to avoid concurrent saves
        lastSnapshotRef.current = snapshot;
        const payload = currentDraftPayload();

        if (!draftId) {
          const created = await createDraftOnServer(payload);
          if (created?.id) {
            setDraftId(created.id as string);
            console.log("Autosave created draft id", created.id);
          } else {
            console.warn("Autosave create returned no id", created);
          }
        } else {
          await updateDraftOnServer(draftId, payload);
        }
      } catch (err) {
        console.error("autosave interval error", err);
      }
    }, 5000) as unknown as number;

    // flush on unload (best-effort)
    const onBeforeUnload = () => {
      try {
        const payload = JSON.stringify(currentDraftPayload());
        // if it changed since last snapshot, attempt to send via sendBeacon
        if (payload !== lastSnapshotRef.current) {
          const url = draftId ? `/api/drafts/${encodeURIComponent(draftId)}` : "/api/drafts";
          const bodyBlob = new Blob([payload], { type: "application/json" });
          navigator.sendBeacon(url, bodyBlob);
        }
      } catch (e) {
      
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      if (autosaveIntervalRef.current) window.clearInterval(autosaveIntervalRef.current);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
    
  }, [session, draftId]); // restart autosave if session or draftId changes

  // -------------------------
  // Render
  // -------------------------
  const isAdmin = !!session?.user?.email; // server-side check done in getServerSideProps
  return (
    <Layout>
      <Head>
        <title>Admin — Aurora 2.0</title>
      </Head>

      <main className="container mx-auto max-w-6xl px-3 md:px-4 py-6 md:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
          {/* form / editor column */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl md:rounded-2xl shadow-md p-4 md:p-8">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold mb-4">{editingSlug ? "Edit Post" : "Create Post"}</h1>
                  {session?.user?.email && (
                    <div className="text-sm text-slate-400 mb-2">
                      Signed in as <span className="font-medium text-slate-700">{session.user.email}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="px-3 py-1 rounded-md bg-red-50 text-red-600 text-sm hover:bg-red-100"
                  >
                    Sign out
                  </button>
                </div>
              </div>

              {error && <div className="text-red-600 bg-red-50 p-3 rounded mb-4">{error}</div>}
              {message && <div className="text-emerald-700 bg-emerald-50 p-3 rounded mb-4">{message}</div>}

              <form onSubmit={handleCreateOrSave} className="space-y-5">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Title</label>
                  <input
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      triggerImmediateSave();
                    }}
                    placeholder="Title"
                    className="w-full border rounded-md px-3 py-3 text-sm"
                  />
                </div>

                {/* Date + Excerpt + Author */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Date</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => {
                        setDate(e.target.value);
                        triggerImmediateSave();
                      }}
                      className="w-full border rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Excerpt</label>
                    <input
                      value={excerpt}
                      onChange={(e) => {
                        setExcerpt(e.target.value);
                        triggerImmediateSave();
                      }}
                      placeholder="Short summary"
                      className="w-full border rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Author</label>
                    <input
                      value={author}
                      onChange={(e) => {
                        setAuthor(e.target.value);
                        triggerImmediateSave();
                      }}
                      placeholder="e.g. Jane Doe"
                      className="w-full border rounded-md px-3 py-2 text-sm italic"
                    />
                    <p className="mt-1 text-xs text-slate-400 italic">Appears below the title in small italics.</p>
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Tags</label>
                  <input
                    value={tagsInput}
                    onChange={(e) => {
                      setTagsInput(e.target.value);
                      triggerImmediateSave();
                    }}
                    placeholder="e.g. nature, sunrise, campus"
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Comma-separated, e.g. <span className="italic">nature, landscape, workshop</span>
                  </p>
                </div>

                {/* Cover image */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Cover Image</label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
                    <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} className="text-xs sm:text-sm" />
                    <button
                      type="button"
                      onClick={async () => {
                        setError(null);
                        setMessage(null);
                        if (!coverFile) {
                          fileRef.current?.click();
                          return;
                        }
                        try {
                          setLoading(true);
                          const { url, thumb } = await uploadCoverIfNeeded();
                          if (url) setCoverUrl(url);
                          if (thumb) setCoverThumb(thumb);
                          setMessage("Image uploaded.");
                        } catch (e: any) {
                          setError(e?.message || "Upload failed");
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className="btn btn-primary"
                    >
                      {coverUrl ? "Re-upload" : "Upload"}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!coverFile) {
                          setError("Pick an image first, then crop.");
                          return;
                        }
                        setIsCropping(true);
                        setError(null);
                        setMessage("Cropping to 3:2…");
                        try {
                          const { file, previewUrl } = await cropImageToBlogAspect(coverFile);
                          if (coverPreview) URL.revokeObjectURL(coverPreview);
                          setCoverFile(file);
                          setCoverPreview(previewUrl);
                          setCoverUrl(null);
                          setCoverThumb(null);
                          setMessage("Cropped to 3:2 (webp) ready to upload.");
                          triggerImmediateSave();
                        } catch (e: any) {
                          setError(e?.message || "Crop failed");
                        } finally {
                          setIsCropping(false);
                        }
                      }}
                      className="px-3 py-2 rounded-md border text-sm hover:bg-slate-50 disabled:opacity-50"
                      disabled={isCropping || !coverFile}
                    >
                      {isCropping ? "Cropping…" : "Crop to 3:2"}
                    </button>
                  </div>

                  {coverPreview && (
                    <div className="mt-3 flex items-center gap-3">
                      <img src={coverPreview} className="w-36 h-24 object-cover rounded-md border" alt="Preview" />
                      <div className="text-sm text-slate-500">
                        <div>{coverFile?.name}</div>
                        <div className="mt-1 text-xs">Size: {coverFile ? Math.round(coverFile.size / 1024) + " KB" : ""}</div>
                      </div>
                    </div>
                  )}

                  {coverUrl && (
                    <div className="mt-3 space-y-2">
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Uploaded (optimized):</div>
                        <img src={coverUrl} className="w-72 h-auto object-cover rounded-md border" alt="Uploaded optimized" />
                      </div>
                      {coverThumb && (
                        <div>
                          <div className="text-xs text-slate-400 mb-1">Uploaded (thumbnail):</div>
                          <img src={coverThumb} className="w-48 h-auto object-cover rounded-md border" alt="Uploaded thumb" />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Editor */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Markdown body</label>
                  <div ref={editorWrapperRef} onDrop={handleEditorDrop} onDragOver={handleEditorDragOver} className="rounded-md border p-2">
                    <div className="flex items-center gap-2 mb-2">
                      <button type="button" onClick={() => setEmojiOpen((s) => !s)} className="px-3 py-1 border rounded text-sm">
                        😊 Emoji
                      </button>
                      <button type="button" onClick={handleInsertImageViaPicker} className="px-3 py-1 border rounded text-sm">
                        🖼 Insert image
                      </button>
                      <div className="text-xs text-slate-400 ml-auto">Drag & drop images into the editor to upload</div>
                    </div>

                    {emojiOpen && (
                      <div style={{ position: "relative" }}>
                        {/* @ts-ignore */}
                        <EmojiPicker onEmojiClick={onEmojiClick as any} />
                      </div>
                    )}

                    <MDEditor
                      value={body}
                      onChange={(v: string | undefined) => {
                        const next = String(v ?? "");
                        setBody(next);
                        triggerImmediateSave();
                      }}
                      height={360}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button type="submit" disabled={loading} className="btn btn-primary">
                    {loading ? "Saving…" : editingSlug ? "Save changes" : "Create Post"}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="btn btn-ghost"
                  >
                    Reset
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right column (posts / drafts / help) */}
          <aside className="space-y-4">
            <div className="card p-4">
              <h3 className="font-semibold mb-3">Posts</h3>
              {loadingList ? (
                <div>Loading…</div>
              ) : (
                <>
                  <div className="space-y-3">
                    {posts.length === 0 && <div className="text-sm text-slate-500">No posts yet</div>}
                    {posts.map((p) => (
                      <div key={p.slug} className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">{p.title}</div>
                          <div className="text-xs text-slate-400">{p.date}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(p.slug)}
                            className="text-sm px-3 py-1 rounded-md border hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setPreviewSlug(p.slug)}
                            className="text-sm px-3 py-1 rounded-md border hover:bg-slate-50"
                          >
                            Preview
                          </button>
                          <button
                            onClick={() => handleDelete(p.slug)}
                            className="text-sm px-3 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {previewSlug && (
                    <div className="mt-4 border-t pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-sm">Preview</h4>
                        <div className="flex items-center gap-2 text-xs">
                          <a
                            href={`/posts/${previewSlug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[color:var(--brand)] hover:underline"
                          >
                            Open full page
                          </a>
                          <button
                            type="button"
                            onClick={() => setPreviewSlug(null)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                      <div className="rounded-lg overflow-hidden border bg-slate-50">
                        <iframe
                          key={previewSlug}
                          src={`/posts/${previewSlug}`}
                          className="w-full h-[420px] border-0"
                          title="Post preview"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="card p-4">
              <h4 className="font-semibold">Drafts</h4>
              <DraftsPanel
                onLoadDraft={(id: string) => {
                  (async function () {
                    try {
                      setError(null);
                      setMessage("Loading draft...");
                      const res = await fetch(`/api/drafts/${id}`);
                      if (!res.ok) {
                        const errorData = await res.json().catch(() => ({}));
                        throw new Error(errorData?.error || `HTTP ${res.status}: Failed to load draft`);
                      }
                      const data = await res.json();
                      if (!data?.ok) {
                        throw new Error(data?.error || "API returned error");
                      }
                      const d = data?.draft;
                      if (!d) {
                        throw new Error("Draft not found");
                      }
                      console.log("Loading draft:", { id: d.id, title: d.title, bodyLength: d.body?.length ?? 0, bodyPreview: d.body?.substring(0, 50) });
                      setTitle(d.title ?? "");
                      setDate(d.date ?? new Date().toISOString().slice(0, 10));
                      setExcerpt(d.excerpt ?? "");
                      setBody(d.body ?? "");
                      setCoverUrl(d.cover_url ?? null);
                      setCoverThumb(d.cover_thumb ?? null);
                      setDraftId(d.id ?? null);
                      lastSnapshotRef.current = JSON.stringify({
                        title: d.title ?? "",
                        date: d.date ?? "",
                        excerpt: d.excerpt ?? "",
                        body: d.body ?? "",
                        cover_url: d.cover_url ?? null,
                        cover_thumb: d.cover_thumb ?? null,
                        author_email: session?.user?.email ?? null,
                      });
                      setMessage("Draft loaded successfully");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    } catch (err: any) {
                      console.error("Error loading draft:", err);
                      setError(err?.message || "Could not load draft");
                      setMessage(null);
                    }
                  })();
                }}
                onDraftsChanged={() => {}}
                isAdmin={isAdmin}
                authorEmail={session?.user?.email ?? null}
              />
            </div>

            <div className="card p-4">
              <h4 className="font-semibold">Help</h4>
              <p className="text-sm text-slate-500">Drafts autosave to the server every ~5s. Images are uploaded to Supabase via your /api/upload route.</p>
            </div>
          </aside>
        </div>
      </main>
    </Layout>
  );


  function AutosaveDebug(): JSX.Element {
    const [now, setNow] = useState(0);
    useEffect(() => {
      const t = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(t);
    }, []);
    return (
      <div style={{ position: "fixed", right: 10, bottom: 10, zIndex: 9999, width: 340 }}>
        <div className="bg-white p-3 rounded shadow text-xs">
          <div className="font-semibold mb-2">Autosave debug</div>
          <div><strong>draftId:</strong> {String(draftId ?? "(none)")}</div>
          <div><strong>lastSnapshot:</strong> {lastSnapshotRef.current ? `${lastSnapshotRef.current.slice(0,120)}${lastSnapshotRef.current.length>120?"…":""}` : "(empty)"}</div>
          <div style={{ marginTop: 6 }}>
            <strong>payload</strong>
            <pre style={{ whiteSpace: "pre-wrap", maxHeight: 140, overflow: "auto", fontSize: 12 }}>
              {JSON.stringify(currentDraftPayload(), null, 2)}
            </pre>
          </div>
          <div className="flex gap-2 mt-2">
            <button className="px-2 py-1 border rounded text-xs" onClick={() => { triggerImmediateSave(); }}>Force save</button>
            <button className="px-2 py-1 border rounded text-xs" onClick={() => { console.log("[debug] snapshot", lastSnapshotRef.current, "payload", currentDraftPayload()); }}>Log snapshot</button>
          </div>
          <div className="mt-2 text-gray-500 text-[11px]">tick: {new Date(now).toLocaleTimeString()}</div>
        </div>
      </div>
    );
  }
}
