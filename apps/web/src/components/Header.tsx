'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Phone, Mail, MapPin, Scale, ShieldCheck } from 'lucide-react';
import type { CompanyInfo, NavLink } from '@/lib/types';
import { cn, mediaUrl } from '@/lib/utils';
import { SafeImage } from './SafeImage';

function Certifications({ raw }: { raw?: string }) {
  // Never invent credentials when the CMS has none: an empty list simply
  // hides the badge row.
  const certs = (() => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === 'string' && c.trim() !== '') : [];
    } catch {
      return [];
    }
  })();
  if (!certs.length) return null;
  return (
    <div className="hidden items-center gap-2 xl:flex">
      {certs.map((c: string) => (
        <span
          key={c}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600"
          title={c}
        >
          <ShieldCheck className="h-3 w-3 text-brand-700" />
          {c}
        </span>
      ))}
    </div>
  );
}

export function Header({ nav, company }: { nav: NavLink[]; company: CompanyInfo }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  const logo = company.logo_url || company.logo;

  return (
    <header className="sticky top-0 z-40 w-full">
      {/* Utility bar */}
      <div className="hidden bg-brand-950 text-white md:block">
        <div className="container-page flex h-9 items-center justify-between text-xs">
          <div className="flex items-center gap-5">
            {company.phone ? (
              <a href={`tel:${company.phone.replace(/\s+/g, '')}`} className="flex items-center gap-1.5 hover:text-accent-300">
                <Phone className="h-3.5 w-3.5" /> {company.phone}
              </a>
            ) : null}
            {company.email ? (
              <a href={`mailto:${company.email}`} className="flex items-center gap-1.5 hover:text-accent-300">
                <Mail className="h-3.5 w-3.5" /> {company.email}
              </a>
            ) : null}
          </div>
          <a
            href={company.map_url || 'https://maps.app.goo.gl/QUJr22r9AgJa585Y9'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-slate-300 transition hover:text-accent-300"
            title="Open in Google Maps"
          >
            <MapPin className="h-3.5 w-3.5" />
            <span className="truncate">Greenfield, Faridabad (Haryana) — NCR Delhi</span>
          </a>
        </div>
      </div>

      {/* Main bar */}
      <div
        className={cn(
          'border-b border-slate-100 bg-white/95 backdrop-blur transition-shadow',
          scrolled && 'shadow-card',
        )}
      >
        <div className="container-page flex h-16 items-center justify-between gap-4 lg:h-20">
          <Link href="/" className="flex items-center gap-3" aria-label="Swift Instruments home">
            <SafeImage
              src={mediaUrl(logo)}
              alt="Swift Instruments"
              className="h-10 w-auto max-w-[150px] object-contain lg:h-12 lg:max-w-[190px]"
              fallback={
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-800 text-white lg:h-12 lg:w-12">
                  <Scale className="h-6 w-6 lg:h-7 lg:w-7" />
                </span>
              }
            />
            <span className="flex flex-col leading-none">
              <span className="font-display text-lg font-bold tracking-tight text-brand-900 lg:text-xl">
                {company.company_name || 'Swift Instruments'}
              </span>
              <span className="mt-0.5 hidden text-[11px] font-medium uppercase tracking-wider text-accent-600 sm:block">
                Precision Measurement Since 1994
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
            {nav.map((link) => {
              const active = pathname === link.url || (link.url !== '/' && pathname.startsWith(link.url));
              return (
                <Link
                  key={link.id}
                  href={link.url}
                  className={cn(
                    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    active ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-50 hover:text-brand-800',
                  )}
                >
                  {link.title}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <Certifications raw={company.certifications} />
            <Link href="/contact" className="btn-primary hidden md:inline-flex">
              Get a Quote
            </Link>
            <button
              type="button"
              ref={toggleRef}
              onClick={() => setOpen((v) => !v)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 lg:hidden"
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              aria-controls="mobile-nav"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <div
          className={cn(
            'overflow-hidden border-t border-slate-100 bg-white transition-[max-height] duration-300 lg:hidden',
            open ? 'max-h-[26rem]' : 'max-h-0',
          )}
          // Closed menu must be out of the tab order / a11y tree while the
          // max-height animation stays intact.
          inert={!open}
        >
          <nav
            id="mobile-nav"
            className="container-page flex flex-col py-3"
            aria-label="Mobile"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOpen(false);
                toggleRef.current?.focus();
              }
            }}
          >
            {nav.map((link) => (
              <Link
                key={link.id}
                href={link.url}
                className="rounded-lg px-3 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-brand-800"
              >
                {link.title}
              </Link>
            ))}
            <Link href="/contact" className="btn-primary mt-2">
              Get a Quote
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
