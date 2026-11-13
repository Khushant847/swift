import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search, ScrollText } from 'lucide-react';
import { api, qs } from '../lib/api';
import type { AuditEntry, Paginated } from '../lib/types';
import { PageHeader, TableSkeleton, EmptyState, ErrorState, Pagination } from '../components/ui/Feedback';
import { formatDate, ACTION_STYLES } from '../lib/utils';

export function AuditPage() {
  const [action, setAction] = useState('all');
  const [entity, setEntity] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['audit', action, entity, debouncedSearch, page],
    queryFn: () => api.get<Paginated<AuditEntry>>(`/admin/audit${qs({ action, entity, search: debouncedSearch, page, limit: 30 })}`),
    placeholderData: keepPreviousData,
  });

  const items = data?.items ?? [];

  return (
    <div>
      <PageHeader title="Audit Logs" description="A tamper-evident trail of every content and configuration change." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search actor, entity, details…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input sm:max-w-[160px]" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
          {['all', 'create', 'update', 'delete', 'login', 'logout', 'config', 'upload', 'export'].map((a) => (<option key={a} value={a}>{a === 'all' ? 'All actions' : a}</option>))}
        </select>
        <select className="input sm:max-w-[180px]" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }}>
          {['all', 'product', 'banner', 'gallery', 'enquiry', 'review', 'nav', 'admin', 'media', 'settings', 'company-info', 'auth', 'mfa', 'backup', 'why', 'upcoming', 'password'].map((en) => (<option key={en} value={en}>{en === 'all' ? 'All entities' : en}</option>))}
        </select>
      </div>

      {isLoading ? (
        <TableSkeleton rows={10} cols={5} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : !items.length ? (
        <EmptyState title="No audit entries" description="Activity will be recorded as admins make changes." icon={<ScrollText className="h-6 w-6" />} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="th">When</th>
                  <th className="th">Actor</th>
                  <th className="th">Action</th>
                  <th className="th">Entity</th>
                  <th className="th">Details</th>
                  <th className="th">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="td whitespace-nowrap text-slate-500">{formatDate(a.createdAt)}</td>
                    <td className="td text-slate-700">{a.adminEmail}</td>
                    <td className="td"><span className={`badge ${ACTION_STYLES[a.action] ?? 'bg-slate-100 text-slate-600'}`}>{a.action}</span></td>
                    <td className="td font-medium text-slate-700">{a.entity}{a.entityId ? <span className="ml-1 text-xs text-slate-400">#{a.entityId.slice(0, 6)}</span> : null}</td>
                    <td className="td max-w-xs"><p className="truncate text-xs text-slate-500" title={a.details || ''}>{a.details || '—'}</p></td>
                    <td className="td text-xs text-slate-400">{a.ipAddress || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data?.page ?? 1} pageSize={data?.pageSize ?? 30} total={data?.total ?? 0} onPage={setPage} />
        </div>
      )}
    </div>
  );
}
