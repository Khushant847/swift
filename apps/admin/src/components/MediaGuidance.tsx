import { AlertTriangle, CheckCircle2, ImageIcon, Info, Loader2, Video } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  describeMetadata,
  formatDimensions,
  type MediaIssue,
  type MediaMetadata,
  type MediaPreset,
  type MediaSpec,
} from '../lib/mediaPresets';

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-200/70 py-1.5 last:border-0">
      <dt className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-right text-xs font-semibold text-slate-700">{value}</dd>
    </div>
  );
}

function SpecBlock({ kind, spec }: { kind: 'image' | 'video'; spec: MediaSpec }) {
  const Icon = kind === 'video' ? Video : ImageIcon;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
        <Icon className="h-3.5 w-3.5 text-brand-700" />
        {kind === 'video' ? 'Video' : 'Image'}
      </p>
      <dl>
        <SpecRow label="Size" value={formatDimensions(spec)} />
        <SpecRow label="Ratio" value={spec.aspectLabel || 'Flexible'} />
        <SpecRow label="Format" value={spec.formats.join(' / ')} />
        <SpecRow label="Max size" value={`${spec.maxSizeMB} MB`} />
        {spec.maxDurationSeconds ? <SpecRow label="Duration" value={`≤ ${spec.maxDurationSeconds}s`} /> : null}
      </dl>
    </div>
  );
}

/**
 * Recommended dimensions, ratio, formats and size limit for an upload slot.
 * Rendered from the centralized `mediaPresets` config so every page stays
 * consistent.
 */
export function MediaGuidance({ preset, className }: { preset: MediaPreset; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-brand-100 bg-brand-50/50 p-3.5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-800">
            <Info className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">Recommended specifications</p>
            <p className="text-xs leading-relaxed text-slate-500">{preset.description}</p>
          </div>
        </div>
        <span className="badge shrink-0 bg-white text-brand-800 ring-1 ring-brand-200">{preset.label}</span>
      </div>

      <div className={cn('mt-3 grid gap-2', preset.image && preset.video ? 'sm:grid-cols-2' : 'sm:grid-cols-1')}>
        {preset.image ? <SpecBlock kind="image" spec={preset.image} /> : null}
        {preset.video ? <SpecBlock kind="video" spec={preset.video} /> : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          {preset.fit === 'cover' ? <ImageIcon className="h-3 w-3" /> : <Info className="h-3 w-3" />}
          {preset.fit === 'cover' ? 'Crops to fill the container (object-cover)' : 'Fits inside without cropping (object-contain)'}
        </span>
        {preset.crop ? <span>· Crop / adjust available after upload</span> : null}
      </div>

      {preset.note ? (
        <p className="mt-2 rounded-md bg-white/70 px-2.5 py-2 text-[11px] leading-relaxed text-slate-500">
          <span className="font-semibold text-slate-600">Tip: </span>
          {preset.note}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Shows the actual dimensions/size of the selected file and any mismatch
 * warnings. Warnings never block an upload.
 */
export function MediaCheckPanel({
  meta,
  issues,
  preset,
  analyzing = false,
}: {
  meta: MediaMetadata | null;
  issues: MediaIssue[];
  preset: MediaPreset;
  analyzing?: boolean;
}) {
  if (analyzing && !meta) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading media dimensions…
      </div>
    );
  }

  if (!meta) return null;

  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const hasError = errors.length > 0;
  const hasWarning = warnings.length > 0;

  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5 text-xs',
        hasError
          ? 'border-red-200 bg-red-50'
          : hasWarning
            ? 'border-amber-200 bg-amber-50'
            : 'border-green-200 bg-green-50',
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-2">
        {hasError || hasWarning ? (
          <AlertTriangle className={cn('h-4 w-4 shrink-0', hasError ? 'text-red-600' : 'text-amber-600')} />
        ) : (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
        )}
        <p className={cn('font-semibold', hasError ? 'text-red-800' : hasWarning ? 'text-amber-800' : 'text-green-800')}>
          {hasError ? 'This file is not suitable for this slot' : hasWarning ? 'Check this media before saving' : 'Matches the recommendation'}
        </p>
        <span className="ml-auto font-medium text-slate-500">{describeMetadata(meta)}</span>
      </div>

      {issues.length ? (
        <ul className="mt-2 space-y-1.5">
          {issues.map((issue, index) => (
            <li key={`${issue.title}-${index}`} className="flex gap-1.5">
              <span className={cn('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', issue.severity === 'error' ? 'bg-red-500' : 'bg-amber-500')} />
              <span className={cn('leading-relaxed', issue.severity === 'error' ? 'text-red-700' : 'text-amber-800')}>
                <span className="font-semibold">{issue.title}.</span> {issue.detail}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 pl-6 text-green-700">
          {preset.image && preset.video
            ? 'Dimensions, aspect ratio and file size are within the recommended range.'
            : `This ${meta.kind} matches the ${preset.label.toLowerCase()} recommendation.`}
        </p>
      )}
    </div>
  );
}
