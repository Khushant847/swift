import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Pencil, Plus, RefreshCw, Star, Trash2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { Review } from '../lib/types';
import { PageHeader, TableSkeleton, EmptyState, ErrorState } from '../components/ui/Feedback';
import { Field, Switch } from '../components/ui/Form';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { formatDateShort, cn } from '../lib/utils';

const EMPTY = { authorName: '', rating: 5, text: '', profilePhotoUrl: '', source: 'manual', isFeatured: true, isHidden: false };

export function ReviewsPage() {
  const qc = useQueryClient();
  const { success, error } = useToast();
  const [form, setForm] = useState<typeof EMPTY>({ ...EMPTY });
  const [editing, setEditing] = useState<Review | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Review | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['reviews'], queryFn: () => api.get<Review[]>('/admin/reviews') });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['reviews'] });

  const saveMutation = useMutation({
    mutationFn: (payload: typeof EMPTY & { id?: string }) =>
      payload.id ? api.put(`/admin/reviews/${payload.id}`, payload) : api.post('/admin/reviews', payload),
    onSuccess: () => { success('Saved'); setOpen(false); invalidate(); },
    onError: (e) => error(e instanceof ApiError ? e.message : 'Save failed'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/admin/reviews/${id}`),
    onSuccess: () => { success('Deleted'); setDeleting(null); invalidate(); },
    onError: (e) => error(e instanceof ApiError ? e.message : 'Delete failed'),
  });
  const toggleMutation = useMutation({
    mutationFn: (r: Review) => api.put(`/admin/reviews/${r.id}`, { isFeatured: !r.isFeatured }),
    onSuccess: invalidate,
    onError: (e) => error(e instanceof ApiError ? e.message : 'Update failed'),
  });
  const hideMutation = useMutation({
    mutationFn: (r: Review) => api.put(`/admin/reviews/${r.id}`, { isHidden: !r.isHidden }),
    onSuccess: invalidate,
    onError: (e) => error(e instanceof ApiError ? e.message : 'Update failed'),
  });
  const syncMutation = useMutation({
    mutationFn: () => api.post<{ synced: number; total: number }>('/admin/reviews/sync'),
    onSuccess: (r) => { success(`Synced ${r.synced} new review(s) (${r.total} found)`); invalidate(); },
    onError: (e) => error(e instanceof ApiError ? e.message : 'Sync failed'),
  });

  return (
    <div>
      <PageHeader
        title="Reviews & Ratings"
        description="Feature positive feedback, hide spam and sync from Google Places."
        actions={
          <>
            <button className="btn-outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
              <RefreshCw className={cn('h-4 w-4', syncMutation.isPending && 'animate-spin')} /> Sync Google
            </button>
            <button className="btn-primary" onClick={() => { setForm({ ...EMPTY }); setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Add review</button>
          </>
        }
      />

      {isLoading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : !data?.length ? (
        <EmptyState title="No reviews yet" description="Add reviews manually or sync from Google Places." />
      ) : (
        <div className="space-y-3">
          {data.map((r) => (
            <div key={r.id} className={cn('card flex flex-col gap-4 p-4 sm:flex-row sm:items-start', r.isHidden && 'opacity-60')}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-800 font-semibold text-white">
                {r.authorName.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-800">{r.authorName}</p>
                  <div className="flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={cn('h-3.5 w-3.5', i < r.rating ? 'fill-accent-400 text-accent-400' : 'text-slate-300')} />
                    ))}
                  </div>
                  <span className="badge bg-slate-100 text-slate-500">{r.source}</span>
                  {r.isFeatured ? <span className="badge bg-accent-400/20 text-accent-600">Featured</span> : null}
                  {r.isHidden ? <span className="badge bg-red-100 text-red-600">Hidden</span> : null}
                </div>
                <p className="mt-1.5 text-sm text-slate-600">{r.text}</p>
                <p className="mt-1 text-xs text-slate-400">{formatDateShort(r.reviewTime)}</p>
              </div>
              <div className="flex items-center gap-1">
                <button className="btn-ghost" title="Toggle featured" disabled={toggleMutation.isPending} onClick={() => toggleMutation.mutate(r)}><Star className={cn('h-4 w-4', r.isFeatured && 'fill-accent-400 text-accent-400')} /></button>
                <button className="btn-ghost" title="Hide/show" disabled={hideMutation.isPending} onClick={() => hideMutation.mutate(r)}>{r.isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
                <button className="btn-ghost" onClick={() => { setForm({ authorName: r.authorName, rating: r.rating, text: r.text, profilePhotoUrl: r.profilePhotoUrl || '', source: r.source, isFeatured: r.isFeatured, isHidden: r.isHidden }); setEditing(r); setOpen(true); }}><Pencil className="h-4 w-4" /></button>
                <button className="btn-ghost text-red-600 hover:bg-red-50" onClick={() => setDeleting(r)}><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit review' : 'Add review'}
        footer={
          <>
            <button className="btn-outline" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={!form.authorName || !form.text || saveMutation.isPending} onClick={() => saveMutation.mutate({ ...form, ...(editing ? { id: editing.id } : {}) } as never)}>
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Author Name" required><input className="input" value={form.authorName} onChange={(e) => setForm((f) => ({ ...f, authorName: e.target.value }))} /></Field>
            <Field label="Rating">
              <select className="input" value={form.rating} onChange={(e) => setForm((f) => ({ ...f, rating: Number(e.target.value) }))}>
                {[5, 4, 3, 2, 1].map((n) => (<option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>))}
              </select>
            </Field>
          </div>
          <Field label="Review Text" required><textarea className="input min-h-[100px]" value={form.text} onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))} /></Field>
          <div className="flex flex-wrap gap-6">
            <Switch checked={form.isFeatured} onChange={(v) => setForm((f) => ({ ...f, isFeatured: v }))} label="Featured" />
            <Switch checked={form.isHidden} onChange={(v) => setForm((f) => ({ ...f, isHidden: v }))} label="Hidden" />
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} title="Delete review" message={`Delete review by "${deleting?.authorName}"?`} loading={deleteMutation.isPending} onClose={() => setDeleting(null)} onConfirm={() => deleting && deleteMutation.mutate(deleting.id)} />
    </div>
  );
}
