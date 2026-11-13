import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Images,
  Menu as MenuIcon,
  X,
  Scale,
  LogOut,
  Navigation,
  BadgeCheck,
  Package,
  Rocket,
  GalleryHorizontalEnd,
  Star,
  Building2,
  Inbox,
  FolderOpen,
  Users,
  ScrollText,
  Settings,
  Bell,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { cn, initials } from '../lib/utils';
import { useQuery } from '@tanstack/react-query';
import { api, mediaSrc } from '../lib/api';
import type { DashboardData } from '../lib/types';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  superOnly?: boolean;
}

const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'Content',
    items: [
      { to: '/banners', label: 'Hero Banners', icon: Images },
      { to: '/navigation', label: 'Navigation', icon: Navigation },
      { to: '/why-choose-us', label: 'Why Choose Us', icon: BadgeCheck },
      { to: '/products', label: 'Products & Services', icon: Package },
      { to: '/upcoming', label: 'Upcoming Products', icon: Rocket },
      { to: '/gallery', label: 'Gallery', icon: GalleryHorizontalEnd },
      { to: '/reviews', label: 'Reviews', icon: Star },
      { to: '/company', label: 'Company Info', icon: Building2 },
    ],
  },
  {
    title: 'CRM',
    items: [{ to: '/enquiries', label: 'Enquiries', icon: Inbox }],
  },
  {
    title: 'System',
    items: [
      { to: '/media', label: 'Media Library', icon: FolderOpen },
      { to: '/users', label: 'Admin Users', icon: Users, superOnly: true },
      { to: '/audit', label: 'Audit Logs', icon: ScrollText },
      { to: '/settings', label: 'Settings & Backup', icon: Settings },
    ],
  },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { admin } = useAuth();
  const { data: company } = useQuery({
    queryKey: ['company-info'],
    queryFn: () => api.get<Record<string, string>>('/admin/company-info'),
  });
  const [logoFailed, setLogoFailed] = useState(false);
  const logo = company?.logo_url || company?.logo;
  const companyName = company?.company_name || 'Swift Instruments';

  // A newly uploaded logo is a different URL; clear the previous failure so
  // the sidebar picks it up without a full page reload.
  useEffect(() => setLogoFailed(false), [logo]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
        {logo && !logoFailed ? (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 p-1 text-white overflow-hidden">
            <img
              src={mediaSrc(logo)}
              alt={companyName}
              className="h-full w-full object-contain"
              onError={() => setLogoFailed(true)}
            />
          </span>
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white">
            <Scale className="h-5 w-5" />
          </span>
        )}
        <div className="leading-tight min-w-0">
          <p className="truncate text-sm font-bold text-white">{companyName}</p>
          <p className="text-[11px] text-slate-400">Admin Console</p>
        </div>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {GROUPS.map((group) => {
          const items = group.items.filter((i) => !i.superOnly || admin?.role === 'super_admin');
          if (!items.length) return null;
          return (
            <div key={group.title}>
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{group.title}</p>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                        isActive ? 'bg-brand-600 text-white shadow' : 'text-slate-300 hover:bg-white/5 hover:text-white',
                      )
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-500 text-sm font-bold text-brand-950">
            {initials(admin?.username || 'A')}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{admin?.username}</p>
            <p className="truncate text-[11px] capitalize text-slate-400">{admin?.role.replace('_', ' ')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { admin, logout, sessionNotice, clearNotice } = useAuth();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardData>('/admin/dashboard'),
    refetchInterval: 60_000,
  });

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 bg-brand-950 lg:block">
        <div className="sticky top-0 h-screen">
          <SidebarContent />
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-brand-950 animate-fade-in">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {sessionNotice ? (
          <div className="flex items-center justify-between gap-3 bg-amber-100 px-4 py-2.5 text-sm text-amber-800">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> {sessionNotice}
            </span>
            <button type="button" className="rounded p-1 hover:bg-amber-200" onClick={clearNotice} aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <div className="hidden lg:block">
            <p className="text-sm text-slate-500">
              Welcome back, <span className="font-semibold text-slate-800">{admin?.username}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500">
                <Bell className="h-4 w-4" />
              </span>
              {data?.stats.newEnquiries ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {data.stats.newEnquiries}
                </span>
              ) : null}
            </div>
            <button type="button" className="btn-ghost" onClick={handleLogout}>
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
