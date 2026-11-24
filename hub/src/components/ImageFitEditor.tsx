"use client";

import { useEffect, useState } from "react";

type Props = {
  file: File;
  aspect: number;
  title: string;
  circular?: boolean;
  outputWidth?: number;
  onCancel: () => void;
  onConfirm: (file: File) => void;
};

export function ImageFitEditor({
  file,
  aspect,
  title,
  circular = false,
  outputWidth = 1600,
  onCancel,
  onConfirm,
}: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState({ w: 1, h: 1 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [frameSize, setFrameSize] = useState({ w: 320, h: 128 });
  const [dragging, setDragging] = useState<{
    x: number;
    y: number;
    ox: number;
    oy: number;
  } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    const img = new window.Image();
    img.onload = () => {
      setNatural({
        w: img.naturalWidth || 1,
        h: img.naturalHeight || 1,
      });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function coverScale(frameW: number, frameH: number, z: number) {
    return Math.max(frameW / natural.w, frameH / natural.h) * z;
  }

  const scale = coverScale(frameSize.w, frameSize.h, zoom);
  const drawnW = natural.w * scale;
  const drawnH = natural.h * scale;
  const imgLeft = (frameSize.w - drawnW) / 2 + offset.x;
  const imgTop = (frameSize.h - drawnH) / 2 + offset.y;

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging({
      x: e.clientX,
      y: e.clientY,
      ox: offset.x,
      oy: offset.y,
    });
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    setOffset({
      x: dragging.ox + (e.clientX - dragging.x),
      y: dragging.oy + (e.clientY - dragging.y),
    });
  }

  function onPointerUp() {
    setDragging(null);
  }

  async function confirm() {
    if (!src) return;
    setBusy(true);
    try {
      const outW = outputWidth;
      const outH = Math.max(1, Math.round(outW / aspect));
      const exportScale = coverScale(outW, outH, zoom);
      const dw = natural.w * exportScale;
      const dh = natural.h * exportScale;
      const ratio = frameSize.w > 0 ? outW / frameSize.w : 1;
      const dx = (outW - dw) / 2 + offset.x * ratio;
      const dy = (outH - dh) / 2 + offset.y * ratio;

      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");

      const bitmap = await createImageBitmap(file);
      ctx.fillStyle = "#1f1c18";
      ctx.fillRect(0, 0, outW, outH);
      if (circular) {
        ctx.beginPath();
        ctx.arc(outW / 2, outH / 2, outW / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
      }
      ctx.drawImage(bitmap, dx, dy, dw, dh);
      bitmap.close();

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.9),
      );
      if (!blob) throw new Error("Could not export image");
      const base = file.name.replace(/\.[^.]+$/, "") || "photo";
      onConfirm(new File([blob], `${base}-fit.jpg`, { type: "image/jpeg" }));
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-[var(--rule)] bg-[rgba(255,252,245,0.98)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--rule)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--charcoal)]">{title}</h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-[var(--ink-soft)] hover:underline"
          >
            Cancel
          </button>
        </div>

        <div className="space-y-3 p-4">
          <p className="text-xs text-[var(--ink-soft)]">
            Drag to move. Use Size to zoom so the picture fits how you want.
          </p>

          <div
            ref={(el) => {
              if (!el) return;
              const w = el.clientWidth || 320;
              const h = Math.round(w / aspect);
              if (Math.abs(w - frameSize.w) > 1 || Math.abs(h - frameSize.h) > 1) {
                setFrameSize({ w, h });
              }
            }}
            className={`relative mx-auto w-full touch-none overflow-hidden bg-[var(--charcoal)] ${
              circular ? "rounded-full" : "rounded-lg"
            }`}
            style={{ aspectRatio: `${aspect}` }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none select-none"
                style={{
                  width: drawnW,
                  height: drawnH,
                  left: imgLeft,
                  top: imgTop,
                }}
              />
            ) : null}
          </div>

          <label className="block text-sm text-[var(--ink-soft)]">
            <span className="mb-1 flex justify-between">
              <span>Size</span>
              <span>{Math.round(zoom * 100)}%</span>
            </span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-[var(--olive-deep)]"
            />
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-lg border border-[var(--rule)] px-3 py-2.5 text-sm font-semibold text-[var(--charcoal)]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || !src}
              onClick={() => void confirm()}
              className="flex-1 rounded-lg bg-[var(--olive-deep)] px-3 py-2.5 text-sm font-semibold text-[var(--parchment)] disabled:opacity-50"
            >
              {busy ? "Saving…" : "Use this crop"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
