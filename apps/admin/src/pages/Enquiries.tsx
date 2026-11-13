import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Inbox, Mail, Phone, Search, Trash2 } from 'lucide-react';
import { api, ApiError, downloadFile, qs } from '../lib/api';
import type { Enquiry, Paginated } from '../lib/types';
import { PageHeader, TableSkeleton, EmptyState, Pagination } from '../components/ui/Feedback';
import { Field } from '../components/ui/Form';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { formatDate, STATUS_STYLES, cn } from '../lib/utils';

export function EnquiriesPage() {
  const qc = useQueryClient();
  const { success, error } = useToast();
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<Enquiry | null>(null);
  const [notes, setNotes] = useState('');
  const [bulkDelete, setBulkDelete] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['enquiries', status, debouncedSearch, page],
    queryFn: () => api.get<Paginated<Enquiry>>(`/admin/enquiries${qs({ status, search: debouncedSearch, page, limit: 20 })}`),
    placeholderData: keepPreviousData,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['enquiries'] });

  // If the current page emptied (e.g. bulk-deleted the last rows of page 2),
  // clamp back to the last page that still has data instead of dead-ending.
  const lastPage = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 20)));
  useEffect(() => {
    if (data && page > lastPage) setPage(lastPage);
  }, [data, page, lastPage]);

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.patch(`/admin/enquiries/${id}`, body),
    onSuccess: (_r, v) => {
      // Only the "Save note" action closes the modal; changing status from the
      // dropdown must keep it open so follow-up notes aren't discarded.
      if (v.body && 'notes' in v.body) setDetail(null);
      success('Enquiry updated');
      invalidate();
    },
    onError: (e) => error(e instanceof ApiError ? e.message : 'Update failed'),
  });
  const bulkMutation = useMutation({
    mutationFn: (body: { ids: string[]; status?: string; action: 'status' | 'delete' }) => api.post('/admin/enquiries/bulk', body),
    onSuccess: (_r, v) => { success(v.action === 'delete' ? 'Enquiries deleted' : 'Status updated'); setSelected([]); setBulkDelete(false); invalidate(); },
    onError: (e) => { error(e instanceof ApiError ? e.message : 'Bulk action failed'); setBulkDelete(false); },
  });

  const items = data?.items ?? [];
  const allSelected = items.length > 0 && selected.length === items.length;

  function toggleAll() {
    setSelected(allSelected ? [] : items.map((i) => i.id));
  }
  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function handleExport() {
    try {
      await downloadFile(`/admin/enquiries/export${qs({ status, search })}`, `swift-enquiries-${Date.now()}.csv`);
      success('CSV exported');
    } catch (e) {
      error(e instanceof ApiError ? e.message : 'Export failed');
    }
  }

  return (
    <div>
      <PageHeader
        title="Enquiries CRM"
        description="Track, filter and export your sales leads."
        actions={<button className="btn-outline" onClick={handleExport}><Download className="h-4 w-4" /> Export CSV</button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          {['all', 'new', 'contacted', 'closed'].map((s) => (
            <button key={s} onClick={() => { setStatus(s); setPage(1); }} className={cn('rounded-md px-3.5 py-1.5 text-sm font-medium capitalize transition', status === s ? 'bg-brand-800 text-white' : 'text-slate-600 hover:bg-slate-50')}>
              {s}
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search leads…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      {selected.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm">
          <span className="font-medium text-brand-800">{selected.length} selected</span>
          <span className="mx-1 text-slate-300">|</span>
          <button className="btn-outline !px-3 !py-1" disabled={bulkMutation.isPending} onClick={() => bulkMutation.mutate({ ids: selected, status: 'contacted', action: 'status' })}>Mark contacted</button>
          <button className="btn-outline !px-3 !py-1" disabled={bulkMutation.isPending} onClick={() => bulkMutation.mutate({ ids: selected, status: 'closed', action: 'status' })}>Mark closed</button>
          <button className="btn-ghost !px-3 !py-1 text-red-600 hover:bg-red-50" onClick={() => setBulkDelete(true)}><Trash2 className="h-4 w-4" /> Delete</button>
        </div>
      ) : null}

      {isLoading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : isError ? (
        <EmptyState title="Could not load enquiries" description="The request failed — check your connection or sign in again." icon={<Inbox className="h-6 w-6" />} />
      ) : !items.length ? (
        <EmptyState title="No enquiries" description="New enquiries from the website will appear here." icon={<Inbox className="h-6 w-6" />} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="th w-10"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" /></th>
                  <th className="th">Contact</th>
                  <th className="th">Company</th>
                  <th className="th">Message</th>
                  <th className="th">Status</th>
                  <th className="th">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((e) => (
                  <tr key={e.id} className="cursor-pointer hover:bg-slate-50" onClick={() => { setDetail(e); setNotes(e.notes || ''); }}>
                    <td className="td" onClick={(ev) => ev.stopPropagation()}><input type="checkbox" checked={selected.includes(e.id)} onChange={() => toggle(e.id)} aria-label={`Select ${e.name}`} /></td>
                    <td className="td">
                      <p className="font-medium text-slate-800">{e.name}</p>
                      <p className="text-xs text-slate-400">{e.email}</p>
                      <p className="text-xs text-slate-400">{e.phone}</p>
                    </td>
                    <td className="td">{e.companyName || '—'}</td>
                    <td className="td max-w-xs"><p className="truncate text-slate-500">{e.message}</p></td>
                    <td className="td"><span className={`badge ${STATUS_STYLES[e.status] ?? 'bg-slate-100 text-slate-600'}`}>{e.status}</span></td>
                    <td className="td whitespace-nowrap text-slate-500">{formatDate(e.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data?.page ?? 1} pageSize={data?.pageSize ?? 20} total={data?.total ?? 0} onPage={setPage} />
        </div>
      )}

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Enquiry details"
        size="lg"
        footer={
          <>
            <button className="btn-outline" onClick={() => setDetail(null)}>Close</button>
            <button
              className="btn-primary"
              disabled={!detail || updateMutation.isPending}
              onClick={() => detail && updateMutation.mutate({ id: detail.id, body: { notes } })}
            >
              Save note
            </button>
          </>
        }
      >
        {detail ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><p className="text-xs uppercase text-slate-400">Name</p><p className="font-medium text-slate-800">{detail.name}</p></div>
              <div><p className="text-xs uppercase text-slate-400">Company</p><p className="font-medium text-slate-800">{detail.companyName || '—'}</p></div>
              <div>
                <p className="text-xs uppercase text-slate-400">Email</p>
                <a href={`mailto:${detail.email}`} className="flex items-center gap-1.5 font-medium text-brand-700 hover:underline"><Mail className="h-3.5 w-3.5" /> {detail.email}</a>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400">Phone</p>
                <a href={`tel:${detail.phone}`} className="flex items-center gap-1.5 font-medium text-brand-700 hover:underline"><Phone className="h-3.5 w-3.5" /> {detail.phone}</a>
              </div>
            </div>
            {detail.subject ? (<div><p className="text-xs uppercase text-slate-400">Subject</p><p className="font-medium text-slate-800">{detail.subject}</p></div>) : null}
            <div>
              <p className="text-xs uppercase text-slate-400">Message</p>
              <p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{detail.message}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Status">
                <select className="input" value={detail.status} onChange={(e) => { const s = e.target.value as Enquiry['status']; setDetail({ ...detail, status: s }); updateMutation.mutate({ id: detail.id, body: { status: s } }); }}>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="closed">Closed</option>
                </select>
              </Field>
              <div><p className="text-xs uppercase text-slate-400">Received</p><p className="font-medium text-slate-800">{formatDate(detail.createdAt)}</p></div>
            </div>
            <Field label="Internal notes"><textarea className="input min-h-[90px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add follow-up notes…" /></Field>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog open={bulkDelete} title="Delete enquiries" message={`Delete ${selected.length} selected enquir${selected.length === 1 ? 'y' : 'ies'}? This cannot be undone.`} loading={bulkMutation.isPending} onClose={() => setBulkDelete(false)} onConfirm={() => bulkMutation.mutate({ ids: selected, action: 'delete' })} />
    </div>
  );
}
