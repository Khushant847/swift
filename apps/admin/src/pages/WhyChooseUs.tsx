import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { WhyItem } from '../lib/types';
import { PageHeader, CardSkeleton, EmptyState, ErrorState } from '../components/ui/Feedback';
import { Field, Switch } from '../components/ui/Form';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';

const ICONS = ['BadgeCheck', 'ShieldCheck', 'Gauge', 'Award', 'Truck', 'Wrench', 'Headset', 'Users', 'Factory', 'FlaskConical', 'Microscope', 'Rocket', 'Sparkles', 'Cog', 'Leaf', 'Building2', 'Scale'];

const EMPTY = { title: '', description: '', icon: 'BadgeCheck', isActive: true };

export function WhyChooseUsPage() {
  const qc = useQueryClient();
  const { success, error } = useToast();
  const [form, setForm] = useState<typeof EMPTY>({ ...EMPTY });
  const [editing, setEditing] = useState<WhyItem | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<WhyItem | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['why'], queryFn: () => api.get<WhyItem[]>('/admin/why-choose-us') });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['why'] });

  const saveMutation = useMutation({
    mutationFn: (payload: typeof EMPTY & { id?: string; displayOrder?: number }) =>
      payload.id ? api.put(`/admin/why-choose-us/${payload.id}`, payload) : api.post('/admin/why-choose-us', { ...payload, displayOrder: data?.length ?? 0 }),
    onSuccess: () => { success('Saved'); setOpen(false); invalidate(); },
    onError: (e) => error(e instanceof ApiError ? e.message : 'Save failed'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/admin/why-choose-us/${id}`),
    onSuccess: () => { success('Deleted'); setDeleting(null); invalidate(); },
    onError: (e) => error(e instanceof ApiError ? e.message : 'Delete failed'),
  });

  return (
    <div>
      <PageHeader
        title="Why Choose Us"
        description="Highlight your unique selling points with icons and descriptions."
        actions={<button className="btn-primary" onClick={() => { setForm({ ...EMPTY }); setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Add USP</button>}
      />

      {isLoading ? (
        <CardSkeleton count={6} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : !data?.length ? (
        <EmptyState title="No USP points" description="Add points that set you apart from competitors." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((item) => (
            <div key={item.id} className="card p-5">
              <div className="flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-800">
                  <BadgeCheck className="h-5 w-5" />
                </span>
                {item.isActive ? <span className="badge bg-green-100 text-green-700">Active</span> : <span className="badge bg-slate-100 text-slate-500">Hidden</span>}
              </div>
              <h3 className="mt-4 font-semibold text-slate-800">{item.title}</h3>
              <p className="mt-1 line-clamp-3 text-sm text-slate-500">{item.description}</p>
              <p className="mt-2 text-xs text-slate-400">Icon: {item.icon}</p>
              <div className="mt-4 flex gap-1">
                <button className="btn-ghost" onClick={() => { setForm({ title: item.title, description: item.description, icon: item.icon, isActive: item.isActive }); setEditing(item); setOpen(true); }}><Pencil className="h-4 w-4" /> Edit</button>
                <button className="btn-ghost text-red-600 hover:bg-red-50" onClick={() => setDeleting(item)}><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit USP' : 'Add USP'}
        footer={
          <>
            <button className="btn-outline" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={!form.title || !form.description || saveMutation.isPending} onClick={() => saveMutation.mutate({ ...form, ...(editing ? { id: editing.id } : {}) } as never)}>
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Title" required><input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></Field>
          <Field label="Description" required><textarea className="input min-h-[100px]" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
          <Field label="Icon" hint="Lucide icon name">
            <select className="input" value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}>
              {ICONS.map((i) => (<option key={i} value={i}>{i}</option>))}
            </select>
          </Field>
          <Switch checked={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} label="Active" />
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} title="Delete USP" message={`Delete "${deleting?.title}"?`} loading={deleteMutation.isPending} onClose={() => setDeleting(null)} onConfirm={() => deleting && deleteMutation.mutate(deleting.id)} />
    </div>
  );
}
