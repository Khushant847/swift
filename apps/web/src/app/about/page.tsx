import { getCompanyInfo, getWhyChooseUs } from '@/lib/api';
import { pageMetadata } from '@/lib/seo';
import { aboutPageSchema } from '@/lib/schema';
import { JsonLd } from '@/components/JsonLd';
import { PageHero } from '@/components/PageHero';
import { AboutCompany } from '@/components/AboutCompany';
import { WhyChooseUs } from '@/components/WhyChooseUs';
import { AddressMap } from '@/components/AddressMap';

export const metadata = pageMetadata({
  title: 'About Us',
  description:
    'Learn about Swift Instruments — a precision weighing and measurement manufacturer based in Faridabad (NCR-Delhi), India.',
  path: '/about',
});

export default async function AboutPage() {
  const [company, why] = await Promise.all([getCompanyInfo(), getWhyChooseUs()]);
  const schema = aboutPageSchema(company);

  return (
    <>
      {schema ? <JsonLd data={schema} /> : null}
      <PageHero
        title="About Swift Instruments"
        subtitle={company.tagline || 'Precision measurement solutions engineered in India.'}
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'About Us' }]}
      />
      <AboutCompany company={company} />
      <WhyChooseUs items={why} />
      <AddressMap company={company} />
    </>
  );
}
