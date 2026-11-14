import Image from 'next/image';
import { Award, Calendar, Factory, Users } from 'lucide-react';
import type { CompanyInfo } from '@/lib/types';
import { mediaUrl } from '@/lib/utils';
import { SectionHeading } from './SectionHeading';

export function AboutCompany({ company }: { company: CompanyInfo }) {
  // Show only values present in the CMS. Inventing fallback stats or
  // certifications damages trust and can breach advertising guidelines.
  const certification = (() => {
    try {
      const parsed = JSON.parse(company.certifications || '[]');
      return Array.isArray(parsed) ? parsed.find((c): c is string => typeof c === 'string' && c.trim() !== '') : undefined;
    } catch {
      return undefined;
    }
  })();

  const stats = [
    { icon: Calendar, label: 'Established', value: company.established_year || '—' },
    { icon: Users, label: 'Team Members', value: company.employees || '—' },
    { icon: Factory, label: 'Installations', value: company.installations || '—' },
    { icon: Award, label: 'Certification', value: certification || '—' },
  ];

  return (
    <section id="about" className="section bg-white">
      <div className="container-page">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="relative">
            <div className="relative aspect-[4/5] w-full max-w-md overflow-hidden rounded-3xl bg-slate-100 shadow-soft">
              {company.founder_photo ? (
                <Image
                  src={mediaUrl(company.founder_photo) || ''}
                  alt={company.founder_name || 'Founder'}
                  fill
                  sizes="(max-width: 1024px) 90vw, 400px"
                  className="object-cover object-center"
                  // Uploaded media is already served in its final format by the
                  // backend (Blob/local with immutable caching). The Next image
                  // optimizer isn't routed in Vercel services mode, so optimising
                  // here would 404 and leave the founder photo blank.
                  unoptimized
                />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-300">Founder</div>
              )}
            </div>
            {company.founder_name ? (
              <div className="absolute -bottom-5 left-4 right-4 max-w-md rounded-2xl border border-slate-100 bg-white p-4 shadow-card sm:left-auto sm:-right-4 sm:w-72">
                <p className="font-display text-base font-bold text-brand-900">{company.founder_name}</p>
                <p className="text-sm text-slate-500">{company.founder_title || 'Founder'}</p>
              </div>
            ) : null}
          </div>

          <div>
            <SectionHeading
              align="left"
              eyebrow="About the Company"
              title="Three decades of precision engineering"
              description={company.tagline}
            />
            <div
              className="prose prose-slate mt-6 max-w-none text-sm leading-relaxed text-slate-600 sm:text-base [&_p]:mb-4"
              dangerouslySetInnerHTML={{ __html: company.history || '' }}
            />
            <div className="mt-6 rounded-2xl border-l-4 border-accent-400 bg-slate-50 p-5">
              <p className="text-sm italic leading-relaxed text-slate-700">
                {company.founder_bio ? (
                  <span dangerouslySetInnerHTML={{ __html: company.founder_bio.replace(/<[^>]+>/g, ' ').slice(0, 320) + '…' }} />
                ) : (
                  'Precision, reliability and service — the principles our founder built this company on.'
                )}
              </p>
            </div>
            <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="rounded-xl border border-slate-100 bg-white p-4 text-center shadow-sm">
                  <s.icon className="mx-auto mb-2 h-5 w-5 text-brand-700" />
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{s.label}</dt>
                  <dd className="font-display text-lg font-bold text-slate-900">{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
