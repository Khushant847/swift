import { useEffect, useRef, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, FileText, FolderOpen, Loader2, Search, Trash2, Upload } from 'lucide-react';
import { api, ApiError, qs } from '../lib/api';
import type { MediaItem } from '../lib/types';
import { PageHeader, CardSkeleton, EmptyState, ErrorState } from '../components/ui/Feedback';
import { ConfirmDialog } from '../components/ui/Modal';
import { Field } from '../components/ui/Form';
import { MediaGuidance } from '../components/MediaGuidance';
import {
  detectFileMetadata,
  getPreset,
  MEDIA_PRESET_LIST,
  mediaKindFromFile,
  validateMedia,
  type MediaIssue,
} from '../lib/mediaPresets';
import { useToast } from '../components/ui/Toast';
import { formatBytes, formatDateShort, cn } from '../lib/utils';

const FOLDERS = ['all', 'general', 'branding', 'banners', 'products', 'gallery', 'upcoming', 'team'];

export function MediaPage() {
  const qc = useQueryClient();
  const { success, error } = useToast();
  const [folder, setFolder] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<MediaItem | null>(null);
  const [guideKey, setGuideKey] = useState('general');
  const [uploadIssues, setUploadIssues] = useState<{ file: string; issues: MediaIssue[] }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const guidePreset = getPreset(guideKey);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['media', folder, debouncedSearch],
    queryFn: () => api.get<MediaItem[]>(`/admin/media${qs({ folder, search: debouncedSearch })}`),
    placeholderData: keepPreviousData,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['media'] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/admin/media/${id}`),
    onSuccess: () => { success('Media deleted'); setDeleting(null); invalidate(); },
    onError: (e) => error(e instanceof ApiError ? e.message : 'Delete failed'),
  });

  async function uploadFiles(files: FileList | File[]) {
    setUploading(true);
    setUploadIssues([]);
    const found: { file: string; issues: MediaIssue[] }[] = [];
    try {
      for (const file of Array.from(files)) {
        const kind = mediaKindFromFile(file);
        if (kind) {
          try {
            const meta = await detectFileMetadata(file);
            const issues = validateMedia(meta, guidePreset);
            if (issues.length) found.push({ file: file.name, issues });
          } catch {
            /* metadata is advisory — never block the upload */
          }
        }
        const fd = new FormData();
        fd.append('file', file);
        fd.append('folder', folder === 'all' ? guidePreset.folder : folder);
        await api.upload('/admin/media/upload', fd);
      }
      setUploadIssues(found);
      success(`${files.length} file(s) uploaded${found.length ? ' — check the warnings below' : ''}`);
      invalidate();
    } catch (e) {
      error(e instanceof ApiError ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function copyUrl(url: string) {
    void navigator.clipboard.writeText(url);
    success('URL copied to clipboard');
  }

  return (
    <div>
      <PageHeader
        title="Media Library"
        description="Centralized manager for all uploaded images and videos."
        actions={<button className="btn-primary" onClick={() => inputRef.current?.click()} disabled={uploading}>{uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> : <><Upload className="h-4 w-4" /> Upload files</>}</button>}
      />

      <input ref={inputRef} type="file" multiple accept="image/*,video/mp4,video/webm,video/quicktime,application/pdf" className="hidden" onChange={(e) => { if (e.target.files?.length) void uploadFiles(e.target.files); e.target.value = ''; }} />

      <div className="mb-4 grid gap-3 lg:grid-cols-[250px_1fr] lg:items-start">
        <Field
          label="What is this media for?"
          hint="Guidance and checks follow the public-site slot you choose."
        >
          <select className="input" value={guideKey} onChange={(e) => setGuideKey(e.target.value)}>
            {MEDIA_PRESET_LIST.map((preset) => (
              <option key={preset.key} value={preset.key}>{preset.label}</option>
            ))}
          </select>
        </Field>
        <MediaGuidance preset={guidePreset} />
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files); }}
        className={cn('mb-5 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition', dragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-white')}
      >
        <Upload className={cn('mb-2 h-8 w-8', dragging ? 'text-brand-600' : 'text-slate-400')} />
        <p className="text-sm font-medium text-slate-600">Drag & drop files here, or click Upload</p>
        <p className="mt-1 text-xs text-slate-400">Images, MP4/WebM/MOV video and PDF · checked against {guidePreset.label}</p>
      </div>

      {uploadIssues.length ? (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-amber-900">
              {uploadIssues.length === 1
                ? `1 file does not match the ${guidePreset.label.toLowerCase()} recommendation`
                : `${uploadIssues.length} files do not match the ${guidePreset.label.toLowerCase()} recommendation`}
            </p>
            <button type="button" className="font-semibold text-amber-700 underline-offset-2 hover:underline" onClick={() => setUploadIssues([])}>
              Dismiss
            </button>
          </div>
          <ul className="mt-2 space-y-2">
            {uploadIssues.map((entry) => (
              <li key={entry.file}>
                <p className="font-semibold">{entry.file}</p>
                <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
                  {entry.issues.map((issue, index) => (
                    <li key={`${issue.title}-${index}`}>
                      <span className="font-medium">{issue.title}.</span> {issue.detail}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search by name or tag…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input sm:max-w-[200px]" value={folder} onChange={(e) => setFolder(e.target.value)}>
          {FOLDERS.map((f) => (<option key={f} value={f}>{f === 'all' ? 'All folders' : f}</option>))}
        </select>
      </div>

      {isLoading ? (
        <CardSkeleton count={8} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : !data?.length ? (
        <EmptyState title="No media" description="Upload files to build your media library." icon={<FolderOpen className="h-6 w-6" />} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {data.map((m) => {
            const isVideo = m.mimeType.startsWith('video/');
            const isPdf = m.mimeType.includes('pdf');
            return (
              <div key={m.id} className="card group overflow-hidden">
                <div className="relative flex aspect-square items-center justify-center bg-slate-100">
                  {isVideo ? (
                    <video src={m.url} className="h-full w-full object-cover" muted />
                  ) : isPdf ? (
                    <FileText className="h-10 w-10 text-slate-400" />
                  ) : (
                    <img src={m.url} alt={m.originalName} className="h-full w-full object-cover" loading="lazy" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition group-hover:opacity-100">
                    <button className="rounded-lg bg-white p-2 text-slate-700" title="Copy URL" onClick={() => copyUrl(m.url)}><Copy className="h-4 w-4" /></button>
                    <button className="rounded-lg bg-white p-2 text-red-600" title="Delete" onClick={() => setDeleting(m)}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="p-2.5">
                  <p className="truncate text-xs font-medium text-slate-700" title={m.originalName}>{m.originalName}</p>
                  <p className="text-[11px] text-slate-400">{formatBytes(m.size)} · {m.folder}</p>
                  <p className="text-[11px] text-slate-300">{formatDateShort(m.uploadedAt)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog open={!!deleting} title="Delete media" message={`Delete "${deleting?.originalName}"? Files in use on the site may break.`} loading={deleteMutation.isPending} onClose={() => setDeleting(null)} onConfirm={() => deleting && deleteMutation.mutate(deleting.id)} />
    </div>
  );
}
