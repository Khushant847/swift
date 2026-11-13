import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { api, ApiError, mediaSrc } from '../lib/api';
import type { GalleryItem } from '../lib/types';
import { PageHeader, CardSkeleton, EmptyState, ErrorState } from '../components/ui/Feedback';
import { Field } from '../components/ui/Form';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { ImageUploader } from '../components/ImageUploader';
import { MediaGuidance } from '../components/MediaGuidance';
import {
  detectFileMetadata,
  MEDIA_PRESETS,
  validateMedia,
  type MediaIssue,
} from '../lib/mediaPresets';
import { useToast } from '../components/ui/Toast';
import { cn } from '../lib/utils';

const TAGS = ['Lab', 'Office', 'Team', 'Events', 'Products', 'Facility'];
const EMPTY = { mediaUrl: '', mediaType: 'image' as 'image' | 'video', categoryTag: 'Office', caption: '' };

export function GalleryPage() {
  const qc = useQueryClient();
  const { success, error } = useToast();
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState<typeof EMPTY>({ ...EMPTY });
  const [editing, setEditing] = useState<GalleryItem | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<GalleryItem | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkTag, setBulkTag] = useState('Office');
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkIssues, setBulkIssues] = useState<{ file: string; issues: MediaIssue[] }[]>([]);
  const bulkRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['gallery', filter],
    queryFn: () => api.get<GalleryItem[]>(`/admin/gallery${filter !== 'all' ? `?category=${filter}` : ''}`),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['gallery'] });

  const saveMutation = useMutation({
    mutationFn: (payload: typeof EMPTY & { id?: string }) =>
      payload.id ? api.put(`/admin/gallery/${payload.id}`, payload) : api.post('/admin/gallery', payload),
    onSuccess: () => { success('Saved'); setOpen(false); invalidate(); },
    onError: (e) => error(e instanceof ApiError ? e.message : 'Save failed'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/admin/gallery/${id}`),
    onSuccess: () => { success('Deleted'); setDeleting(null); invalidate(); },
    onError: (e) => error(e instanceof ApiError ? e.message : 'Delete failed'),
  });

  async function handleBulk(files: FileList) {
    setBulkUploading(true);
    setBulkIssues([]);
    const found: { file: string; issues: MediaIssue[] }[] = [];
    try {
      for (const file of Array.from(files)) {
        try {
          const meta = await detectFileMetadata(file);
          const issues = validateMedia(meta, MEDIA_PRESETS.gallery);
          if (issues.length) found.push({ file: file.name, issues });
        } catch {
          /* metadata is advisory — never block the upload */
        }
        const fd = new FormData();
        fd.append('file', file);
        fd.append('folder', 'gallery');
        const media = await api.upload<{ url: string; mediaType?: string }>('/admin/media/upload', fd);
        await api.post('/admin/gallery', {
          mediaUrl: media.url,
          mediaType: /\.(mp4|webm|mov)$/i.test(file.name) ? 'video' : 'image',
          categoryTag: bulkTag,
          caption: file.name.replace(/\.[^.]+$/, ''),
        });
      }
      success(`${files.length} file(s) uploaded${found.length ? ' — check the warnings below' : ''}`);
      setBulkIssues(found);
      setBulkOpen(false);
      invalidate();
    } catch (e) {
      error(e instanceof ApiError ? e.message : 'Bulk upload failed');
    } finally {
      setBulkUploading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Gallery Library"
        description="Manage internal lab, office and team photos & videos."
        actions={
          <>
            <button className="btn-outline" onClick={() => setBulkOpen(true)}><Upload className="h-4 w-4" /> Bulk upload</button>
            <button className="btn-primary" onClick={() => { setForm({ ...EMPTY, categoryTag: filter !== 'all' ? filter : 'Office' }); setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Add item</button>
          </>
        }
      />

      {bulkIssues.length ? (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-amber-900">
              {bulkIssues.length} upload{bulkIssues.length === 1 ? '' : 's'} may not fit the gallery recommendation
            </p>
            <button type="button" className="font-semibold text-amber-700 underline-offset-2 hover:underline" onClick={() => setBulkIssues([])}>
              Dismiss
            </button>
          </div>
          <ul className="mt-2 space-y-2">
            {bulkIssues.map((entry) => (
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

      <div className="mb-4 flex flex-wrap gap-2">
        {['all', ...TAGS].map((t) => (
          <button key={t} onClick={() => setFilter(t)} className={cn('rounded-full px-3.5 py-1.5 text-sm font-medium transition', filter === t ? 'bg-brand-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-100')}>
            {t === 'all' ? 'All' : t}
          </button>
        ))}
      </div>

      {isLoading ? (
        <CardSkeleton count={8} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : !data?.length ? (
        <EmptyState title="No gallery items" description="Upload photos and videos of your workspace." />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {data.map((item) => (
            <div key={item.id} className="card group overflow-hidden">
              <div className="relative aspect-square bg-slate-100">
                {item.mediaType === 'video' ? (
                  <video src={mediaSrc(item.mediaUrl)} className="h-full w-full object-cover" muted />
                ) : (
                  <img src={mediaSrc(item.mediaUrl)} alt={item.caption || ''} className="h-full w-full object-cover" />
                )}
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition group-hover:opacity-100">
                  <button className="rounded-lg bg-white p-2 text-slate-700" onClick={() => { setForm({ mediaUrl: item.mediaUrl, mediaType: item.mediaType, categoryTag: item.categoryTag, caption: item.caption || '' }); setEditing(item); setOpen(true); }}><Pencil className="h-4 w-4" /></button>
                  <button className="rounded-lg bg-white p-2 text-red-600" onClick={() => setDeleting(item)}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-medium text-slate-700">{item.caption || 'Untitled'}</p>
                <span className="badge bg-slate-100 text-slate-500">{item.categoryTag}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit gallery item' : 'Add gallery item'}
        size="lg"
        footer={
          <>
            <button className="btn-outline" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={!form.mediaUrl || saveMutation.isPending} onClick={() => saveMutation.mutate({ ...form, ...(editing ? { id: editing.id } : {}) } as never)}>
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Media" required><ImageUploader value={form.mediaUrl} onChange={(url) => setForm((f) => ({ ...f, mediaUrl: url, mediaType: /\.(mp4|webm|mov)(\?|$)/i.test(url) ? 'video' : 'image' }))} preset={MEDIA_PRESETS.gallery} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category Tag">
              <select className="input" value={form.categoryTag} onChange={(e) => setForm((f) => ({ ...f, categoryTag: e.target.value }))}>
                {TAGS.map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
            </Field>
            <Field label="Caption"><input className="input" value={form.caption} onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))} /></Field>
          </div>
        </div>
      </Modal>

      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Bulk upload"
        footer={
          <>
            <button className="btn-outline" onClick={() => setBulkOpen(false)} disabled={bulkUploading}>Cancel</button>
            <button className="btn-primary" onClick={() => bulkRef.current?.click()} disabled={bulkUploading}>
              {bulkUploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> : <><Upload className="h-4 w-4" /> Choose files</>}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Tag all uploads as">
            <select className="input" value={bulkTag} onChange={(e) => setBulkTag(e.target.value)}>
              {TAGS.map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
          </Field>
          <input ref={bulkRef} type="file" multiple accept="image/*,video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => { if (e.target.files?.length) void handleBulk(e.target.files); e.target.value = ''; }} />
          <MediaGuidance preset={MEDIA_PRESETS.gallery} />
          <p className="text-sm text-slate-500">Select multiple images/videos. Each file is uploaded and added to the gallery under the chosen tag.</p>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} title="Delete item" message="Delete this gallery item?" loading={deleteMutation.isPending} onClose={() => setDeleting(null)} onConfirm={() => deleting && deleteMutation.mutate(deleting.id)} />
    </div>
  );
}
