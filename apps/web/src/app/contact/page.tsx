import { getCompanyInfo } from '@/lib/api';
import { pageMetadata } from '@/lib/seo';
import { contactPageSchema } from '@/lib/schema';
import { JsonLd } from '@/components/JsonLd';
import { PageHero } from '@/components/PageHero';
import { AddressMap } from '@/components/AddressMap';
import { EnquiryForm } from '@/components/EnquiryForm';

export const metadata = pageMetadata({
  title: 'Contact Us',
  description:
    'Contact Swift Instruments for weighing instrument sales, calibration and after-sales support in Faridabad (NCR-Delhi), India.',
  path: '/contact',
});

export default async function ContactPage() {
  const company = await getCompanyInfo();
  const schema = contactPageSchema(company);

  return (
    <>
      {schema ? <JsonLd data={schema} /> : null}
      <PageHero
        title="Contact Us"
        subtitle="We'd love to hear about your requirement. Reach out by phone, email or the form below."
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Contact Us' }]}
      />
      <section className="section bg-white">
        <div className="container-page grid items-start gap-12 lg:grid-cols-2">
          <div>
            <span className="eyebrow">Send a Message</span>
            <h2 className="heading-lg">Talk to our team</h2>
            <p className="mt-4 text-slate-600">
              Whether you need a quotation, technical guidance or after-sales support, our specialists are ready to help.
            </p>
            <div className="card mt-8 p-6 sm:p-8">
              <EnquiryForm compact />
            </div>
          </div>
          <div className="lg:sticky lg:top-28">
            <AddressMap company={company} />
          </div>
        </div>
      </section>
    </>
  );
}
