import { getUpcoming } from '@/lib/api';
import { pageMetadata } from '@/lib/seo';
import { PageHero } from '@/components/PageHero';
import { UpcomingProducts } from '@/components/UpcomingProducts';

export const metadata = pageMetadata({
  title: 'Upcoming Products',
  description: 'Preview the next generation of Swift Instruments measurement technology currently under development.',
  path: '/upcoming',
});

export default async function UpcomingPage() {
  const items = await getUpcoming();
  return (
    <>
      <PageHero
        title="Upcoming Products"
        subtitle="Innovations taking shape in our R&D laboratory — designed to raise the bar for measurement accuracy."
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Upcoming Products' }]}
      />
      {items.length ? (
        <UpcomingProducts items={items} />
      ) : (
        <section className="section bg-brand-950">
          <div className="container-page text-center text-slate-300">New products are on the way. Check back soon.</div>
        </section>
      )}
    </>
  );
}
