import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Image as ImageIcon, Pencil, Plus, Trash2, Video } from 'lucide-react';
import { api, ApiError, mediaSrc } from '../lib/api';
import type { Banner } from '../lib/types';
import { PageHeader, CardSkeleton, EmptyState, ErrorState } from '../components/ui/Feedback';
import { Field, Switch } from '../components/ui/Form';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { ImageUploader } from '../components/ImageUploader';
import { MEDIA_PRESETS } from '../lib/mediaPresets';
import { useToast } from '../components/ui/Toast';

const EMPTY = {
  title: '',
  subtitle: '',
  ctaLabel: '',
  ctaUrl: '',
  mediaUrl: '',
  mediaType: 'image' as Banner['mediaType'],
  intervalSeconds: 5000,
  isActive: true,
};

export function BannersPage() {
  const qc = useQueryClient();
  const { success, error } = useToast();
  const [editing, setEditing] = useState<Banner | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<typeof EMPTY>({ ...EMPTY });
  const [deleting, setDeleting] = useState<Banner | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['banners'], queryFn: () => api.get<Banner[]>('/admin/banners') });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['banners'] });

  const saveMutation = useMutation({
    mutationFn: (payload: typeof EMPTY & { id?: string }) =>
      payload.id ? api.put(`/admin/banners/${payload.id}`, payload) : api.post('/admin/banners', payload),
    onSuccess: () => {
      success('Banner saved');
      close();
      invalidate();
    },
    onError: (e) => error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/admin/banners/${id}`),
    onSuccess: () => {
      success('Banner deleted');
      setDeleting(null);
      invalidate();
    },
    onError: (e) => error(e instanceof ApiError ? e.message : 'Delete failed'),
  });

  const reorderMutation = useMutation({
    mutationFn: (items: { id: string; position: number }[]) => api.post('/admin/banners/reorder', { items }),
    onSuccess: invalidate,
    onError: (e) => error(e instanceof ApiError ? e.message : 'Reorder failed'),
  });

  function openCreate() {
    setForm({ ...EMPTY });
    setEditing(null);
    setCreating(true);
  }
  function openEdit(b: Banner) {
    setForm({
      title: b.title || '',
      subtitle: b.subtitle || '',
      ctaLabel: b.ctaLabel || '',
      ctaUrl: b.ctaUrl || '',
      mediaUrl: b.mediaUrl,
      mediaType: b.mediaType,
      intervalSeconds: b.intervalSeconds,
      isActive: b.isActive,
    });
    setEditing(b);
    setCreating(true);
  }
  function close() {
    setCreating(false);
    setEditing(null);
  }

  function move(index: number, dir: -1 | 1) {
    if (!data || reorderMutation.isPending) return; // ignore double-clicks mid-request
    const target = index + dir;
    if (target < 0 || target >= data.length) return;
    const reordered = [...data];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    reorderMutation.mutate(reordered.map((b, i) => ({ id: b.id, position: i })));
  }

  return (
    <div>
      <PageHeader
        title="Hero Display Manager"
        description="Upload images/videos, reorder slides and control transition intervals."
        actions={
          <button className="btn-primary" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add slide
          </button>
        }
      />

      {isLoading ? (
        <CardSkeleton count={3} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : !data?.length ? (
        <EmptyState title="No slides yet" description="Add your first hero slide to get started." action={<button className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> Add slide</button>} />
      ) : (
        <div className="space-y-3">
          {data.map((b, i) => (
            <div key={b.id} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-1">
                  <button className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30" disabled={i === data.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex h-16 w-28 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                  {b.mediaType === 'video' ? (
                    <video src={mediaSrc(b.mediaUrl)} className="h-full w-full object-cover" muted />
                  ) : b.mediaUrl ? (
                    <img src={mediaSrc(b.mediaUrl)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-slate-300" />
                  )}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="badge bg-slate-100 text-slate-600">
                    {b.mediaType === 'video' ? <Video className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />} {b.mediaType}
                  </span>
                  {b.isActive ? <span className="badge bg-green-100 text-green-700">Active</span> : <span className="badge bg-slate-100 text-slate-500">Hidden</span>}
                  <span className="text-xs text-slate-400">{(b.intervalSeconds / 1000).toFixed(1)}s</span>
                </div>
                <p className="mt-1 truncate font-semibold text-slate-800">{b.title || 'Untitled slide'}</p>
                <p className="truncate text-sm text-slate-500">{b.subtitle}</p>
              </div>
              <div className="flex items-center gap-1">
                <button className="btn-ghost" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /> Edit</button>
                <button className="btn-ghost text-red-600 hover:bg-red-50" onClick={() => setDeleting(b)}><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={creating}
        onClose={close}
        title={editing ? 'Edit slide' : 'Add slide'}
        size="lg"
        footer={
          <>
            <button className="btn-outline" onClick={close}>Cancel</button>
            <button className="btn-primary" disabled={!form.mediaUrl || saveMutation.isPending} onClick={() => saveMutation.mutate({ ...form, ...(editing ? { id: editing.id } : {}) } as never)}>
              {saveMutation.isPending ? 'Saving…' : 'Save slide'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Hero media" required>
            <ImageUploader
              value={form.mediaUrl}
              onChange={(url) => setForm((f) => ({ ...f, mediaUrl: url, mediaType: /\.(mp4|webm|mov)(\?|$)/i.test(url) ? 'video' : 'image' }))}
              preset={MEDIA_PRESETS.hero}
              label="Upload image or video"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title"><input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></Field>
            <Field label="Subtitle"><input className="input" value={form.subtitle} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} /></Field>
            <Field label="CTA Label"><input className="input" value={form.ctaLabel} onChange={(e) => setForm((f) => ({ ...f, ctaLabel: e.target.value }))} placeholder="Explore Products" /></Field>
            <Field label="CTA URL"><input className="input" value={form.ctaUrl} onChange={(e) => setForm((f) => ({ ...f, ctaUrl: e.target.value }))} placeholder="/products" /></Field>
            <Field label="Interval (ms)" hint="2000–60000, e.g. 5000 = 5s">
              <input type="number" min={2000} max={60000} step={500} className="input" value={form.intervalSeconds} onChange={(e) => setForm((f) => ({ ...f, intervalSeconds: Number(e.target.value) }))} />
            </Field>
            <div className="flex items-end pb-2"><Switch checked={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} label="Active (visible on site)" /></div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete slide"
        message={`Delete "${deleting?.title || 'this slide'}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
