// src/components/DraftsPanel.tsx
import React, { useEffect, useState } from "react";

type DraftRow = {
  id: string;
  title?: string | null;
  updated_at?: string | null;
};

export default function DraftsPanel({
  onLoadDraft,
  onDraftsChanged,
  isAdmin,
  authorEmail,
}: {
  onLoadDraft: (id: string) => void;
  onDraftsChanged?: () => void;
  isAdmin?: boolean;
  authorEmail?: string | null;
}) {
  const [drafts, setDrafts] = useState<DraftRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContext, setModalContext] = useState<{ type: "single" | "clear"; id?: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params = authorEmail ? `?author=${encodeURIComponent(authorEmail)}` : "";
      const res = await fetch(`/api/drafts${params}`);
      const data = await res.json();
      setDrafts(data?.drafts ?? []);
    } catch (e) {
      console.error(e);
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [authorEmail]);

  function openConfirmSingle(id?: string) {
    setModalContext({ type: "single", id });
    setModalOpen(true);
  }
  function openConfirmClear() {
    setModalContext({ type: "clear" });
    setModalOpen(true);
  }

  async function handleModalConfirm() {
    if (!modalContext) return;
    setBusy(true);
    setError(null);
    try {
      if (modalContext.type === "single") {
        if (!modalContext.id) throw new Error("Missing id");
        const res = await fetch(`/api/drafts/${modalContext.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete draft");
      } else {
        // delete all drafts route
        const res = await fetch("/api/drafts/clear", { method: "DELETE" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || "Failed to delete all drafts");
        }
      }
      await load();
      if (onDraftsChanged) onDraftsChanged();
      setModalOpen(false);
      setModalContext(null);
    } catch (err: any) {
      setError(err?.message || "Operation failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div>Loading drafts…</div>;
  if (!drafts || drafts.length === 0) return <div className="text-sm text-slate-500">No drafts</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="font-medium">Saved Drafts</div>
        {isAdmin && (
          <button onClick={openConfirmClear} className="text-xs px-2 py-1 rounded bg-red-50 text-red-600">Delete all</button>
        )}
      </div>

      <div className="space-y-2">
        {drafts.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-2">
            <div className="flex-1">
              <div className="font-medium text-sm">{d.title || "(untitled)"}</div>
              <div className="text-xs text-slate-400">{d.updated_at ? new Date(d.updated_at).toLocaleString() : ""}</div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => onLoadDraft(d.id)} className="text-xs px-2 py-1 border rounded">Load</button>
              <button onClick={() => openConfirmSingle(d.id)} className="text-xs px-2 py-1 rounded bg-red-50 text-red-600">Del</button>
            </div>
          </div>
        ))}
      </div>

      {/* modal */}
      {modalOpen && modalContext && (
        <Modal onClose={() => { if (!busy) { setModalOpen(false); setModalContext(null); } }}>
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-2">{modalContext.type === "clear" ? "Delete all drafts?" : "Delete draft?"}</h3>
            <p className="text-sm text-slate-600 mb-4">
              {modalContext.type === "clear" ? "This will permanently delete all drafts for this site. This action cannot be undone." : "This will permanently delete the draft. This action cannot be undone."}
            </p>

            {error && <div className="text-red-600 bg-red-50 p-2 rounded mb-2">{error}</div>}

            <div className="flex items-center gap-3 justify-end">
              <button onClick={() => { setModalOpen(false); setModalContext(null); }} className="px-3 py-1 rounded border">Cancel</button>
              <button disabled={busy} onClick={handleModalConfirm} className="px-3 py-1 rounded bg-red-600 text-white">{busy ? "Deleting…" : (modalContext.type === "clear" ? "Delete all" : "Delete")}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Simple modal overlay — inline component for convenience */
function Modal({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div style={{ zIndex: 60 }} className="fixed inset-0 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-md shadow-lg w-[95%] max-w-lg">
        {children}
      </div>
    </div>
  );
}
