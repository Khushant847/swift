import { MapPin, Phone, Printer, Smartphone, Mail, Clock, ExternalLink } from 'lucide-react';
import type { CompanyInfo } from '@/lib/types';
import { SectionHeading } from './SectionHeading';

const DEFAULT_MAP_EMBED =
  'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3507.0392095368383!2d77.29831107577516!3d28.464721175756417!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x390ce748b9baf007%3A0xb5aa7b031a74731b!2sSwift%20Instruments!5e0!3m2!1sen!2sin!4v1730000000000!5m2!1sen!2sin';
const DEFAULT_MAP_URL = 'https://maps.app.goo.gl/QUJr22r9AgJa585Y9';

export function AddressMap({ company }: { company: CompanyInfo }) {
  const mapEmbed = company.map_embed || DEFAULT_MAP_EMBED;
  const mapUrl = company.map_url || DEFAULT_MAP_URL;

  const details = [
    { icon: MapPin, label: 'Address', value: company.address, href: mapUrl, external: true },
    { icon: Phone, label: 'Phone', value: company.phone, href: `tel:${company.phone}` },
    { icon: Printer, label: 'Fax', value: company.fax, href: undefined },
    { icon: Smartphone, label: 'Mobile', value: company.mobile, href: `tel:${company.mobile}` },
    { icon: Mail, label: 'Email', value: company.email, href: `mailto:${company.email}` },
    { icon: Clock, label: 'Working Hours', value: company.working_hours || 'Mon – Sat · 9:30 AM – 6:00 PM' },
  ].filter((d) => d.value);

  return (
    <section className="section bg-slate-50">
      <div className="container-page">
        <SectionHeading
          eyebrow="Visit Us"
          title="Our address & location"
          description="Conveniently located in Green Field Colony, Faridabad (NCR-Delhi)."
        />
        <div className="mt-12 grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="card h-full p-6 sm:p-8">
              <h3 className="font-display text-lg font-semibold text-slate-900">
                {company.company_name || 'Swift Instruments'}
              </h3>
              <ul className="mt-6 space-y-5">
                {details.map((d) => (
                  <li key={d.label} className="flex gap-4">
                    <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-800">
                      <d.icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{d.label}</p>
                      {d.href ? (
                        <a
                          href={d.href}
                          target={d.external ? '_blank' : undefined}
                          rel={d.external ? 'noopener noreferrer' : undefined}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-brand-800"
                        >
                          <span>{d.value}</span>
                          {d.external && <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                        </a>
                      ) : (
                        <p className="text-sm font-medium text-slate-700">{d.value}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="lg:col-span-3">
            <div className="card flex h-full min-h-[380px] flex-col overflow-hidden">
              <div className="relative min-h-[340px] flex-1">
                {mapEmbed ? (
                  <iframe
                    title="Swift Instruments location"
                    src={mapEmbed}
                    className="h-full min-h-[340px] w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-slate-100 text-slate-400">
                    Map unavailable
                  </div>
                )}
              </div>
              {mapUrl && (
                <div className="flex items-center justify-between border-t border-slate-100 bg-white px-4 py-2.5 text-xs">
                  <span className="text-slate-500">Green Field Colony, Faridabad</span>
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-brand-800 hover:text-brand-900 hover:underline"
                  >
                    Open in Google Maps <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
