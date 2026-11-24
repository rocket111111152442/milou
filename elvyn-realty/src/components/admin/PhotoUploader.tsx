"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_SIDE = 1600;

/** Resizes each photo in the browser (max 1600 px, JPEG) before sending it. */
async function resize(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.82));
}

export function PhotoUploader({ listingId }: { listingId: number }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    let ok = 0;
    const failed: string[] = [];
    for (const [i, f] of [...files].entries()) {
      setStatus(`Subiendo ${i + 1} de ${files.length}…`);
      try {
        const blob = await resize(f);
        const res = await fetch(`/api/admin/listings/${listingId}/images`, { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob });
        if (!res.ok) throw new Error(String(res.status));
        ok++;
      } catch {
        failed.push(f.name);
      }
    }
    setBusy(false);
    setStatus(`${ok} foto(s) añadida(s).${failed.length ? ` No se pudieron subir: ${failed.join(", ")}.` : ""}`);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <label className="btn-outline inline-flex cursor-pointer">
        {busy ? "Subiendo…" : "Añadir fotos"}
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple className="sr-only" disabled={busy} onChange={(e) => upload(e.target.files)} />
      </label>
      <p className="text-xs text-ink-soft">Puedes elegir varias a la vez. Se reducen automáticamente antes de subirlas. La primera es la portada.</p>
      {status && <p role="status" className="text-sm">{status}</p>}
    </div>
  );
}
