import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, ShieldCheck, Trash2, UserCog } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { AdminUser, Role } from '../lib/types';
import { PageHeader, TableSkeleton, EmptyState, ErrorState } from '../components/ui/Feedback';
import { Field, Switch } from '../components/ui/Form';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../lib/auth';
import { formatDateShort, initials } from '../lib/utils';

const EMPTY = { username: '', email: '', password: '', role: 'content_editor' as Role, isActive: true };

export function UsersPage() {
  const qc = useQueryClient();
  const { admin: me } = useAuth();
  const { success, error } = useToast();
  const [form, setForm] = useState<typeof EMPTY>({ ...EMPTY });
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['users'], queryFn: () => api.get<AdminUser[]>('/admin/users') });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['users'] });

  const saveMutation = useMutation({
    mutationFn: (payload: typeof EMPTY & { id?: string }) => {
      if (payload.id) {
        const body: Record<string, unknown> = { username: payload.username, email: payload.email, role: payload.role, isActive: payload.isActive };
        if (payload.password) body.password = payload.password;
        return api.put(`/admin/users/${payload.id}`, body);
      }
      return api.post('/admin/users', payload);
    },
    onSuccess: () => { success('User saved'); setOpen(false); invalidate(); },
    onError: (e) => error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/admin/users/${id}`),
    onSuccess: () => { success('User deleted'); setDeleting(null); invalidate(); },
    onError: (e) => error(e instanceof ApiError ? e.message : 'Delete failed'),
  });

  return (
    <div>
      <PageHeader
        title="Admin Users"
        description="Role-based access control for the admin console."
        actions={<button className="btn-primary" onClick={() => { setForm({ ...EMPTY }); setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Add user</button>}
      />

      {isLoading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : !data?.length ? (
        <EmptyState title="No users" description="Add admin users to collaborate." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="th">User</th>
                  <th className="th">Role</th>
                  <th className="th">MFA</th>
                  <th className="th">Status</th>
                  <th className="th">Last login</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-800 text-xs font-bold text-white">{initials(u.username)}</span>
                        <div>
                          <p className="font-medium text-slate-800">{u.username} {u.id === me?.id ? <span className="text-xs text-slate-400">(you)</span> : null}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="td capitalize">{u.role.replace('_', ' ')}</td>
                    <td className="td">{u.mfaEnabled ? <ShieldCheck className="h-4 w-4 text-green-600" /> : <span className="text-xs text-slate-400">Off</span>}</td>
                    <td className="td">{u.isActive ? <span className="badge bg-green-100 text-green-700">Active</span> : <span className="badge bg-slate-100 text-slate-500">Disabled</span>}</td>
                    <td className="td text-slate-500">{formatDateShort(u.lastLoginAt)}</td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        <button className="btn-ghost" onClick={() => { setForm({ username: u.username, email: u.email, password: '', role: u.role, isActive: u.isActive ?? true }); setEditing(u); setOpen(true); }}><Pencil className="h-4 w-4" /></button>
                        <button className="btn-ghost text-red-600 hover:bg-red-50 disabled:opacity-30" disabled={u.id === me?.id} onClick={() => setDeleting(u)}><Trash2 className="h-4 w-4" /></button>
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
        title={editing ? 'Edit user' : 'Add user'}
        footer={
          <>
            <button className="btn-outline" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={!form.username || !form.email || saveMutation.isPending || (!editing && form.password.length < 8)} onClick={() => saveMutation.mutate({ ...form, ...(editing ? { id: editing.id } : {}) } as never)}>
              {saveMutation.isPending ? 'Saving…' : 'Save user'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Full name" required><input className="input" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} /></Field>
          <Field label="Email" required><input type="email" className="input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></Field>
          <Field label={editing ? 'New password (leave blank to keep)' : 'Password'} required={!editing} hint="Minimum 8 characters">
            <input type="password" className="input" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
          </Field>
          <Field label="Role">
            <select className="input" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}>
              <option value="content_editor">Content Editor</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </Field>
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            <UserCog className="h-4 w-4" /> Super Admins can manage users, settings and backups.
          </div>
          <Switch checked={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} label="Active" />
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} title="Delete user" message={`Delete "${deleting?.username}"? They will lose access immediately.`} loading={deleteMutation.isPending} onClose={() => setDeleting(null)} onConfirm={() => deleting && deleteMutation.mutate(deleting.id)} />
    </div>
  );
}
