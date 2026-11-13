import { pageMetadata } from '@/lib/seo';
import { PageHero } from '@/components/PageHero';

export const metadata = pageMetadata({
  title: 'Privacy Policy',
  description: 'How Swift Instruments collects, uses and protects the personal information you submit through this website.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        title="Privacy Policy"
        subtitle="Last updated: January 2026"
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Privacy Policy' }]}
      />
      <section className="container-section">
        <div className="prose-swift mx-auto max-w-3xl space-y-6 text-slate-700">
          <h2 className="font-display text-xl font-bold text-slate-900">Information we collect</h2>
          <p>
            When you submit an enquiry through our website we collect the details you provide: your
            name, email address, phone number, company name, subject and message. We also record the
            IP address of the submission for abuse prevention.
          </p>
          <h2 className="font-display text-xl font-bold text-slate-900">How we use your information</h2>
          <p>
            We use your details only to respond to your enquiry, prepare quotations and provide
            after-sales support. We do not sell or rent personal data to third parties.
          </p>
          <h2 className="font-display text-xl font-bold text-slate-900">Data retention</h2>
          <p>
            Enquiry records are retained in our internal CRM for follow-up purposes. You can request
            deletion of your data at any time by writing to{' '}
            <a href="mailto:sales@swiftinstruments.in" className="text-brand-700 underline">
              sales@swiftinstruments.in
            </a>
            .
          </p>
          <h2 className="font-display text-xl font-bold text-slate-900">Cookies</h2>
          <p>
            Our public website does not set tracking cookies. The admin console uses a strictly
            necessary session cookie for authentication.
          </p>
          <h2 className="font-display text-xl font-bold text-slate-900">Contact</h2>
          <p>
            Questions about this policy can be sent to our registered office: Greenfield, Faridabad,
            Haryana, India.
          </p>
        </div>
      </section>
    </>
  );
}
