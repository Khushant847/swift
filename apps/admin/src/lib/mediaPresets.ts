import { formatBytes } from './utils';

/**
 * Central source of truth for every media upload location in the admin panel.
 *
 * The numbers below are derived from the real public-site containers:
 *  - Hero: full-bleed 68–86vh carousel (`HeroCarousel`), text overlays the left.
 *  - Product cards: 4:3 (`FeaturedProducts`), detail page: 1:1.
 *  - Upcoming cards: 16:10 (`UpcomingProducts`).
 *  - Gallery tiles: 1:1 (`GalleryGrid`), lightbox: native ratio.
 *  - Founder portrait: 4:5 (`AboutCompany`).
 *  - Logo: 40–48px tall, `object-contain` in header/footer.
 *
 * Keep this file in sync when a public layout changes. Admin guidance,
 * validation, previews and bulk-upload checks all read from here.
 */

export type MediaKind = 'image' | 'video';

export type PreviewVariant =
  | 'hero'
  | 'product'
  | 'upcoming'
  | 'gallery'
  | 'founder'
  | 'logo'
  | 'general';

export interface MediaSpec {
  /** Recommended output width in pixels. Omit for uncapped/general media. */
  width?: number;
  /** Recommended output height in pixels. Omit for uncapped/general media. */
  height?: number;
  /** Human-readable ratio, e.g. "16:9". */
  aspectLabel?: string;
  /** Formats shown to the admin (display only). */
  formats: string[];
  /** Formats the backend accepts. */
  mimeTypes: string[];
  /** Recommended maximum file size. This is guidance, not a hard rejection. */
  maxSizeMB: number;
  /** Below this width the image/video is flagged as low resolution. */
  minWidth?: number;
  /** Below this height the image/video is flagged as low resolution. */
  minHeight?: number;
  /** Videos longer than this are flagged (page-weight guidance). */
  maxDurationSeconds?: number;
}

export interface MediaPreset {
  key: string;
  label: string;
  /** Short explanation of where this media appears. */
  description: string;
  /** Default upload folder (must be in Media.FOLDER allow-list). */
  folder: string;
  /** How the public site fits the media inside its container. */
  fit: 'cover' | 'contain';
  /** Whether a crop/adjust tool makes sense for images in this slot. */
  crop: boolean;
  /** Which mock scene the preview renders. */
  preview: PreviewVariant;
  image?: MediaSpec;
  video?: MediaSpec;
  /** Optional note about safe areas / cropping on small screens. */
  note?: string;
  /**
   * Logos keep their own aspect ratio (`object-contain`), so an aspect-ratio
   * mismatch is not a problem for that slot.
   */
  flexibleAspect?: boolean;
}

const IMAGE_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/svg+xml',
];

const VIDEO_MIME = ['video/mp4', 'video/webm', 'video/quicktime'];

const IMAGE_FORMATS = ['WebP', 'JPG', 'PNG'];
const VIDEO_FORMATS = ['MP4 (H.264)', 'WebM'];

const heroImage: MediaSpec = {
  width: 1920,
  height: 1080,
  aspectLabel: '16:9',
  formats: IMAGE_FORMATS,
  mimeTypes: IMAGE_MIME,
  maxSizeMB: 5,
  minWidth: 1600,
  minHeight: 900,
};

const heroVideo: MediaSpec = {
  width: 1920,
  height: 1080,
  aspectLabel: '16:9',
  formats: VIDEO_FORMATS,
  mimeTypes: VIDEO_MIME,
  maxSizeMB: 25,
  minWidth: 1280,
  minHeight: 720,
  maxDurationSeconds: 30,
};

export const MEDIA_PRESETS = {
  hero: {
    key: 'hero',
    label: 'Website Banner / Hero',
    description: 'Full-width homepage carousel slide. Headline and buttons overlay the left side.',
    folder: 'banners',
    fit: 'cover',
    crop: true,
    preview: 'hero',
    image: heroImage,
    video: heroVideo,
    note: 'Keep the main subject in the centre-right. Mobile screens crop the left and right edges, so avoid putting important details near the edges.',
  },
  product: {
    key: 'product',
    label: 'Product Image',
    description: 'Shown on product cards (4:3) and on the product detail page (1:1).',
    folder: 'products',
    fit: 'cover',
    crop: true,
    preview: 'product',
    image: {
      width: 1200,
      height: 1200,
      aspectLabel: '1:1',
      formats: IMAGE_FORMATS,
      mimeTypes: IMAGE_MIME,
      maxSizeMB: 3,
      minWidth: 800,
      minHeight: 800,
    },
    note: 'Use a square image with the product centred and a little breathing room. The card crops it to 4:3, the detail page to 1:1.',
  },
  upcoming: {
    key: 'upcoming',
    label: 'Upcoming Product Visual',
    description: 'Teaser card in the “In Development” section.',
    folder: 'upcoming',
    fit: 'cover',
    crop: true,
    preview: 'upcoming',
    image: {
      width: 1600,
      height: 1000,
      aspectLabel: '16:10',
      formats: IMAGE_FORMATS,
      mimeTypes: IMAGE_MIME,
      maxSizeMB: 3,
      minWidth: 1000,
      minHeight: 625,
    },
    note: '16:10 matches the teaser card exactly. Avoid text near the bottom edge — the title/launch badge sit close to it.',
  },
  gallery: {
    key: 'gallery',
    label: 'Gallery Photo / Video',
    description: 'Square thumbnails on the gallery page; videos play in a lightbox.',
    folder: 'gallery',
    fit: 'cover',
    crop: true,
    preview: 'gallery',
    image: {
      width: 1200,
      height: 1200,
      aspectLabel: '1:1',
      formats: IMAGE_FORMATS,
      mimeTypes: IMAGE_MIME,
      maxSizeMB: 3,
      minWidth: 800,
      minHeight: 800,
    },
    video: {
      width: 1920,
      height: 1080,
      aspectLabel: '16:9',
      formats: VIDEO_FORMATS,
      mimeTypes: VIDEO_MIME,
      maxSizeMB: 25,
      minWidth: 1280,
      minHeight: 720,
      maxDurationSeconds: 120,
    },
    note: 'Thumbnails are cropped to a square. Videos open at their native 16:9 ratio, so keep action away from the extreme edges.',
  },
  founder: {
    key: 'founder',
    label: 'Founder Portrait',
    description: 'Portrait beside the founder story on the About section.',
    folder: 'team',
    fit: 'cover',
    crop: true,
    preview: 'founder',
    image: {
      width: 800,
      height: 1000,
      aspectLabel: '4:5',
      formats: ['WebP', 'JPG', 'PNG'],
      mimeTypes: IMAGE_MIME,
      maxSizeMB: 2,
      minWidth: 600,
      minHeight: 750,
    },
    note: 'The portrait is cropped to 4:5. Frame the face in the upper-centre so it stays visible on mobile.',
  },
  logo: {
    key: 'logo',
    label: 'Company Logo',
    description: 'Header and footer logo. Always shown with object-contain, never cropped.',
    folder: 'branding',
    fit: 'contain',
    crop: false,
    preview: 'logo',
    image: {
      width: 600,
      height: 200,
      aspectLabel: '3:1 (flexible)',
      formats: ['SVG', 'PNG', 'WebP'],
      mimeTypes: IMAGE_MIME,
      maxSizeMB: 1,
      minWidth: 300,
      minHeight: 100,
    },
    flexibleAspect: true,
    note: 'Use a transparent PNG, WebP or SVG. The logo is displayed at 40–48px height, so a wide horizontal mark works best.',
  },
  general: {
    key: 'general',
    label: 'General Media',
    description: 'Media library / not tied to a specific slot.',
    folder: 'general',
    fit: 'cover',
    crop: true,
    preview: 'general',
    image: {
      formats: IMAGE_FORMATS,
      mimeTypes: IMAGE_MIME,
      maxSizeMB: 10,
      minWidth: 320,
      minHeight: 240,
    },
    video: {
      formats: VIDEO_FORMATS,
      mimeTypes: VIDEO_MIME,
      maxSizeMB: 25,
      minWidth: 640,
      minHeight: 360,
    },
    note: 'Choose the destination preset above for an exact size and aspect-ratio check.',
  },
} satisfies Record<string, MediaPreset>;

export type MediaPresetKey = keyof typeof MEDIA_PRESETS;

export const MEDIA_PRESET_LIST: MediaPreset[] = [
  MEDIA_PRESETS.hero,
  MEDIA_PRESETS.product,
  MEDIA_PRESETS.upcoming,
  MEDIA_PRESETS.gallery,
  MEDIA_PRESETS.founder,
  MEDIA_PRESETS.logo,
  MEDIA_PRESETS.general,
];

export function getPreset(key?: string | null): MediaPreset {
  if (key && key in MEDIA_PRESETS) return MEDIA_PRESETS[key as MediaPresetKey];
  return MEDIA_PRESETS.general;
}

export function specForKind(preset: MediaPreset, kind: MediaKind): MediaSpec | undefined {
  return kind === 'video' ? preset.video : preset.image;
}

/** Comma-separated accept attribute for the file picker. */
export function acceptForPreset(preset: MediaPreset): string {
  const mimes = [...(preset.image?.mimeTypes ?? []), ...(preset.video?.mimeTypes ?? [])];
  return Array.from(new Set(mimes)).join(',');
}

export function mediaKindFromUrl(url?: string | null): MediaKind {
  return /\.(mp4|webm|mov)(\?|#|$)/i.test(url || '') ? 'video' : 'image';
}

export function mediaKindFromFile(file: File): MediaKind | null {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('image/')) return 'image';
  if (/\.(mp4|webm|mov)$/i.test(file.name)) return 'video';
  if (/\.(jpe?g|png|webp|avif|gif|svg)$/i.test(file.name)) return 'image';
  return null;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
}

export function formatDimensions(spec?: Pick<MediaSpec, 'width' | 'height'>): string {
  if (!spec?.width || !spec?.height) return 'Depends on placement';
  return `${formatNumber(spec.width)} × ${formatNumber(spec.height)} px`;
}

export function approximateAspect(width?: number, height?: number): string {
  if (!width || !height) return '—';
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(width, height);
  const w = Math.round(width / g);
  const h = Math.round(height / g);
  if (w <= 30 && h <= 30) return `${w}:${h}`;
  return `${(width / height).toFixed(2)}:1`;
}

export function orientationOf(width?: number, height?: number): 'landscape' | 'portrait' | 'square' | '—' {
  if (!width || !height) return '—';
  if (Math.abs(width - height) / Math.max(width, height) < 0.02) return 'square';
  return width > height ? 'landscape' : 'portrait';
}

export interface MediaMetadata {
  kind: MediaKind;
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: string;
  name?: string;
  durationSeconds?: number;
}

export interface MediaIssue {
  severity: 'warning' | 'error';
  title: string;
  detail?: string;
}

const MB = 1024 * 1024;

/**
 * Compare an uploaded asset against a preset. These are advisory only — the
 * backend keeps its own MIME/size validation and nothing here blocks uploads.
 */
export function validateMedia(meta: MediaMetadata, preset: MediaPreset): MediaIssue[] {
  const issues: MediaIssue[] = [];
  const spec = specForKind(preset, meta.kind);

  if (!spec) {
    return [
      {
        severity: 'error',
        title: preset.image ? 'This field accepts images only' : 'This field accepts videos only',
        detail: `Upload ${preset.image ? 'an image' : 'a video'}, or use the Media Library for other file types.`,
      },
    ];
  }

  if (meta.sizeBytes > spec.maxSizeMB * MB) {
    issues.push({
      severity: 'warning',
      title: 'File is larger than recommended',
      detail: `This file is ${formatBytes(meta.sizeBytes)}; the recommended maximum is ${spec.maxSizeMB} MB. Large files slow the page down. The server may still accept it if it is under its own upload limit.`,
    });
  }

  if (meta.kind === 'image' && meta.mimeType === 'image/svg+xml') {
    return issues;
  }

  if (spec.width && spec.height && meta.width > 0 && meta.height > 0) {
    if (!preset.flexibleAspect) {
      const targetAspect = spec.width / spec.height;
      const actualAspect = meta.width / meta.height;
      const delta = Math.abs(actualAspect - targetAspect) / targetAspect;
      if (delta > 0.06) {
        issues.push({
          severity: 'warning',
          title: 'Aspect ratio does not match',
          detail: `Uploaded ${formatNumber(meta.width)} × ${formatNumber(meta.height)} px (${approximateAspect(meta.width, meta.height)}, ${orientationOf(meta.width, meta.height)}) vs recommended ${formatNumber(spec.width)} × ${formatNumber(spec.height)} px (${spec.aspectLabel}). It may appear cropped on some devices.`,
        });
      }
    }

    const minWidth = spec.minWidth ?? Math.round(spec.width * 0.7);
    const minHeight = spec.minHeight ?? Math.round(spec.height * 0.7);

    if (meta.width < minWidth || meta.height < minHeight) {
      issues.push({
        severity: 'warning',
        title: 'Resolution is below the recommendation',
        detail: `Below ${formatNumber(minWidth)} × ${formatNumber(minHeight)} px this media can look soft or pixelated on large screens. Recommended: ${formatDimensions(spec)}.`,
      });
    } else if (meta.width < spec.width || meta.height < spec.height) {
      issues.push({
        severity: 'warning',
        title: 'Slightly smaller than recommended',
        detail: `This file is ${formatNumber(meta.width)} × ${formatNumber(meta.height)} px; ${formatDimensions(spec)} keeps it sharp on high-density displays. It is still usable.`,
      });
    }
  }

  if (
    meta.kind === 'video' &&
    spec.maxDurationSeconds &&
    meta.durationSeconds &&
    meta.durationSeconds > spec.maxDurationSeconds
  ) {
    issues.push({
      severity: 'warning',
      title: 'Video is longer than recommended',
      detail: `This video is ${Math.round(meta.durationSeconds)}s; ${spec.maxDurationSeconds}s or less keeps the hero/gallery light and fast.`,
    });
  }

  return issues;
}

export function describeMetadata(meta: MediaMetadata): string {
  const parts: string[] = [];
  if (meta.width && meta.height) {
    parts.push(`${formatNumber(meta.width)} × ${formatNumber(meta.height)} px`);
    parts.push(approximateAspect(meta.width, meta.height));
  }
  if (meta.sizeBytes) parts.push(formatBytes(meta.sizeBytes));
  if (meta.durationSeconds) parts.push(`${meta.durationSeconds.toFixed(1)}s`);
  return parts.join(' · ') || 'Metadata unavailable';
}

function waitFor<T>(setup: (resolve: (value: T) => void, reject: (reason?: unknown) => void) => void, timeoutMs = 10000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('Timed out while reading media metadata')), timeoutMs);
    setup(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (reason) => {
        window.clearTimeout(timer);
        reject(reason);
      },
    );
  });
}

async function readImageMetadata(src: string, sizeBytes: number, mimeType: string, name?: string): Promise<MediaMetadata> {
  const image = new Image();
  await waitFor<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Could not read the image'));
    image.src = src;
  });
  return {
    kind: 'image',
    width: image.naturalWidth || 0,
    height: image.naturalHeight || 0,
    sizeBytes,
    mimeType,
    name,
  };
}

async function readVideoMetadata(src: string, sizeBytes: number, mimeType: string, name?: string): Promise<MediaMetadata> {
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;
  await waitFor<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Could not read the video'));
    video.src = src;
    video.load();
  });
  const meta = {
    kind: 'video' as const,
    width: video.videoWidth || 0,
    height: video.videoHeight || 0,
    sizeBytes,
    mimeType,
    name,
    durationSeconds: Number.isFinite(video.duration) ? video.duration : undefined,
  };
  video.removeAttribute('src');
  video.load();
  return meta;
}

/** Read dimensions/duration from a local File before or during upload. */
export async function detectFileMetadata(file: File): Promise<MediaMetadata> {
  const kind = mediaKindFromFile(file);
  const objectUrl = URL.createObjectURL(file);
  try {
    if (kind === 'video') {
      return await readVideoMetadata(objectUrl, file.size, file.type, file.name);
    }
    return await readImageMetadata(objectUrl, file.size, file.type, file.name);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Read dimensions/duration for an already-stored URL (edit forms). */
export async function detectUrlMetadata(src: string, kind: MediaKind): Promise<MediaMetadata> {
  if (kind === 'video') return readVideoMetadata(src, 0, '');
  return readImageMetadata(src, 0, '');
}
