import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { NavLink } from '../lib/types';
import { PageHeader, TableSkeleton, EmptyState, ErrorState } from '../components/ui/Feedback';
import { Field, Switch, Toolbar } from '../components/ui/Form';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { cn } from '../lib/utils';

const EMPTY = { title: '', url: '', location: 'header' as 'header' | 'footer', isActive: true };

export function NavigationPage() {
  const qc = useQueryClient();
  const { success, error } = useToast();
  const [location, setLocation] = useState<'header' | 'footer'>('header');
  const [form, setForm] = useState<typeof EMPTY>({ ...EMPTY });
  const [editing, setEditing] = useState<NavLink | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<NavLink | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['nav', location],
    queryFn: () => api.get<NavLink[]>(`/admin/nav?location=${location}`),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['nav'] });

  const saveMutation = useMutation({
    mutationFn: (payload: typeof EMPTY & { id?: string; position?: number }) =>
      payload.id ? api.put(`/admin/nav/${payload.id}`, payload) : api.post('/admin/nav', { ...payload, position: (data?.length ?? 0) }),
    onSuccess: () => { success('Link saved'); setOpen(false); invalidate(); },
    onError: (e) => error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/admin/nav/${id}`),
    onSuccess: () => { success('Link deleted'); setDeleting(null); invalidate(); },
    onError: (e) => error(e instanceof ApiError ? e.message : 'Delete failed'),
  });

  const reorderMutation = useMutation({
    mutationFn: (items: { id: string; position: number }[]) => api.post('/admin/nav/reorder', { items }),
    onSuccess: invalidate,
    onError: (e) => error(e instanceof ApiError ? e.message : 'Reorder failed'),
  });

  function move(index: number, dir: -1 | 1) {
    if (!data || reorderMutation.isPending) return; // ignore double-clicks mid-request
    const target = index + dir;
    if (target < 0 || target >= data.length) return;
    const reordered = [...data];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    reorderMutation.mutate(reordered.map((b, i) => ({ id: b.id, position: i })));
  }

  function openEdit(link: NavLink) {
    setForm({ title: link.title, url: link.url, location: link.location, isActive: link.isActive });
    setEditing(link);
    setOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Header Nav & Logo Manager"
        description="Manage navigation links for the header and footer, and their order."
        actions={<button className="btn-primary" onClick={() => { setForm({ ...EMPTY, location }); setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Add link</button>}
      />

      <Toolbar>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          {(['header', 'footer'] as const).map((loc) => (
            <button key={loc} onClick={() => setLocation(loc)} className={cn('rounded-md px-4 py-1.5 text-sm font-medium capitalize transition', location === loc ? 'bg-brand-800 text-white' : 'text-slate-600 hover:bg-slate-50')}>
              {loc}
            </button>
          ))}
        </div>
      </Toolbar>

      {isLoading ? (
        <TableSkeleton rows={6} cols={4} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : !data?.length ? (
        <EmptyState title={`No ${location} links`} description="Add navigation links to build your menu." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="th w-20">Order</th>
                  <th className="th">Title</th>
                  <th className="th">URL</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((link, i) => (
                  <tr key={link.id} className="hover:bg-slate-50">
                    <td className="td">
                      <div className="flex items-center gap-1">
                        <button className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="h-4 w-4" /></button>
                        <button className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30" disabled={i === data.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="h-4 w-4" /></button>
                      </div>
                    </td>
                    <td className="td font-medium text-slate-800">{link.title}</td>
                    <td className="td text-slate-500">{link.url}</td>
                    <td className="td">{link.isActive ? <span className="badge bg-green-100 text-green-700">Active</span> : <span className="badge bg-slate-100 text-slate-500">Hidden</span>}</td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        <button className="btn-ghost" onClick={() => openEdit(link)}><Pencil className="h-4 w-4" /></button>
                        <button className="btn-ghost text-red-600 hover:bg-red-50" onClick={() => setDeleting(link)}><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit link' : 'Add link'}
        footer={
          <>
            <button className="btn-outline" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={!form.title || !form.url || saveMutation.isPending} onClick={() => saveMutation.mutate({ ...form, ...(editing ? { id: editing.id } : {}) } as never)}>
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Title" required><input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></Field>
          <Field label="URL" required hint="e.g. /products or https://example.com"><input className="input" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} /></Field>
          <Field label="Location">
            <select className="input" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value as 'header' | 'footer' }))}>
              <option value="header">Header</option>
              <option value="footer">Footer</option>
            </select>
          </Field>
          <Switch checked={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} label="Active" />
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} title="Delete link" message={`Delete "${deleting?.title}"?`} loading={deleteMutation.isPending} onClose={() => setDeleting(null)} onConfirm={() => deleting && deleteMutation.mutate(deleting.id)} />
    </div>
  );
}
