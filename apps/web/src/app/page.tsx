import Link from 'next/link';
import { ArrowRight, PhoneCall } from 'lucide-react';
import {
  getBanners,
  getCompanyInfo,
  getFeaturedProducts,
  getGallery,
  getGalleryTags,
  getReviews,
  getUpcoming,
  getWhyChooseUs,
} from '@/lib/api';
import { HeroCarousel } from '@/components/HeroCarousel';
import { WhyChooseUs } from '@/components/WhyChooseUs';
import { FeaturedProducts } from '@/components/FeaturedProducts';
import { AboutCompany } from '@/components/AboutCompany';
import { AddressMap } from '@/components/AddressMap';
import { UpcomingProducts } from '@/components/UpcomingProducts';
import { GalleryGrid } from '@/components/GalleryGrid';
import { Reviews } from '@/components/Reviews';
import { EnquiryForm } from '@/components/EnquiryForm';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Swift Instruments — Precision Weighing & Measurement Solutions',
  description:
    'Swift Instruments supplies laboratory balances, industrial platform scales, moisture analysers and calibration services from Faridabad (NCR-Delhi), India.',
  path: '/',
  absoluteTitle: true,
});

export default async function HomePage() {
  const [banners, why, featured, company, upcoming, gallery, tags, reviews] = await Promise.all([
    getBanners(),
    getWhyChooseUs(),
    getFeaturedProducts(6),
    getCompanyInfo(),
    getUpcoming(),
    getGallery(),
    getGalleryTags(),
    getReviews(),
  ]);

  // API offline → company info falls back to {}; keep tel/mailto hrefs valid.
  const mobile = company.mobile || '+91 98103 25260';

  return (
    <>
      <HeroCarousel banners={banners} certifications={company.certifications} />
      <WhyChooseUs items={why} />
      <FeaturedProducts products={featured.items} />
      <AboutCompany company={company} />
      <UpcomingProducts items={upcoming} />
      <GalleryGrid items={gallery} tags={tags} compact />

      <div className="container-page -mt-6 mb-4 text-center">
        <Link href="/gallery" className="btn-outline">
          View Full Gallery <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <Reviews reviews={reviews} />
      <AddressMap company={company} />

      <section id="enquiry" className="section bg-white">
        <div className="container-page grid items-start gap-12 lg:grid-cols-2">
          <div className="lg:sticky lg:top-28">
            <span className="eyebrow">Enquiry & CTA</span>
            <h2 className="heading-lg">Have a requirement? Let&apos;s talk.</h2>
            <p className="mt-4 text-slate-600">
              Share your application details and our technical team will recommend the right instrument,
              provide a quotation, and arrange a demo at your convenience.
            </p>
            <div className="mt-8 space-y-4">
              <a href={`tel:${mobile.replace(/\s+/g, '')}`} className="card flex items-center gap-4 p-4 transition hover:shadow-soft">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-800">
                  <PhoneCall className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-xs uppercase tracking-wide text-slate-400">Call Sales</span>
                  <span className="font-semibold text-slate-800">{mobile}</span>
                </span>
              </a>
              {company.email ? (
                <div className="rounded-2xl bg-brand-50 p-5 text-sm text-brand-900">
                  Prefer email? Reach us at{' '}
                  <a href={`mailto:${company.email}`} className="font-semibold underline">
                    {company.email}
                  </a>
                  . We respond within one business day.
                </div>
              ) : null}
            </div>
          </div>
          <div className="card p-6 sm:p-8">
            <h3 className="font-display text-xl font-semibold text-slate-900">Send us an enquiry</h3>
            <p className="mt-1 mb-6 text-sm text-slate-500">All fields marked * are required.</p>
            <EnquiryForm compact />
          </div>
        </div>
      </section>
    </>
  );
}
