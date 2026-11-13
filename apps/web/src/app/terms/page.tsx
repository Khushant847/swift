import { pageMetadata } from '@/lib/seo';
import { PageHero } from '@/components/PageHero';

export const metadata = pageMetadata({
  title: 'Terms of Service',
  description: 'Terms governing the use of the Swift Instruments website and our product quotations.',
  path: '/terms',
});

export default function TermsPage() {
  return (
    <>
      <PageHero
        title="Terms of Service"
        subtitle="Last updated: January 2026"
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Terms of Service' }]}
      />
      <section className="container-section">
        <div className="prose-swift mx-auto max-w-3xl space-y-6 text-slate-700">
          <h2 className="font-display text-xl font-bold text-slate-900">Website use</h2>
          <p>
            The content of this website is provided for general information about Swift Instruments
            products and services. Product specifications are subject to change without notice.
          </p>
          <h2 className="font-display text-xl font-bold text-slate-900">Quotations</h2>
          <p>
            Enquiries submitted through this website do not constitute an order or a binding offer.
            Quotations are issued separately in writing and are valid for the period stated in the
            quotation document.
          </p>
          <h2 className="font-display text-xl font-bold text-slate-900">Intellectual property</h2>
          <p>
            All trademarks, product names and content on this site are the property of Swift
            Instruments or its licensors and may not be reproduced without written permission.
          </p>
          <h2 className="font-display text-xl font-bold text-slate-900">Liability</h2>
          <p>
            We strive to keep this website accurate and available, but we do not warrant
            uninterrupted access or error-free content. Nothing on this site limits liability where
            such limitation is not permitted by law.
          </p>
        </div>
      </section>
    </>
  );
}
