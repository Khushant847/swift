import Link from 'next/link';
import { Facebook, Instagram, Linkedin, Mail, MapPin, Phone, Youtube, Scale, Twitter } from 'lucide-react';
import type { CompanyInfo, NavLink, PublicSettings } from '@/lib/types';
import { mediaUrl, parseSocialLinks } from '@/lib/utils';
import { SafeImage } from './SafeImage';

const ICONS: Record<string, typeof Linkedin> = { Linkedin, Facebook, Instagram, Youtube, Twitter };

export function Footer({
  nav,
  company,
  settings,
}: {
  nav: NavLink[];
  company: CompanyInfo;
  settings: PublicSettings;
}) {
  const socials = parseSocialLinks(settings.social_links);
  const year = new Date().getFullYear();
  const logo = company.logo_url || company.logo;

  return (
    <footer className="bg-brand-950 text-slate-300">
      <div className="container-page grid gap-10 py-14 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <Link href="/" className="flex items-center gap-3" aria-label="Swift Instruments home">
            <SafeImage
              src={mediaUrl(logo)}
              alt={company.company_name || 'Swift Instruments'}
              className="h-11 w-auto max-w-[140px] object-contain object-center rounded-lg bg-white/10 p-1"
              fallback={
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white">
                  <Scale className="h-6 w-6" />
                </span>
              }
            />
            <span className="font-display text-lg font-bold text-white">
              {company.company_name || 'Swift Instruments'}
            </span>
          </Link>
          <p className="mt-5 text-sm leading-relaxed text-slate-400">{settings.footer_text}</p>
          <div className="mt-6 flex items-center gap-3">
            {socials.map((s) => {
              const Icon = ICONS[s.icon] || Linkedin;
              return (
                <a
                  key={s.label}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-accent-500 hover:text-brand-950"
                >
                  <Icon className="h-4 w-4" />
                </a>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-white">Quick Links</h3>
          <ul className="mt-5 space-y-3 text-sm">
            {nav.map((l) => (
              <li key={l.id}>
                <Link href={l.url} className="transition hover:text-accent-300">
                  {l.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-white">Contact</h3>
          <address className="not-italic">
            <ul className="mt-5 space-y-4 text-sm">
              <li className="flex gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" />
                {company.map_url || company.address ? (
                  <a
                    href={company.map_url || 'https://maps.app.goo.gl/QUJr22r9AgJa585Y9'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 transition hover:text-white"
                    title="Open in Google Maps"
                  >
                    {company.address}
                  </a>
                ) : (
                  <span className="text-slate-400">{company.address}</span>
                )}
              </li>
              <li className="flex gap-3">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" />
                <span className="text-slate-400">
                  {company.phone}
                  {company.mobile ? ` · ${company.mobile}` : ''}
                </span>
              </li>
              {company.email ? (
                <li className="flex gap-3">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" />
                  <a href={`mailto:${company.email}`} className="text-slate-400 hover:text-accent-300">
                    {company.email}
                  </a>
                </li>
              ) : null}
            </ul>
          </address>
        </div>

        <div>
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-white">Get a Quote</h3>
          <p className="mt-5 text-sm text-slate-400">
            Looking for a specific instrument or bulk order? Our team is ready to help.
          </p>
          <Link href="/contact" className="btn-accent mt-5">
            Contact Sales
          </Link>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-3 py-6 text-xs text-slate-500 sm:flex-row">
          <p>{settings.copyright || `© ${year} Swift Instruments. All rights reserved.`}</p>
          <p className="text-center sm:text-right">{settings.legal_disclaimer}</p>
        </div>
      </div>
    </footer>
  );
}
