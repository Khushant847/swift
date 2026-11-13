import { useEffect, useMemo, useRef, useState } from 'react';
import { Crop, ImageIcon, Loader2, Play, Trash2, Upload, Video } from 'lucide-react';
import { api, ApiError, mediaSrc } from '../lib/api';
import { useToast } from './ui/Toast';
import { cn } from '../lib/utils';
import { MediaCheckPanel, MediaGuidance } from './MediaGuidance';
import { MediaPreview } from './MediaPreview';
import { ImageCropDialog } from './ImageCropDialog';
import {
  acceptForPreset,
  detectFileMetadata,
  detectUrlMetadata,
  mediaKindFromFile,
  mediaKindFromUrl,
  MEDIA_PRESETS,
  specForKind,
  validateMedia,
  type MediaKind,
  type MediaMetadata,
  type MediaPreset,
} from '../lib/mediaPresets';

export function ImageUploader({
  value,
  onChange,
  preset = MEDIA_PRESETS.general,
  folder,
  accept,
  label = 'Upload image',
  previewClassName,
  showPreview = true,
}: {
  value?: string | null;
  onChange: (url: string) => void;
  /** Which public-site slot this media is for. Drives guidance + checks. */
  preset?: MediaPreset;
  folder?: string;
  accept?: string;
  label?: string;
  previewClassName?: string;
  showPreview?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // File metadata (including byte size) is captured before upload. Remembering
  // it for the returned URL avoids re-reading the file from the network and
  // losing the size warning right after a successful upload.
  const selfUploadRef = useRef<{ url: string; meta: MediaMetadata } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [meta, setMeta] = useState<MediaMetadata | null>(null);
  const [pending, setPending] = useState<{ url: string; kind: MediaKind } | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const { error } = useToast();

  const resolvedFolder = folder || preset.folder;
  const resolvedAccept = accept || acceptForPreset(preset);
  const previewSrc = pending?.url || mediaSrc(value);
  const previewKind: MediaKind = pending?.kind || mediaKindFromUrl(value);

  // Read dimensions of an existing/pasted URL so edit forms show real metadata.
  useEffect(() => {
    if (!value) {
      setMeta(null);
      setAnalyzing(false);
      return;
    }
    const cached = selfUploadRef.current;
    if (cached && cached.url === value) {
      setMeta(cached.meta);
      setAnalyzing(false);
      return;
    }
    let cancelled = false;
    setAnalyzing(true);
    detectUrlMetadata(mediaSrc(value), mediaKindFromUrl(value))
      .then((detected) => {
        if (!cancelled) setMeta(detected);
      })
      .catch(() => {
        if (!cancelled) setMeta(null);
      })
      .finally(() => {
        if (!cancelled) setAnalyzing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  const issues = useMemo(() => (meta ? validateMedia(meta, preset) : []), [meta, preset]);

  async function uploadFile(
    file: File | Blob,
    filename?: string,
    detectedMeta?: MediaMetadata | null,
  ): Promise<string | null> {
    setUploading(true);
    try {
      const form = new FormData();
      const upload = file instanceof File ? file : new File([file], filename || 'upload', { type: file.type });
      form.append('file', upload);
      form.append('folder', resolvedFolder);
      const res = await api.upload<{ url: string }>('/admin/media/upload', form);
      if (detectedMeta) selfUploadRef.current = { url: res.url, meta: detectedMeta };
      onChange(res.url);
      return res.url;
    } catch (err) {
      error(err instanceof ApiError ? err.message : 'Upload failed');
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function handleFile(file: File) {
    const kind = mediaKindFromFile(file);
    if (!kind) {
      error('Unsupported file type. Use an image (JPG, PNG, WebP, AVIF, GIF, SVG) or video (MP4, WebM, MOV).');
      return;
    }
    if (!specForKind(preset, kind)) {
      error(
        `${preset.label} accepts ${preset.image ? 'images only' : 'videos only'}. Use the Media Library for other file types.`,
      );
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPending({ url: objectUrl, kind });
    setAnalyzing(true);
    let detected: MediaMetadata | null = null;
    try {
      detected = await detectFileMetadata(file);
      setMeta(detected);
    } catch {
      setMeta(null);
    } finally {
      setAnalyzing(false);
    }

    const uploadedUrl = await uploadFile(file, file.name, detected);
    if (!uploadedUrl) setMeta(null);
    URL.revokeObjectURL(objectUrl);
    setPending(null);
  }

  async function handleCrop(blob: Blob, filename: string) {
    const file = new File([blob], filename, { type: blob.type });
    let detected: MediaMetadata | null = null;
    try {
      detected = await detectFileMetadata(file);
    } catch {
      /* the uploaded crop is still valid even if metadata cannot be read */
    }
    const uploadedUrl = await uploadFile(file, filename, detected);
    if (uploadedUrl) {
      setMeta(detected);
      setCropOpen(false);
    }
  }

  const canCrop = Boolean(value) && previewKind === 'image' && preset.crop && !uploading;

  return (
    <div className="space-y-3">
      <MediaGuidance preset={preset} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div
          className={cn(
            'relative flex h-28 w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50 sm:w-40',
            previewClassName,
          )}
        >
          {previewSrc ? (
            previewKind === 'video' ? (
              <video src={previewSrc} className={cn('h-full w-full', preset.fit === 'contain' ? 'object-contain' : 'object-cover')} muted playsInline preload="metadata" />
            ) : (
              <img src={previewSrc} alt="Selected media" className={cn('h-full w-full', preset.fit === 'contain' ? 'object-contain p-1' : 'object-cover')} />
            )
          ) : (
            <ImageIcon className="h-7 w-7 text-slate-300" />
          )}
          {previewSrc ? (
            <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              {previewKind === 'video' ? <Video className="h-2.5 w-2.5" /> : <ImageIcon className="h-2.5 w-2.5" />}
              {previewKind}
            </span>
          ) : null}
          {uploading ? (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-white/75 text-[11px] font-medium text-brand-700">
              <Loader2 className="h-5 w-5 animate-spin" />
              Uploading…
            </span>
          ) : null}
        </div>

        <div className="flex-1 space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept={resolvedAccept}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              event.target.value = '';
            }}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-outline"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="h-4 w-4" /> {value ? `Replace ${previewKind}` : label}
            </button>
            {canCrop ? (
              <button type="button" className="btn-outline" onClick={() => setCropOpen(true)}>
                <Crop className="h-4 w-4" /> Crop / adjust
              </button>
            ) : null}
            {previewKind === 'video' && previewSrc ? (
              <a
                href={previewSrc}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost"
                title="Open video in a new tab"
              >
                <Play className="h-4 w-4" /> Preview video
              </a>
            ) : null}
            {value ? (
              <button
                type="button"
                className="btn-ghost text-red-600 hover:bg-red-50"
                onClick={() => onChange('')}
                disabled={uploading}
              >
                <Trash2 className="h-4 w-4" /> Remove
              </button>
            ) : null}
          </div>
          <input
            className="input text-xs"
            placeholder="…or paste an image/media URL"
            value={value || ''}
            onChange={(event) => onChange(event.target.value)}
          />
          <p className="text-[11px] text-slate-400">
            {preset.image && preset.video
              ? `Images up to ${preset.image.maxSizeMB} MB · videos up to ${preset.video.maxSizeMB} MB (recommended)`
              : `${previewKind === 'video' ? 'Video' : 'Image'} upload · the server validates the real file type and size`}
          </p>
        </div>
      </div>

      <MediaCheckPanel meta={meta} issues={issues} preset={preset} analyzing={analyzing && !meta} />

      {showPreview ? <MediaPreview preset={preset} src={previewSrc || null} kind={previewKind} /> : null}

      {canCrop || cropOpen ? (
        <ImageCropDialog
          open={cropOpen}
          src={mediaSrc(value) || ''}
          preset={preset}
          onClose={() => setCropOpen(false)}
          onCropped={handleCrop}
        />
      ) : null}
    </div>
  );
}
