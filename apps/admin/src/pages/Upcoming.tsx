import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, ApiError, mediaSrc } from '../lib/api';
import type { UpcomingProduct } from '../lib/types';
import { PageHeader, CardSkeleton, EmptyState, ErrorState } from '../components/ui/Feedback';
import { Field, Switch } from '../components/ui/Form';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { ImageUploader } from '../components/ImageUploader';
import { MEDIA_PRESETS } from '../lib/mediaPresets';
import { useToast } from '../components/ui/Toast';

const EMPTY = { title: '', teaserDesc: '', expectedLaunch: 'Coming soon', imageUrl: '', isActive: true };

export function UpcomingPage() {
  const qc = useQueryClient();
  const { success, error } = useToast();
  const [form, setForm] = useState<typeof EMPTY>({ ...EMPTY });
  const [editing, setEditing] = useState<UpcomingProduct | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<UpcomingProduct | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['upcoming'], queryFn: () => api.get<UpcomingProduct[]>('/admin/upcoming') });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['upcoming'] });

  const saveMutation = useMutation({
    mutationFn: (payload: typeof EMPTY & { id?: string; displayOrder?: number }) =>
      payload.id ? api.put(`/admin/upcoming/${payload.id}`, payload) : api.post('/admin/upcoming', { ...payload, displayOrder: data?.length ?? 0 }),
    onSuccess: () => { success('Saved'); setOpen(false); invalidate(); },
    onError: (e) => error(e instanceof ApiError ? e.message : 'Save failed'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/admin/upcoming/${id}`),
    onSuccess: () => { success('Deleted'); setDeleting(null); invalidate(); },
    onError: (e) => error(e instanceof ApiError ? e.message : 'Delete failed'),
  });

  return (
    <div>
      <PageHeader
        title="Upcoming Products"
        description="R&D teaser cards for products currently under development."
        actions={<button className="btn-primary" onClick={() => { setForm({ ...EMPTY }); setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Add teaser</button>}
      />

      {isLoading ? (
        <CardSkeleton count={3} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : !data?.length ? (
        <EmptyState title="No upcoming products" description="Add teasers to build anticipation." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((item) => (
            <div key={item.id} className="card overflow-hidden">
              <div className="relative aspect-video bg-slate-100">
                {item.imageUrl ? (
                  <img src={mediaSrc(item.imageUrl)} alt="" className="h-full w-full object-cover" />
                ) : null}
                <span className="absolute right-2 top-2 badge bg-accent-500 text-brand-950"><CalendarClock className="h-3 w-3" /> {item.expectedLaunch}</span>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-800">{item.title}</h3>
                  {!item.isActive ? <span className="badge bg-slate-100 text-slate-500">Hidden</span> : null}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{item.teaserDesc}</p>
                <div className="mt-3 flex gap-1">
                  <button className="btn-ghost" onClick={() => { setForm({ title: item.title, teaserDesc: item.teaserDesc, expectedLaunch: item.expectedLaunch, imageUrl: item.imageUrl || '', isActive: item.isActive }); setEditing(item); setOpen(true); }}><Pencil className="h-4 w-4" /> Edit</button>
                  <button className="btn-ghost text-red-600 hover:bg-red-50" onClick={() => setDeleting(item)}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit teaser' : 'Add teaser'}
        size="lg"
        footer={
          <>
            <button className="btn-outline" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={!form.title || !form.teaserDesc || saveMutation.isPending} onClick={() => saveMutation.mutate({ ...form, ...(editing ? { id: editing.id } : {}) } as never)}>
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Title" required><input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></Field>
          <Field label="Teaser Description" required><textarea className="input min-h-[100px]" value={form.teaserDesc} onChange={(e) => setForm((f) => ({ ...f, teaserDesc: e.target.value }))} /></Field>
          <Field label="Expected Launch"><input className="input" value={form.expectedLaunch} onChange={(e) => setForm((f) => ({ ...f, expectedLaunch: e.target.value }))} placeholder="Q2 2026" /></Field>
          <Field label="Concept Visual"><ImageUploader value={form.imageUrl} onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))} preset={MEDIA_PRESETS.upcoming} /></Field>
          <Switch checked={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} label="Active" />
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} title="Delete teaser" message={`Delete "${deleting?.title}"?`} loading={deleteMutation.isPending} onClose={() => setDeleting(null)} onConfirm={() => deleting && deleteMutation.mutate(deleting.id)} />
    </div>
  );
}
