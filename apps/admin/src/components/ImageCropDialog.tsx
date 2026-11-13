import { useEffect, useRef, useState } from 'react';
import { Crop, Loader2, RotateCcw } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Field } from './ui/Form';
import type { MediaPreset } from '../lib/mediaPresets';
import { formatDimensions } from '../lib/mediaPresets';

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Simple, dependency-free crop/adjust tool. The crop becomes a NEW uploaded
 * file, so no database or storage changes are required.
 */
export function ImageCropDialog({
  open,
  src,
  preset,
  onClose,
  onCropped,
}: {
  open: boolean;
  src: string;
  preset: MediaPreset;
  onClose: () => void;
  onCropped: (blob: Blob, filename: string) => Promise<void> | void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [focusX, setFocusX] = useState(50);
  const [focusY, setFocusY] = useState(50);

  // Load the image whenever the dialog opens.
  useEffect(() => {
    if (!open || !src) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setZoom(1);
    setFocusX(50);
    setFocusY(50);

    const image = new Image();
    try {
      const resolved = new URL(src, window.location.href);
      if (resolved.origin !== window.location.origin) image.crossOrigin = 'anonymous';
    } catch {
      /* opaque or relative URL — leave crossOrigin unset */
    }
    image.onload = () => {
      if (cancelled) return;
      imageRef.current = image;
      setLoading(false);
    };
    image.onerror = () => {
      if (cancelled) return;
      imageRef.current = null;
      setError('Could not load this image for cropping. Download it and upload the file directly, then try again.');
      setLoading(false);
    };
    image.src = src;

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [open, src]);

  // Redraw the cropped preview whenever the focal point or zoom changes.
  useEffect(() => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!open || !image || !canvas || !image.naturalWidth || !image.naturalHeight) return;

    const targetWidth = preset.image?.width;
    const targetHeight = preset.image?.height;
    const targetAspect =
      targetWidth && targetHeight ? targetWidth / targetHeight : image.naturalWidth / image.naturalHeight;

    let baseWidth: number;
    let baseHeight: number;
    if (image.naturalWidth / image.naturalHeight > targetAspect) {
      baseHeight = image.naturalHeight;
      baseWidth = baseHeight * targetAspect;
    } else {
      baseWidth = image.naturalWidth;
      baseHeight = baseWidth / targetAspect;
    }

    const cropWidth = Math.max(1, baseWidth / zoom);
    const cropHeight = Math.max(1, baseHeight / zoom);
    const cropX = Math.max(0, (image.naturalWidth - cropWidth) * (focusX / 100));
    const cropY = Math.max(0, (image.naturalHeight - cropHeight) * (focusY / 100));

    const outWidth = Math.max(1, Math.round(Math.min(targetWidth ?? cropWidth, cropWidth)));
    const outHeight = Math.max(1, Math.round(outWidth / targetAspect));

    canvas.width = outWidth;
    canvas.height = outHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.clearRect(0, 0, outWidth, outHeight);
    context.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, outWidth, outHeight);
  }, [open, zoom, focusX, focusY, preset, loading]);

  async function handleApply() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setWorking(true);
    setError(null);
    try {
      let blob = await canvasToBlob(canvas, 'image/webp', 0.92);
      let extension = 'webp';
      if (!blob) {
        blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
        extension = 'jpg';
      }
      if (!blob) throw new Error('The browser could not export the cropped image.');
      await onCropped(blob, `cropped-${Date.now()}.${extension}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not export the crop. If the image is hosted on another domain, download it and upload the file directly.',
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!working) onClose();
      }}
      title="Crop / adjust image"
      size="xl"
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose} disabled={working}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void handleApply()}
            disabled={working || loading || !imageRef.current}
          >
            {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crop className="h-4 w-4" />}
            {working ? 'Uploading crop…' : 'Use cropped image'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Drag the sliders to choose the visible area. The result is uploaded as a new file at roughly{' '}
          <span className="font-semibold text-slate-800">{formatDimensions(preset.image)}</span>.
        </p>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        ) : null}

        <div className="flex min-h-[220px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-2">
          {loading ? (
            <span className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading image…
            </span>
          ) : (
            <canvas ref={canvasRef} className="max-h-[45vh] w-auto max-w-full rounded-lg shadow-sm" />
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={`Zoom · ${zoom.toFixed(2)}×`}>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="w-full accent-brand-700"
            />
          </Field>
          <Field label={`Horizontal focus · ${focusX}%`}>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={focusX}
              onChange={(event) => setFocusX(Number(event.target.value))}
              className="w-full accent-brand-700"
            />
          </Field>
          <Field label={`Vertical focus · ${focusY}%`}>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={focusY}
              onChange={(event) => setFocusY(Number(event.target.value))}
              className="w-full accent-brand-700"
            />
          </Field>
        </div>

        <button
          type="button"
          className="btn-ghost !px-0 text-xs"
          onClick={() => {
            setZoom(1);
            setFocusX(50);
            setFocusY(50);
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset crop
        </button>
      </div>
    </Modal>
  );
}
