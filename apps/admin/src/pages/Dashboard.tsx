import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Inbox,
  Package,
  FolderOpen,
  Star,
  Images,
  Rocket,
  GalleryHorizontalEnd,
  Navigation,
  ArrowRight,
} from 'lucide-react';
import { api } from '../lib/api';
import type { DashboardData } from '../lib/types';
import { PageHeader, StatCard, TableSkeleton, ErrorState } from '../components/ui/Feedback';
import { formatDate, STATUS_STYLES, ACTION_STYLES } from '../lib/utils';

export function DashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardData>('/admin/dashboard'),
  });

  const maxTrend = Math.max(1, ...(data?.trend.map((t) => t.count) ?? [1]));

  // A failed dashboard query must not render as an all-zero dashboard.
  if (isError) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Real-time overview of your website content and enquiries." />
        <div className="mt-6">
          <ErrorState onRetry={refetch} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Dashboard" description="Real-time overview of your website content and enquiries." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Enquiries" value={data?.stats.totalEnquiries ?? 0} icon={<Inbox className="h-6 w-6" />} accent="brand" hint={`${data?.stats.newEnquiries ?? 0} new`} />
        <StatCard label="Active Products" value={data?.stats.activeProducts ?? 0} icon={<Package className="h-6 w-6" />} accent="green" hint={`${data?.stats.featuredProducts ?? 0} featured`} />
        <StatCard label="Media Assets" value={data?.stats.mediaCount ?? 0} icon={<FolderOpen className="h-6 w-6" />} accent="purple" />
        <StatCard label="Reviews" value={data?.stats.reviewCount ?? 0} icon={<Star className="h-6 w-6" />} accent="accent" />
        <StatCard label="Hero Banners" value={data?.stats.bannerCount ?? 0} icon={<Images className="h-6 w-6" />} accent="brand" />
        <StatCard label="Upcoming" value={data?.stats.upcomingCount ?? 0} icon={<Rocket className="h-6 w-6" />} accent="accent" />
        <StatCard label="Gallery Items" value={data?.stats.galleryCount ?? 0} icon={<GalleryHorizontalEnd className="h-6 w-6" />} accent="purple" />
        <StatCard label="Nav Links" value={data?.stats.navigationCount ?? 0} icon={<Navigation className="h-6 w-6" />} accent="green" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold text-slate-800">Enquiries — last 7 days</h2>
          {isLoading ? (
            <div className="h-48 animate-pulse rounded-lg bg-slate-100" />
          ) : (
            <div className="flex h-48 items-end justify-between gap-2">
              {data?.trend.map((t) => (
                <div key={t.date} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-brand-800 to-brand-500 transition-all"
                      style={{ height: `${(t.count / maxTrend) * 100}%`, minHeight: t.count ? '6px' : '2px' }}
                      title={`${t.count} enquiries`}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {new Date(t.date).toLocaleDateString('en-IN', { weekday: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Recent Activity</h2>
            <Link to="/audit" className="text-xs font-semibold text-brand-700 hover:underline">
              View all
            </Link>
          </div>
          <ul className="space-y-3">
            {data?.recentAudit.map((a) => (
              <li key={a.id} className="flex items-start gap-3 text-sm">
                <span className={`badge ${ACTION_STYLES[a.action] ?? 'bg-slate-100 text-slate-600'}`}>{a.action}</span>
                <div className="min-w-0">
                  <p className="truncate text-slate-700">
                    <span className="font-medium">{a.entity}</span> by {a.adminEmail}
                  </p>
                  <p className="text-xs text-slate-400">{formatDate(a.createdAt)}</p>
                </div>
              </li>
            ))}
            {!data?.recentAudit.length && <li className="text-sm text-slate-400">No activity yet.</li>}
          </ul>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Latest Enquiries</h2>
          <Link to="/enquiries" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
            Manage <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {isLoading ? (
          <TableSkeleton rows={4} cols={4} />
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    <th className="th">Name</th>
                    <th className="th">Company</th>
                    <th className="th">Status</th>
                    <th className="th">Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.recentEnquiries.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="td">
                        <p className="font-medium text-slate-800">{e.name}</p>
                        <p className="text-xs text-slate-400">{e.email}</p>
                      </td>
                      <td className="td">{e.companyName || '—'}</td>
                      <td className="td">
                        <span className={`badge ${STATUS_STYLES[e.status] ?? 'bg-slate-100 text-slate-600'}`}>{e.status}</span>
                      </td>
                      <td className="td text-slate-500">{formatDate(e.createdAt)}</td>
                    </tr>
                  ))}
                  {!data?.recentEnquiries.length && (
                    <tr>
                      <td className="td text-slate-400" colSpan={4}>
                        No enquiries yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
